# AI self-healing locators

## The broken locators (left broken on purpose)

Defined in [pages/LegacyEmiPage.js](../pages/LegacyEmiPage.js), exercised by `features/ui/self_healing_demo.feature` (tag `@broken`, excluded from the default run).

| # | Broken selector | Why it is brittle | Healed (POC output) |
|---|---|---|---|
| 1 | `#loan-amount` | stale id | `getByRole('textbox', { name: "Home Loan Amount" })` |
| 2 | `xpath=//div[3]/form/div[2]/div/input` | positional XPath, dies when a wrapper changes | `getByRole('textbox', { name: "Interest Rate" })` |
| 3 | `role=link[name="Personal Loans"]` | copy changed ("Personal Loan") | `getByRole('link', { name: "Personal Loan", exact: true })` |
| 4 | `.emi-result > span.value` | class path that no longer exists | `locator('#emiamount').locator('p')` |
| 5 | `#emi-pie-chart canvas` | wrong container id and element (chart is SVG) | `locator('#emipiechart').locator('svg')` |

## Approach

**1. Detection.** Every locator carries an *intent* (what it is for) and a *kind* (input / link / text / chart).
A locator is "broken" when it resolves to 0 elements, or to more than 1, within a short timeout.
In CI the trigger is a failing step whose error is a locator timeout or strict-mode violation. Assertion
failures (wrong EMI value) are never healed, only locator failures.

**2. Context for the model.** Do not send the whole DOM. Take a compact snapshot of visible, relevant
elements: tag, type, role, id, name, label text, visible text, nearest *stable* ancestor id and its heading.
Auto-generated ids (`highcharts-x7f2…`) are filtered out because they would produce a new brittle locator.
Ad-injected widgets are dropped too (the live site injects elements with `aria-label="Interest Rate Tracker"`).

**3. Prompt.** Inputs: intent, expected kind, old selector, the candidate list. Rules in the prompt:
choose by purpose never by position; ignore the old selector's structure; answer only JSON
`{index, confidence, reason}`; return `-1` when unsure. Asking the model to *pick from candidates* rather than
invent a selector removes hallucinated selectors, the main failure mode seen in practice.

**4. Locator construction (not the model's job).** Code turns the chosen candidate into a locator using a
fixed preference order: role + accessible name, then label, then stable container id, then text. Never positional.

**5. Validation before anything is applied.** In a real browser, the proposal must pass all of:
- matches exactly one element, and it is visible
- compatible with the expected kind
- behavioural probe: inputs accept typed text, text elements contain a number, charts contain shapes
- model confidence at least 0.5

**6. Applying.** The POC only *reports* a suggestion (`reports/self-healing/healing-report.{json,md}`).
In a real pipeline it would open a PR with the one-line diff, re-run the affected scenario on the PR,
and require human review. Silent auto-edit is deliberately avoided: a healed locator that points at the wrong
element makes a test pass for the wrong reason, which is worse than a red test.

## POC

```bash
npm run heal                         # offline heuristic ranker + real browser validation
ANTHROPIC_API_KEY=... npm run heal   # LLM picks the candidate; validation is identical
```

Verified: the offline mode heals 5 of 5 locators against the live site (see
[reports/self-healing/healing-report.md](../reports/self-healing/healing-report.md)).
**Not verified:** the LLM mode (`llmRank` in `self-healing/heal.js`). I had no API key, so that path has not
been executed. If it errors, the script falls back to the heuristic ranker and records `llmError` in the report.

Limits: the heuristic ranker is word-overlap only, so it leans on descriptive intents and sensible ids/labels.
Validation proves the element behaves like the right kind, not that it is the right one among several
look-alikes (for example, two similar inputs). That is what the model's judgement plus PR review is for.
