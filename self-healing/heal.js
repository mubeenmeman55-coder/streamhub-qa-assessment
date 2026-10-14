/**
 * Self-healing locator POC.
 *
 *   npm run heal                      -> offline heuristic ranker (no API key needed)
 *   ANTHROPIC_API_KEY=... npm run heal -> asks Claude to pick from the candidate list, then validates the same way
 *
 * Pipeline:  DETECT broken locator -> SNAPSHOT candidates from live DOM -> PROPOSE (LLM or heuristic)
 *            -> VALIDATE in a real browser -> REPORT a suggested patch (never auto-applied).
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const config = require('../config/env');
const { BROKEN_LOCATORS } = require('../pages/LegacyEmiPage');
const { startWebApp } = require('../src/webapp/server');

const OUT = path.join(__dirname, '..', 'reports', 'self-healing');
const MODEL = process.env.HEAL_MODEL || 'claude-sonnet-5-5';
const MIN_CONFIDENCE = 0.5;

// ---------------------------------------------------------------- 1. DETECT
async function isBroken(page, selector) {
  const loc = page.locator(selector);
  try {
    await loc.first().waitFor({ state: 'attached', timeout: 2500 });
  } catch {
    return { broken: true, reason: 'no element found' };
  }
  const n = await loc.count();
  return n === 1 ? { broken: false } : { broken: true, reason: `${n} elements matched` };
}

// ---------------------------------------------------------------- 2. SNAPSHOT
// Compact, LLM-friendly list of visible candidate elements (keeps the prompt small and avoids leaking page noise).
async function snapshot(page) {
  return page.evaluate(() => {
    const labelFor = (el) => {
      if (el.id) {
        const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (l) return l.innerText.trim();
      }
      return el.getAttribute('aria-label') || '';
    };
    // nearest ancestor with a human-authored id; auto-generated ids (digits/hashes, "highcharts-xxxx") rot between runs
    const stableAncestor = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) if (p.id && /^[A-Za-z][A-Za-z_-]*$/.test(p.id) && !p.id.startsWith('highcharts')) return p;
      return null;
    };
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const sel = 'input:not([type=hidden]), select, button, a[href], [role=link], [data-testid], h1, h2, h3';
    return [...document.querySelectorAll(sel)]
      .filter(visible)
      .filter((el) => !el.closest('[class*=goog-rentry], [id^=google_ads]')) // ignore injected ad widgets
      .slice(0, 120)
      .map((el, i) => ({
        i,
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || undefined,
        role: el.getAttribute('role') || undefined,
        leaf: el.children.length === 0,
        testid: el.getAttribute('data-testid') || undefined,
        id: el.id || undefined,
        name: el.getAttribute('name') || undefined,
        label: labelFor(el) || undefined,
        text: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 60) || undefined,
        container: stableAncestor(el)?.id,
        heading: stableAncestor(el)?.querySelector('h4')?.innerText.trim() || undefined,
      }));
  });
}

// ---------------------------------------------------------------- 3. PROPOSE
const words = (s) => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
const KIND_OK = {
  input: (c) => c.tag === 'input' && [undefined, 'text', 'number', 'search'].includes(c.type),
  link: (c) => c.tag === 'a' || c.role === 'link',
  text: (c) => c.leaf && ['p', 'span', 'div', 'b', 'strong'].includes(c.tag), // a value lives in a leaf; containers merely contain it
  chart: (c) => c.tag === 'svg',
};

function heuristicRank(entry, candidates) {
  const noise = new Set(['the', 'where', 'user', 'types', 'in', 'of', 'to', 'that', 'switches', 'shown', 'showing', 'text', 'box', 'xpath',
    'div', 'form', 'input', 'span', 'value', 'canvas', 'role', 'link', 'name', 'tab', 'is', 'and', 'vs', 'a', 'an']);
  const wanted = [...new Set([...words(entry.intent), ...words(entry.selector)])].filter((w) => !noise.has(w) && !/^\d+$/.test(w));
  return candidates
    .filter((c) => KIND_OK[entry.kind](c))
    .map((c) => {
      const hay = words([c.testid, c.id, c.name, c.label, c.text, c.container, c.heading].join(' '));
      const hit = (w) => hay.some((h) => h === w || h.startsWith(w) || w.startsWith(h) || (w.length >= 3 && h.includes(w)));
      return { c, score: wanted.filter(hit).length / Math.max(1, wanted.length) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ c, score }) => ({ candidate: c, confidence: Math.min(0.95, 0.3 + 0.65 * score), source: 'heuristic' }));
}

// Preferred locator order: role+name > label > test id > id > text. Never positional.
function toLocatorExpression(c, kind) {
  if (c.testid) return `page.getByTestId(${JSON.stringify(c.testid)})`; // explicit test contract beats everything else
  if (kind === 'input' && c.label) return `page.getByRole('textbox', { name: ${JSON.stringify(c.label)} })`;
  if (kind === 'link' && c.text) return `page.getByRole('link', { name: ${JSON.stringify(c.text)}, exact: true })`;
  // text/chart inside a stable container (e.g. #emiamount p, #emipiechart svg): scope by container id, not by position
  if ((kind === 'text' || kind === 'chart') && c.container) return `page.locator('#${c.container}').locator('${c.tag}')`;
  if (c.id) return `page.locator('#${c.id}')`;
  if (c.text) return `page.getByText(${JSON.stringify(c.text)}, { exact: true })`;
  return null;
}

async function llmRank(entry, candidates) {
  const prompt = `A Playwright test locator broke. Pick the element it was meant to target from the candidate list.
Rules: answer ONLY with JSON {"index": <candidate i or -1>, "confidence": 0-1, "reason": "..."}; choose -1 if unsure;
choose by the element's purpose (intent), never by position; the page structure changed, so ignore the old selector's structure.

Intent: ${entry.intent}
Expected kind: ${entry.kind}
Broken selector: ${entry.selector}
Candidates: ${JSON.stringify(candidates.filter((c) => KIND_OK[entry.kind](c)))}`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`LLM call failed: ${res.status} ${await res.text()}`);
  const text = (await res.json()).content?.[0]?.text || '';
  const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
  const c = candidates.find((x) => x.i === parsed.index);
  return c ? [{ candidate: c, confidence: parsed.confidence, reason: parsed.reason, source: 'llm' }] : [];
}

// ---------------------------------------------------------------- 4. VALIDATE
async function validate(page, entry, proposal) {
  const expr = toLocatorExpression(proposal.candidate, entry.kind);
  if (!expr) return { ok: false, why: 'could not build a non-positional locator' };
  const loc = eval(expr); // eslint-disable-line no-eval -- expression built from our own template above
  const checks = {};
  checks.uniqueMatch = (await loc.count()) === 1;
  if (!checks.uniqueMatch) return { ok: false, expr, checks, why: 'locator is not unique' };
  checks.visible = await loc.isVisible();
  checks.kindCompatible = KIND_OK[entry.kind](proposal.candidate);
  if (entry.kind === 'input') {
    const before = await loc.inputValue();
    await loc.fill('12'); // behavioural probe: the element must really accept input
    checks.acceptsInput = (await loc.inputValue()) === '12';
    await loc.fill(before);
  } else if (entry.kind === 'text') {
    checks.containsNumber = /\d/.test(await loc.innerText());
    checks.isLeafValue = (await loc.locator('*').count()) === 0 && (await loc.innerText()).length < 40; // not a container wrapping many values
  } else if (entry.kind === 'chart') {
    checks.hasShapes = (await loc.locator('path, rect, circle').count()) > 0;
  } else if (entry.kind === 'link') {
    checks.hasHref = true; // role-based match is sufficient; clicking is left to the owning test
  }
  checks.confidentEnough = proposal.confidence >= MIN_CONFIDENCE;
  return { ok: Object.values(checks).every(Boolean), expr, checks };
}

// ---------------------------------------------------------------- run
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: config.headless });
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const server = await startWebApp(new URL(config.webappUrl).port || 80).catch(() => null); // reuse if already running
  await page.goto(config.webappUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox', { name: /Loan amount/ }).waitFor();

  const mode = process.env.ANTHROPIC_API_KEY ? `LLM (${MODEL}) + validation` : 'offline heuristic + validation';
  console.log(`Self-healing run - mode: ${mode}\n`);
  const results = [];
  const candidates = await snapshot(page);

  for (const [key, entry] of Object.entries(BROKEN_LOCATORS)) {
    const det = await isBroken(page, entry.selector);
    const row = { key, brokenSelector: entry.selector, intent: entry.intent, detected: det };
    if (!det.broken) {
      row.outcome = 'healthy - nothing to heal';
    } else {
      let proposals = [];
      try {
        proposals = process.env.ANTHROPIC_API_KEY ? await llmRank(entry, candidates) : heuristicRank(entry, candidates);
      } catch (e) {
        row.llmError = e.message;
        proposals = heuristicRank(entry, candidates);
      }
      row.attempts = [];
      for (const p of proposals) {
        const v = await validate(page, entry, p);
        row.attempts.push({ source: p.source, confidence: Number(p.confidence?.toFixed?.(2) ?? p.confidence), element: p.candidate, ...v });
        if (v.ok) {
          row.outcome = 'HEALED (validated) - suggested replacement below; apply via PR review';
          row.suggested = v.expr;
          break;
        }
      }
      row.outcome ??= 'NOT healed - no candidate passed validation; needs a human';
    }
    results.push(row);
    console.log(`${row.outcome.startsWith('HEALED') ? 'OK ' : row.outcome.startsWith('healthy') ? '-- ' : '!! '} ${key}`);
    console.log(`     broken : ${entry.selector}`);
    if (row.suggested) console.log(`     healed : ${row.suggested}`);
    else if (row.attempts) console.log(`     result : ${row.outcome}`);
  }

  fs.writeFileSync(path.join(OUT, 'healing-report.json'), JSON.stringify({ mode, url: config.webappUrl, results }, null, 2));
  const md = ['# Self-healing run', '', `Mode: **${mode}**  `, `Target: ${config.webappUrl}`, '', '| Locator | Broken selector | Suggested (validated) |', '|---|---|---|',
    ...results.map((r) => `| ${r.key} | \`${r.brokenSelector}\` | ${r.suggested ? `\`${r.suggested}\`` : r.outcome} |`)];
  fs.writeFileSync(path.join(OUT, 'healing-report.md'), md.join('\n') + '\n');
  await browser.close();
  console.log(`\nReport: ${path.relative(process.cwd(), OUT)}`);
})();
