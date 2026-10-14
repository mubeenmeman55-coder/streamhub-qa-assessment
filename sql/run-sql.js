// Builds the SQLite DB from sql/*.sql, runs both scenarios, writes text + HTML results and PNG screenshots.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { chromium } = require('playwright');

const dir = __dirname;
const out = path.join(__dirname, '..', 'reports', 'sql');
fs.mkdirSync(out, { recursive: true });

const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
const db = new DatabaseSync(':memory:');
db.exec(read('01_schema.sql'));
db.exec(read('02_sample_data.sql'));

const esc = (s) => String(s ?? 'NULL').replace(/&/g, '&amp;').replace(/</g, '&lt;');
const table = (rows) => {
  if (!rows.length) return '<p><em>0 rows</em></p>';
  const cols = Object.keys(rows[0]);
  return `<table><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${rows
    .map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c])}</td>`).join('')}</tr>`)
    .join('')}</table><p><em>${rows.length} row(s)</em></p>`;
};

const scenarios = [
  { id: 'scenario1', title: 'Scenario 1 - round-trip transfers', file: 'scenario1_round_trip_transfers.sql', source: ['transactions'] },
  { id: 'scenario2', title: 'Scenario 2 - IPL 2024 30+ run streaks', file: 'scenario2_ipl_streaks.sql', source: ['ipl_matches', 'batting_scores'] },
];

const css = `body{font:14px Segoe UI,Arial;margin:24px;max-width:1100px}h1{font-size:20px}h2{font-size:15px;margin-top:22px}
pre{background:#f4f6f8;padding:12px;border-radius:6px;white-space:pre-wrap;font-size:12px}table{border-collapse:collapse;margin:6px 0}
th,td{border:1px solid #c8d0d8;padding:4px 10px;text-align:left}th{background:#e8eef4}`;

(async () => {
  const browser = await chromium.launch();
  const text = [];
  for (const s of scenarios) {
    const sql = read(s.file);
    const rows = db.prepare(sql).all().map((r) => ({ ...r }));
    const tables = s.source.map((t) => `<h2>Table: ${t}</h2>${table(db.prepare(`SELECT * FROM ${t}`).all().map((r) => ({ ...r })))}`).join('');
    const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name IN (" + s.source.map(() => '?').join(',') + ')').all(...s.source).map((r) => r.sql).join('\n\n');

    const resultHtml = `<html><head><meta charset="utf-8"><style>${css}</style></head><body><h1>${s.title}</h1>
      <h2>Query</h2><pre>${esc(sql)}</pre><h2>Output</h2>${table(rows)}</body></html>`;
    const inputHtml = `<html><head><meta charset="utf-8"><style>${css}</style></head><body><h1>${s.title} - schema &amp; sample data</h1>
      <h2>Schema</h2><pre>${esc(schema)}</pre>${tables}</body></html>`;

    for (const [name, html] of [['output', resultHtml], ['schema-and-data', inputHtml]]) {
      fs.writeFileSync(path.join(out, `${s.id}-${name}.html`), html);
      const page = await browser.newPage({ viewport: { width: 1150, height: 600 } });
      await page.setContent(html);
      await page.screenshot({ path: path.join(out, `${s.id}-${name}.png`), fullPage: true });
      await page.close();
    }
    text.push(`== ${s.title} ==\n${rows.length} row(s)\n${JSON.stringify(rows, null, 2)}\n`);
    console.log(`${s.title}: ${rows.length} row(s)`);
    console.table(rows);
  }
  fs.writeFileSync(path.join(out, 'results.txt'), text.join('\n'));
  await browser.close();
})();
