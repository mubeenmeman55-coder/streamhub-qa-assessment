# Streamhub QA Automation Assessment

Playwright + Cucumber (BDD) framework. **Submitted for Section A** (own web application + UI automation + API test + SQL),
plus the self-healing exercise. A small mock API that I also built is kept as a clearly separated optional extra (see the end).

| Brief item | What I built | Where |
|---|---|---|
| **A1** web app | EMI Calculator: dashboard (KPIs, pie, bar + balance line), report (filters, drill-down, CSV), compare view, prepayment, saved scenarios | `src/webapp/` |
| **A2** Playwright tests | 68 Cucumber scenarios, page object, independent EMI oracle | `features/webapp/`, `pages/WebAppPage.js`, `features/step_definitions/webapp.steps.js` |
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
| `npm test` | everything that should pass (A2 + A3 + the optional mock-API suite) |
| `npm run app:start` | run the EMI app yourself at `WEBAPP_URL` (http://localhost:3300) |

Watch a run in a visible browser: `$env:HEADLESS='false'; $env:SLOW_MO='300'; npm run test:webapp` (PowerShell).
Watch it inside VS Code's Simple Browser: `npm run test:ui:live`, then open `http://localhost:3200`.

## Results (committed in `reports/`)

- `reports/cucumber/*.html` / `.json` - one HTML + JSON report per suite (`webapp`, `jsonplaceholder`, `known-gap`, `all`, ...)
- `reports/screenshots/` - one screenshot per UI scenario
- `reports/sql/` - schema, sample data, query and output as HTML and PNG, plus `results.txt`
- `reports/self-healing/` - healing run output

See "Latest results" at the end for the numbers.

## A1 - the EMI Calculator app (`src/webapp`)

Plain HTML/CSS/JS served by a tiny Express static server, in the spirit of the public EMI calculators the brief mentions (loan-type tabs, sliders with
tick marks, EMI at start/end of month, calendar vs financial year, expandable yearly rows, balance line on the bar chart, live results), then extended.
- **Dashboard** (`#/dashboard`): Monthly EMI, total interest, total payment, interest share; a **pie chart** (principal vs interest), a **stacked bar chart**
  per year with hover tooltips and an outstanding-**balance line** (right axis); a **prepayment impact** box (interest and time saved) when an extra monthly payment is entered.
- **Report** (`#/report`): amortisation table driven by controls - Yearly/Monthly view, Year filter, **Calendar vs Financial year (Apr-Mar)**, click a year to
  **drill into its months**, totals row, and **Download CSV** of what is on screen.
- **Compare** (`#/compare`): two loans side by side with differences, the cheaper one highlighted, and a plain-language verdict.
- **Insights**: cost of every ₹100 borrowed, the month when principal overtakes interest, and an **affordability check** (EMI as a share of monthly income: comfortable / stretching / risky).
- **Loan types**: Home / Personal / Car tabs with their own defaults and slider ranges. **EMI timing**: end of month (arrears) or start of month (advance).
- **Dynamic**: results update live while typing or dragging sliders (invalid values never wipe the last good result); amount spelled out in words (Indian
  numbering); **saved scenarios** (kept in the browser); **share link** that restores the exact loan; light/dark theme.
- Input validation with specific messages (amount, rate, tenure, extra payment), reset, sliders kept in sync with the fields.
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
  Second and third feature files (`emi_app_features.feature`, `emi_app_dynamic.feature`) cover: prepayment (closed-form oracle, no month loop, so it
  cannot share a bug with the app), compare view, CSV download, saved scenarios surviving a reload, share-link round trip, theme, loan types, start-of-month
  EMI, financial-year grouping, drill-down rows, balance-line values and live recalculation.
  I mutation-tested the new features (broke the advance-EMI formula, the financial-year boundary and the balance line in the app): 7 scenarios failed as they should.

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
features/webapp/      A2 scenarios            features/jsonplaceholder/   A3 scenarios       features/self-healing/  broken-locator demo
features/step_definitions/   thin steps       features/support/   world + hooks (browser, servers, screenshots, live view)
pages/                WebAppPage, LegacyEmiPage (broken locators);  pages/api/ PostsApi, CatalogApi
utils/                independent EMI maths (test oracle) and number parsing
src/webapp/           A1 app                  src/api/   mock API (optional extra, see end)
sql/                  schema, data, queries, runner
self-healing/         POC;   docs/SELF_HEALING.md
```

## Claude Code reflection

**Worked well**
- Scaffolding the framework layers, the app, and ~150 scenarios quickly; the gaps-and-islands SQL; the self-healing pipeline shape.
- Letting it inspect real pages first (a script that dumped DOM and chart data) before writing locators.
- The oracle pattern: a separate EMI implementation in the tests, so a bug copied into the app would still be caught.

**Wrong or needed correcting**
- Hovering the centre of a chart element's bounding box can land on a neighbouring element (an arc-shaped pie slice, in an earlier version of the tests), causing an intermittent failure; fixed by aiming at a point on the shape itself.
- Its first locators for a form field matched hidden helper elements with the same name (strict-mode violations); role-based locators with exact accessible names fixed that.
- A "green on the first run" suite for the new features was not trusted until mutation-tested: I broke the start-of-month formula, the financial-year boundary and the balance line in the app and confirmed 7 scenarios failed.
- A scenario of mine failed because my own test data was wrong (₹33,038 EMI on a ₹1,00,000 income is 33%, i.e. "stretching", not "comfortable"); the app was right, so I fixed the data, not the assertion.
- The self-healing POC first "healed" the EMI value to the whole KPI container because validation only checked "contains a number". Found by reading its output, fixed with a leaf-element check.
- Generating files through shell heredocs repeatedly broke on quoting; writing files directly was more reliable.
- An API suite that was green on its first run was not trusted until mutation-checked (I broke sorting and limit validation; the tests failed as they should).
- JSONPlaceholder does not behave as the brief's expected outcome assumes; I documented the deviation and kept the failing evidence instead of bending assertions.

## Optional extra: mock catalogue API

Not part of Section A. A small Express mock API (`src/api`, `npm run api:start`, http://localhost:3100) with filtering, sorting, pagination and error handling,
plus 58 API scenarios (`npm run test:api`). It can be deleted without affecting anything above (`src/api`, `features/api`, `pages/api/CatalogApi.js`).
