const { Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');
const { LegacyEmiPage, BROKEN_LOCATORS } = require('../../pages/LegacyEmiPage');

// Where each broken locator's target really is today. Kept here (not in LegacyEmiPage) so the legacy page object stays broken.
const REAL_TARGET = {
  loanAmountInput: (page) => page.getByRole('textbox', { name: 'Loan amount (\u20B9)' }),
  interestRateInput: (page) => page.getByRole('textbox', { name: 'Interest rate (% per annum)' }),
  reportLink: (page) => page.getByRole('link', { name: 'Report', exact: true }),
  emiResult: (page) => page.getByTestId('kpi-emi'),
  pieChart: (page) => page.getByTestId('pie-chart'),
};

Then('the legacy locator {string} matches no element on the page', async function (key) {
  this.legacy = new LegacyEmiPage(this.page);
  this.legacyKey = key;
  const count = await this.legacy.locator(key).count();
  this.attach(`${key}: ${BROKEN_LOCATORS[key].selector} matched ${count} element(s)`);
  expect(count, `${key} should be broken (match nothing)`).toBe(0);
});

Then('the element it was meant for still exists on the page', async function () {
  const target = REAL_TARGET[this.legacyKey](this.page);
  await expect(target, 'the feature exists - only the selector has rotted').toHaveCount(1);
});

Then('every legacy locator records its selector, its kind and a stated intent', async function () {
  for (const [key, entry] of Object.entries(BROKEN_LOCATORS)) {
    expect(entry.selector, `${key} selector`).toBeTruthy();
    expect(['input', 'link', 'text', 'chart'], `${key} kind`).toContain(entry.kind);
    expect(entry.intent.length, `${key} intent`).toBeGreaterThan(15);
  }
});

Then('exactly {int} legacy locators are kept', async function (n) {
  expect(Object.keys(BROKEN_LOCATORS)).toHaveLength(n);
});
