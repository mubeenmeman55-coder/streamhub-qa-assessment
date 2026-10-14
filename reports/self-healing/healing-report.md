# Self-healing run

Mode: **offline heuristic + validation**  
Target: https://emicalculator.net

| Locator | Broken selector | Suggested (validated) |
|---|---|---|
| loanAmountInput | `#loan-amount` | `page.getByRole('textbox', { name: "Home Loan Amount" })` |
| interestRateInput | `xpath=//div[3]/form/div[2]/div/input` | `page.getByRole('textbox', { name: "Interest Rate" })` |
| personalLoanTab | `role=link[name="Personal Loans"]` | `page.getByRole('link', { name: "Personal Loan", exact: true })` |
| emiResult | `.emi-result > span.value` | `page.locator('#emiamount').locator('p')` |
| pieChart | `#emi-pie-chart canvas` | `page.locator('#emipiechart').locator('svg')` |
