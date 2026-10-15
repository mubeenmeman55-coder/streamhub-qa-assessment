# Requirements checklist (line by line)

Each line of the assessment document, with where it is satisfied and how it was verified. Status: **Done**, **Done (note)**, **Not applicable** (the brief
lets you pick Section A or B; Section A was chosen) or **Open**.

## Page 1 - general instructions

| Document line | Status | Where / evidence |
|---|---|---|
| Automate and solve the questions, push to GitHub, share the link; include test results | Done except publishing | Work is committed locally. **Open: GitHub push** (needs the owner's GitHub sign-in; commands in README/hand-over). Results are committed in `reports/`. |
| Build a Playwright framework, not a plain script - separate feature, step definition and page (POM) files | Done | `features/*/*.feature`, `features/step_definitions/*.steps.js`, `pages/WebAppPage.js`, `pages/api/PostsApi.js`. Playwright library driven by Cucumber. |
| Environment configuration, no hardcoded URLs | Done | `config/env.js` + `config/environments/qa.env` (`WEBAPP_URL`, `JSONPLACEHOLDER_URL`, `POSTS_API_URL`, `API_BASE_URL`). Search of `features/ pages/ utils/` finds no `http(s)://`. |
| Dynamic, resilient locators; avoid positional CSS/XPath | Done | Role / label / `data-testid` locators (`getByRole`, `getByLabel`, `getByTestId`). Search finds no `xpath`, `nth-child` or positional CSS outside the intentionally broken file. Three `.first()/.last()` calls address "first/last row" of a test-id collection. |
| Self-healing: add 3-5 incorrect/brittle locators in test files, leave them broken | Done | 5 locators in `pages/LegacyEmiPage.js` (used by `features/self-healing/self_healing_demo.feature`). `npm run test:self-healing` (6 scenarios, all pass) confirms each one is detected as broken while its target still exists; they are never fixed. |
| Markdown file: detection | Done | `docs/SELF_HEALING.md` section 1 |
| Markdown file: prompt approach | Done | section 3 (and `npm run heal -- --prompt` prints the real prompt) |
| Markdown file: validation before applying the fix | Done | section 5 (unique, visible, right kind, behavioural probe, confidence) and section 6 (report-only, PR review) |
| Working POC (bonus) | Done (note) | `self-healing/heal.js`: offline mode heals 5 of 5. The LLM-backed path is implemented but was **not executed** (no API key). |
| Use Claude Code as a pair programmer; reflection section in README (how used, what worked, what did not) | Done | README "Claude Code reflection": worked well / wrong or needed correcting. |
| Publish all code with a clear README: setup, how to run, architecture notes | Done except publishing | README sections Setup, Run, Architecture. |
| Repository must include test execution results (report / screenshots / logs) | Done | `reports/cucumber/*.html|json` (14 files), `reports/screenshots/` (90 PNGs), `reports/sql/`, `reports/self-healing/`, plus readable `RESULTS.md`. |

## Page 2 - Section A

| Document line | Status | Where / evidence |
|---|---|---|
| **A1** Build a small web application of your own (in the spirit of an EMI calculator) | Done | `src/webapp/` - EMI calculator app, `npm run app:start`. |
| A1: dashboard/landing view with summarized or calculated data | Done | Dashboard: monthly EMI, total interest, total payment, interest share, insights. |
| A1: at least one report/detail view driven by user input (filters, form, controls) | Done | Report view (Yearly/Monthly, year filter, calendar/financial year, drill-down), plus compare and eligibility views. |
| A1: at least one chart or visual element reflecting the data | Done | Pie chart, stacked bar chart with balance line, cumulative chart, amortisation table. |
| **A2** Write Playwright tests for the app, per the framework rules | Done | `features/webapp/` (5 feature files, 89 scenarios), `webapp*.steps.js`, `pages/WebAppPage.js`. |
| A2: navigate to the dashboard/report view and validate it loads | Done | "Dashboard loads with default loan and summary figures", "Report view lists the yearly schedule and its totals". |
| A2: submit input and validate output equals your own independently computed value | Done | "Calculated figures match my independent calculation" (5 inputs) and many more; oracle in `utils/emi.js` (closed-form formulas, separate from the app). |
| A2: chart visible and renders non-zero, valid data | Done | Pie segments > 0 and = 100%; bars visible, one per year, every bar > 0, bars sum to loan amount and total interest. |
| A2: execute the tests and include results (HTML report, screenshots, console output) | Done | `reports/cucumber/webapp.html`, `reports/screenshots/`, `RESULTS.md`. 89 of 89 pass. |
| **A3** Target JSONPlaceholder, `POST https://jsonplaceholder.typicode.com/posts` | Done | `features/jsonplaceholder/create_post.feature`; URL from `JSONPLACEHOLDER_URL`; `PostsApi.create()` posts to `/posts`. |
| A3: excessively long title strings | Done | 1 KB, 10 KB, 100 KB, 1 MB titles. |
| A3: unsupported special characters | Done | HTML/script, SQL injection, emoji, control characters, NUL byte, bidi override, JSON-breaking quotes, path traversal. |
| A3: missing required fields (e.g. userId) | Done | missing userId, title, body; `{}`; wrong types; `null`; object title. |
| A3 expected outcome: appropriate HTTP error codes/messages for invalid input, no server-side failures | Done (note) | **Against the real JSONPlaceholder the outcome cannot be met**: it answers 201 to invalid input and **500 to malformed JSON**. This is tested and documented (`test:jsonplaceholder` passes the achievable checks; 7 `@known-deviation` scenarios record the observed 201/500 behaviour and also pass). The expected behaviour is demonstrated against a local validating API (`src/posts-api`, `features/validating-posts/`, 24 of 24 pass: 422/413/400/415, never 5xx). |
| **A4** SQL queries for both scenarios; provide table schema and screenshots of query outputs | Done | `sql/01_schema.sql`, `sql/02_sample_data.sql`, scenario query files; `reports/sql/*.png` show schema/data and output. |
| A4 scenario 1: A sends to B, B sends a similar amount (within 10%) back, both within 24 hours | Done | `sql/scenario1_round_trip_transfers.sql` - self join with 10% and 24 h conditions; 6 rows including boundary cases (exactly +10%, 23h59m) and excluded cases (12%, 24h01m). |
| A4 scenario 2: IPL 2024, players with 30+ runs in at least 3 consecutive matches; return name and streak start date | Done | `sql/scenario2_ipl_streaks.sql` - gaps-and-islands with `ROW_NUMBER()`; 5 rows. |

## Pages 3-4 - Section B (not chosen) and B4

| Document line | Status | Note |
|---|---|---|
| "Complete EITHER Section A OR Section B" | Done | Section A chosen. |
| B1 build an API, B2 automate it | Not applicable | Built anyway as an optional extra (`src/api`, 58 passing scenarios). |
| B3 UI tests against emicalculator.net | Not applicable | Not delivered (Section A chosen; the earlier draft was removed at the owner's request). |
| B4 SQL tests | Done | Identical to A4 (see above). |

## Verification performed

- Fresh `git clone` into an empty folder, `npm install`, then the suites: app 89/89, JSONPlaceholder 23/23, strict A3 24/24, SQL 6 and 5 rows, healing 5/5.
- Full run `npm test`: 207 scenarios, all pass, 0 failures.
- Mutation checks (deliberately breaking the app/API and confirming tests fail) for the app features and the validating API.
