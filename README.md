# Streamhub QA Automation Assessment - Section B

Playwright + Cucumber (BDD) framework covering **B1** mock API, **B2** API tests, **B3** EMI Calculator UI tests,
**B4** SQL, plus the **AI self-healing** exercise. (Section A was not attempted; the brief allows either.)

## Setup

```bash
npm install
npx playwright install chromium
```
Node 22.5+ is needed for the built-in `node:sqlite` used by the SQL runner (developed on Node 24).

## Run

| Command | What it does |
|---|---|
| `npm test` | all UI + API features (excludes `@broken`) |
| `npm run test:ui` | EMI Calculator pie/bar chart scenarios against https://emicalculator.net |
| `npm run test:ui:live` | UI suite with a live viewer: open VS Code Simple Browser at `http://localhost:3200` to watch the test browser and current step |
| `npm run test:api` | API scenarios; the mock API is started automatically |
| `npm run test:broken` | the intentionally broken self-healing demo (**expected to fail**) |
| `npm run sql` | builds the SQLite DB, runs both SQL scenarios, writes outputs + screenshots |
| `npm run heal` | self-healing proof of concept |
| `npm run api:start` | run the mock API on its own (`API_BASE_URL`) |

Watch the browser: `HEADLESS=false SLOW_MO=400 npm run test:ui` (PowerShell: `$env:HEADLESS='false'; npm run test:ui`).

## Results (committed in `reports/`)

- `reports/cucumber/all.html` / `.json` - full UI + API run; `ui.*`, `api.*` per-suite; `broken.*` the expected failure
- `reports/screenshots/` - one screenshot per UI scenario (`FAILED_` prefix on failures, which also appear in the HTML report)
- `reports/sql/` - schema, sample data, query and output as HTML + PNG, plus `results.txt`
- `reports/self-healing/` - healing run output

Latest result: see the end of this README.

## Architecture

```
config/              env loading (config/environments/qa.env, picked by TEST_ENV); no URLs in code
features/ui, api/    Gherkin feature files
features/step_definitions/   thin steps; assertions live here, UI mechanics do not
features/support/    world (per-scenario state) + hooks (browser, API context, screenshots, mock-API lifecycle)
pages/               Page Objects (EmiCalculatorPage, LegacyEmiPage) and pages/api/CatalogApi
utils/               independent EMI maths (the test oracle) and number parsing
src/api/             B1: Express mock API over JSON data
sql/                 schema, sample data, the two scenario queries, runner
self-healing/        POC;  docs/SELF_HEALING.md  the write-up
```

**B1 API** (`src/api`): `GET /api/titles` (filter by genre/type/minYear/maxYear/minRating, text search `q`, `sortBy`/`order`,
`page`/`limit`), `GET /api/titles/:id`, `GET /api/genres`, `GET /api/emi` (required params). Errors are JSON
`{error:{code,message,details}}` with 400 (invalid/missing/unsupported/repeated params), 404 (unknown id, page out of range, unknown route).

**Browser UI**: `npm run api:start`, then open `http://localhost:3100` - a catalogue explorer (search, filters, sort, pagination, genre chart), an EMI calculator with a live donut chart, and an API explorer. It only consumes the API endpoints above.

**B2 tests**: 58 scenarios incl. every filter and sort, pagination coverage, combined parameters, and ~35 invalid-input cases.
I mutation-checked them (broke sort order and limit validation in the API; the tests failed as they should).

**B3 UI**
- Locators: role/label/text first (`getByRole('textbox', {name})`, tabs by link name, summary values by heading text).
  Where the page offers nothing semantic, stable element ids (`#emipiechart`) or Highcharts' own class hooks are used.
- Expected values come from an independent EMI formula (`utils/emi.js`), not from the app. EMI must match within ₹1.
- Pie chart: both sections read from hover tooltips (percentages), must be > 0, and must match the computed principal share;
  the underlying Highcharts data is cross-checked.
- Bar chart: sliders are driven by clicking at the tick position and fine-tuning with arrow keys until the field matches;
  the start month is chosen in the calendar widget (Jan 2027, deterministic); bars counted (10 = 5 years x interest/principal);
  the first bar's tooltip is compared with a computed yearly schedule.

**B4 SQL** (SQLite; window functions). Scenario 2 uses gaps-and-islands (`ROW_NUMBER` difference). Assumptions are in the query files:
10% is measured against the first transfer and is inclusive, 24h is inclusive, "consecutive" means consecutive appearances for the player,
and a did-not-bat (NULL) breaks a streak. Data is illustrative, not real IPL scores, and includes boundary cases (exactly 10%, 24h01m, 29 vs 30 runs).

## Self-healing

Five locators in `pages/LegacyEmiPage.js` are broken on purpose and left that way. See [docs/SELF_HEALING.md](docs/SELF_HEALING.md).
The offline POC heals 5/5 against the live site; the LLM path is written but **untested** (no API key available).

## Claude Code reflection

**Worked:** scaffolding the structure, the Express API and the ~60 API scenarios; the gaps-and-islands SQL; the self-healing pipeline shape.
Letting it inspect the real page first (a script dumping the DOM and Highcharts data) meant locators were grounded in what exists.

**Did not work / needed correcting:**
- First pass at the interest-rate locator used `getByLabel('Interest Rate')`; the live site's injected ad widgets carry the same aria-label, causing strict-mode violations. Switched to `getByRole('textbox', ...)`.
- Bar count came back 12 instead of 10: legend swatches share the bar CSS class. Confirmed against the Highcharts data (10 points) before changing the selector, rather than adjusting the expected number.
- The self-healing heuristic initially proposed Highcharts' auto-generated ids, which are themselves brittle; the snapshot now walks up to the nearest human-authored id.
- A flaky pie-chart read (tooltip reused between slices, so the second read could return the first slice) was fixed by waiting for the tooltip text to change.
- Multi-line shell quoting repeatedly broke when generating files from the command line; writing files directly was more reliable.

The "all green on first run" API suite was not trusted until the mutation check proved it can fail.

## Latest results

| Suite | Result |
|---|---|
| UI (EMI Calculator, 3 scenarios) | 3 passed |
| API (58 scenarios) | 58 passed |
| Full run `npm test` | 61 scenarios / 320 steps passed |
| `@broken` self-healing demo | 1 failed - **expected** |
| SQL | scenario 1: 6 rows, scenario 2: 5 rows (match hand-worked expectations) |
| `npm run heal` (offline) | 5/5 healed |

The UI tests hit the live third-party site, so they depend on network access and on emicalculator.net keeping its current markup.
