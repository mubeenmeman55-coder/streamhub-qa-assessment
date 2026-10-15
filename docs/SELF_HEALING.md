# AI self-healing locators

## The broken locators (left broken on purpose)

Defined in [pages/LegacyEmiPage.js](../pages/LegacyEmiPage.js), exercised by `features/ui/self_healing_demo.feature` (tag `@broken`, excluded from the default run).

| # | Broken selector | Why it is brittle | Healed (POC output) |
|---|---|---|---|
| 1 | `#loan-amount` | stale id (the field is labelled "Loan amount (₹)") | `getByRole('textbox', { name: "Loan amount (₹)" })` |
| 2 | `xpath=//div[3]/form/div[2]/div/input` | positional XPath, dies when a wrapper changes | `getByRole('textbox', { name: "Interest rate (% per annum)" })` |
| 3 | `role=link[name="Reports page"]` | link text changed (it is "Report") | `getByTestId("nav-report")` |
| 4 | `.emi-result > span.value` | class path that no longer exists | `getByTestId("kpi-emi")` |
| 5 | `#emi-pie-chart canvas` | wrong container and element (the chart is SVG) | `getByTestId("pie-chart")` |

They target the EMI app built in this repo (`src/webapp`).

## Approach

**1. Detection.** Every locator carries an *intent* (what it is for) and a *kind* (input / link / text / chart).
A locator is "broken" when it resolves to 0 elements, or to more than 1, within a short timeout.
In CI the trigger is a failing step whose error is a locator timeout or strict-mode violation. Assertion
failures (wrong EMI value) are never healed, only locator failures.

**2. Context for the model.** Do not send the whole DOM. Take a compact snapshot of visible, relevant
elements: tag, type, role, id, name, label text, visible text, nearest *stable* ancestor id and its heading.
Auto-generated ids (`highcharts-x7f2…` style ids) are filtered out because they would produce a new brittle locator.

**3. Prompt.** Inputs: intent, expected kind, old selector, the candidate list. Rules in the prompt:
choose by purpose never by position; ignore the old selector's structure; answer only JSON
`{index, confidence, reason}`; return `-1` when unsure. Asking the model to *pick from candidates* rather than
invent a selector removes hallucinated selectors, the main failure mode seen in practice.

**4. Locator construction (not the model's job).** Code turns the chosen candidate into a locator using a
fixed preference order: an explicit `data-testid` first, then role + accessible name, then label, then stable container id, then text. Never positional.

**5. Validation before anything is applied.** In a real browser, the proposal must pass all of:
- matches exactly one element, and it is visible
- compatible with the expected kind
- behavioural probe: inputs accept typed text, text elements are a short *leaf* value containing a number, charts contain shapes
- model confidence at least 0.5

**6. Applying.** The POC only *reports* a suggestion (`reports/self-healing/healing-report.{json,md}`).
In a real pipeline it would open a PR with the one-line diff, re-run the affected scenario on the PR,
and require human review. Silent auto-edit is deliberately avoided: a healed locator that points at the wrong
element makes a test pass for the wrong reason, which is worse than a red test.

## POC

```bash
npm run heal                         # offline heuristic ranker + real browser validation
ANTHROPIC_API_KEY=... npm run heal   # LLM picks the candidate; validation is identical
npm run heal -- --prompt             # dry run: prints the exact prompt that would be sent, no API call
```

Verified: the offline mode heals 5 of 5 locators against the app (see
[reports/self-healing/healing-report.md](../reports/self-healing/healing-report.md)).

**A bug the POC had, found by reading its own output:** the first version healed the `.emi-result` locator to the whole KPI
container (`getByTestId("kpis")`) because "contains a number" was the only check for text. A container passes that test,
but it is not the EMI value. Fix: text candidates must be leaf elements and the probe also checks the element wraps nothing.
This is the reason validation is separate from the proposer and why a human still reviews the PR.
**Not verified:** the LLM mode (`llmRank` in `self-healing/heal.js`). I had no API key, so that path has not
been executed. If it errors, the script falls back to the heuristic ranker and records `llmError` in the report.

Limits: the heuristic ranker is word-overlap only, so it leans on descriptive intents and sensible ids/labels.
Validation proves the element behaves like the right kind, not that it is the right one among several
look-alikes (for example, two similar inputs). That is what the model's judgement plus PR review is for.
