# Self-healing run

Mode: **offline heuristic + validation**  
Target: http://localhost:3300

| Locator | Broken selector | Suggested (validated) |
|---|---|---|
| loanAmountInput | `#loan-amount` | `page.getByRole('textbox', { name: "Loan amount (₹)" })` |
| interestRateInput | `xpath=//div[3]/form/div[2]/div/input` | `page.getByRole('textbox', { name: "Interest rate (% per annum)" })` |
| reportLink | `role=link[name="Reports page"]` | `page.getByTestId("nav-report")` |
| emiResult | `.emi-result > span.value` | `page.getByTestId("kpi-emi")` |
| pieChart | `#emi-pie-chart canvas` | `page.getByTestId("pie-chart")` |
