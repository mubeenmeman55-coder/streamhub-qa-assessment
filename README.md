# Streamhub QA Automation Assessment

Playwright + Cucumber (BDD) framework. **Submitted for Section A** (own web application + UI automation + API test + SQL),
plus the self-healing exercise. Parts of Section B that I also built are kept as clearly separated extras (see the end).

| Brief item | What I built | Where |
|---|---|---|
| **A1** web app | EMI Calculator: dashboard (KPIs, pie chart, bar chart), report view (filterable amortisation table), validation | `src/webapp/` |
| **A2** Playwright tests | 21 Cucumber scenarios, page object, independent EMI oracle | `features/webapp/`, `pages/WebAppPage.js`, `features/step_definitions/webapp.steps.js` |
| **A3** API test | JSONPlaceholder `POST /posts`: long titles, special characters, missing fields | `features/jsonplaceholder/`, `pages/api/PostsApi.js` |
| **A4** SQL | schema + round-trip transfers + IPL streaks, with output screenshots | `sql/`, `reports/sql/` |
| Self-healing | 5 deliberately broken locators, write-up, working POC | `pages/LegacyEmiPage.js`, `docs/SELF_HEALING.md`, `self-healing/heal.js` |
| Reflection | below | |

## Setup

```bash
npm install
npx playwright install chromium
```
Node 22.5+ is needed for the built-in `node:sqlite` used by the SQL runner (developed on Node 24).
No manual server start is needed: the test hooks start the EMI app automatically. All URLs live in `config/environments/qa.env`
(select another file with `TEST_ENV=<name>`); nothing is hardcoded in tests.

## Run

