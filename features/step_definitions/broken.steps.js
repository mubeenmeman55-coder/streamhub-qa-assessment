const { When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');
const { LegacyEmiPage } = require('../../pages/LegacyEmiPage');

// Short timeout so the expected failure is quick
const FAST = { timeout: 3000 };

When('I use the legacy locators to enter amount {string} and rate {string}', async function (amount, rate) {
  this.legacy = new LegacyEmiPage(this.page);
  await this.legacy.locator('loanAmountInput').fill(amount, FAST);
  await this.legacy.locator('interestRateInput').fill(rate, FAST);
});

Then('the legacy EMI result and pie chart are visible', async function () {
  await expect(this.legacy.locator('emiResult')).toBeVisible(FAST);
  await expect(this.legacy.locator('pieChart')).toBeVisible(FAST);
});

Then('the legacy Personal Loan tab can be opened', async function () {
  await this.legacy.locator('personalLoanTab').click(FAST);
});