| Command | What it does |
|---|---|
| `npm run test:webapp` | **A2** - the EMI web app scenarios |
| `npm run test:jsonplaceholder` | **A3** - JSONPlaceholder POST tests (needs internet) |
| `npm run test:gap` | A3 *known gaps* - run on demand, **expected to fail** (see findings) |
| `npm run sql` | **A4** - builds the DB, runs both queries, writes outputs + screenshots |
| `npm run heal` | self-healing POC |
| `npm run test:broken` | the intentionally broken locators (**expected to fail**) |
| `npm test` | everything that should pass (A2 + A3 + the Section B extras) |
| `npm run app:start` | run the EMI app yourself at `WEBAPP_URL` (http://localhost:3300) |
| `BLOCK_ADS=false` | env flag: allow third-party ads on emicalculator.net (blocked by default in its tests) |

Watch a run in a visible browser: `$env:HEADLESS='false'; $env:SLOW_MO='300'; npm run test:webapp` (PowerShell).
Watch it inside VS Code's Simple Browser: `npm run test:ui:live`, then open `http://localhost:3200`.

## Results (committed in `reports/`)

- `reports/cucumber/*.html` / `.json` - one HTML + JSON report per suite (`webapp`, `jsonplaceholder`, `known-gap`, `all`, ...)
- `reports/screenshots/` - one screenshot per UI scenario
- `reports/sql/` - schema, sample data, query and output as HTML and PNG, plus `results.txt`
- `reports/self-healing/` - healing run output

See "Latest results" at the end for the numbers.

## A1 - the EMI Calculator app (`src/webapp`)

Plain HTML/CSS/JS served by a tiny Express static server. Enter amount, rate, tenure (years or months) and start month, press **Calculate EMI**.
- **Dashboard** (`#/dashboard`): Monthly EMI, total interest, total payment, interest share; a **pie chart** (principal vs interest) and a
  **stacked bar chart** per calendar year with hover tooltips.
- **Report** (`#/report`): amortisation table driven by controls - Yearly/Monthly view and a Year filter, with a totals row and a summary line.
- Input validation with specific messages (amount, rate, tenure), a reset button, and sliders kept in sync with the fields.
- Built to be testable: labelled fields, ARIA roles, `data-testid` hooks, and exact numbers exposed in `data-value` attributes
  (so tests never parse locale formatting such as `₹39,64,522`).

## A2 - test design

- **Layers**: `features/webapp/emi_app.feature` -> `webapp.steps.js` (thin steps, assertions) -> `WebAppPage.js` (locators and actions) -> `config/env.js`.
- **Locators**: role/label/test-id only (`getByRole('textbox', {name})`, `getByLabel`, `getByTestId`). No positional CSS/XPath.
- **Independent oracle**: expected EMI, interest, totals and yearly schedule come from `utils/emi.js`, which shares no code with the app.
  Checks are made on both the exact `data-value` and the text a user actually reads.
- **Covered**: load/navigation of dashboard and report; five input combinations (incl. months, a 0.1% rate, a ₹5 crore loan) against the oracle;
  pie chart visible, both segments > 0 and summing to 100%, split equal to principal/total; bar chart visible, one stacked bar per calendar year,
  every bar > 0, bars summing to the loan amount and total interest, year-by-year equality with the oracle; tooltip contents; the start month changing
  the year span; slider keyboard use; report totals, a final balance of zero, the Monthly + Year filter (12 rows) and monthly rows summing to the yearly figure;
  seven invalid inputs with their messages and "previous results kept"; reset.

## A3 - JSONPlaceholder findings (read this)

JSONPlaceholder is a *fake* API. Observed with these tests:

| Input | Observed |
|---|---|
| Titles of 1 KB up to 1 MB; HTML/SQL/emoji/control/NUL/RTL/JSON-breaker strings | **201**, echoed back intact |
| Missing `userId`, missing `title`, `{}`, `userId` as a string, `title: null` | **201** (no validation) |
| Malformed JSON body | **HTTP 500** - a real server-side failure on invalid input |

The brief expects "appropriate HTTP error codes ... without server-side failures". So the suite is split honestly:
- **Default run (passes)**: what holds for the live service - never a 5xx on those inputs, a controlled status (201/400/413/422), parseable JSON,
  and an exact echo of what was sent (no truncation or corruption).
- **`@known-gap` (`npm run test:gap`, fails by design)**: the strict expectation "invalid input -> 4xx" (6 payloads answered 201) and the
  malformed-JSON 500. The failing report is committed as `reports/cucumber/known-gap.html` as evidence, rather than weakening assertions to turn it green.

## A4 - SQL

SQLite (window functions). Assumptions are stated in the query files: "within 10%" is measured against the first transfer and is inclusive, 24 h is inclusive,
"consecutive" means a player's consecutive appearances, and a did-not-bat (NULL) breaks a streak. Scenario 2 uses gaps-and-islands (difference of two `ROW_NUMBER()`s).
The data is illustrative (real player names, invented scores) and contains boundary cases: exactly +10%, 24h01m, 29 vs 30 runs, a did-not-bat in the middle of a streak, and a
2023 streak that must be excluded.

## Self-healing

Five broken locators live in `pages/LegacyEmiPage.js` and are left broken. `docs/SELF_HEALING.md` describes detection, prompt approach and validation.
`npm run heal` is a working POC that heals 5/5 against the app. The LLM-backed path exists but was **not run** (no API key); the offline path was.

## Architecture

```
config/               env loading (config/environments/qa.env); no URLs in code
features/webapp/      A2 scenarios            features/jsonplaceholder/   A3 scenarios
features/step_definitions/   thin steps       features/support/   world + hooks (browser, servers, screenshots, ad-blocking, live view)
pages/                WebAppPage, EmiCalculatorPage, LegacyEmiPage;  pages/api/ PostsApi, CatalogApi
utils/                independent EMI maths (test oracle) and number parsing
src/webapp/           A1 app                  src/api/   mock API (Section B extra)
sql/                  schema, data, queries, runner
self-healing/         POC;   docs/SELF_HEALING.md
```

## Claude Code reflection

**Worked well**
- Scaffolding the framework layers, the app, and ~80 scenarios quickly; the gaps-and-islands SQL; the self-healing pipeline shape.
- Letting it inspect real pages first (a script that dumped DOM and chart data) before writing locators.
- The oracle pattern: a separate EMI implementation in the tests, so a bug copied into the app would still be caught.

**Wrong or needed correcting**
- It chose `getByLabel('Interest Rate')` on a third-party page; injected ad widgets used the same aria-label (strict-mode violation). Moved to role-based locators and blocked ads in the test browser.
- It counted 12 bars instead of 10 because legend swatches share the bar class; I confirmed against the chart's data before changing the selector (rather than changing the expected number).
- A hover on a pie slice's bounding-box centre landed on the neighbouring slice, causing an intermittent failure; fixed by computing a point on the slice's own arc.
- The self-healing POC first "healed" the EMI value to the whole KPI container because validation only checked "contains a number". Found by reading its output, fixed with a leaf-element check.
- Generating files through shell heredocs repeatedly broke on quoting; writing files directly was more reliable.
- An API suite that was green on its first run was not trusted until mutation-checked (I broke sorting and limit validation; the tests failed as they should).
- JSONPlaceholder does not behave as the brief's expected outcome assumes; I documented the deviation and kept the failing evidence instead of bending assertions.

## Section B extras (built, optional)

Not required when Section A is chosen, but built and passing: a mock catalogue API with a browser UI (`src/api`, `npm run api:start`, http://localhost:3100) and 58 API scenarios
(`npm run test:api`); UI tests against https://emicalculator.net for the Home Loan pie chart and Personal Loan bar chart (`npm run test:ui`, uses sliders, the calendar widget and tooltips).

## Latest results

| Suite | Result |
|---|---|
| **A2** EMI web app (`test:webapp`) | 21 scenarios passed (stable across 5 consecutive runs) |
| **A3** JSONPlaceholder (`test:jsonplaceholder`) | 23 scenarios passed |
| A3 known gaps (`test:gap`) | 7 failed **by design** - API returns 201 for invalid input and 500 for malformed JSON |
| Full run `npm test` | 105 scenarios / 603 steps passed |
| `@broken` self-healing demo | 1 failed - **expected** |
| **A4** SQL | scenario 1: 6 rows, scenario 2: 5 rows (match hand-worked expectations) |
| `npm run heal` (offline) | 5/5 healed |

The emicalculator.net tests (Section B extra) hit a live third-party site, so they depend on network access and its current markup.
