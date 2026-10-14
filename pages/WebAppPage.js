const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');
const config = require('../config/env');
const { toNumber } = require('../utils/parse');

/** Page object for the EMI calculator web app built in this repo (src/webapp). */
class WebAppPage extends BasePage {
  constructor(page) {
    super(page);
    // form - located by accessible name (labels), not by id/position
    this.amount = page.getByRole('textbox', { name: 'Loan amount (₹)' });
    this.rate = page.getByRole('textbox', { name: 'Interest rate (% per annum)' });
    this.tenure = page.getByRole('textbox', { name: 'Loan tenure' });
    this.tenureUnit = page.getByRole('combobox', { name: 'Tenure unit' });
    this.startMonth = page.getByLabel('EMI start month');
    this.extra = page.getByRole('textbox', { name: 'Extra monthly payment (₹, optional)' });
    this.amountWords = page.getByTestId('amount-words');
    this.shareButton = page.getByRole('button', { name: 'Copy share link' });
    this.shareUrl = page.getByTestId('share-url');
    this.scenarioName = page.getByRole('textbox', { name: 'Scenario name' });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.savedItems = page.getByTestId('saved-item');
    this.savedEmpty = page.getByTestId('saved-empty');
    this.themeToggle = page.getByRole('button', { name: 'Toggle dark mode' });
    this.csvButton = page.getByRole('button', { name: 'Download CSV' });
    this.savings = page.getByTestId('savings');
    this.compareButton = page.getByRole('button', { name: 'Compare loans' });
    this.compareVerdict = page.getByTestId('compare-verdict');
    this.yearFormat = page.getByLabel('Year format');
    this.endOfMonthRadio = page.getByRole('radio', { name: 'End of month' });
    this.startOfMonthRadio = page.getByRole('radio', { name: 'Start of month' });
    this.monthRows = page.getByTestId('schedule-month-row');
    this.balancePoints = page.getByTestId('balance-point');
    this.balanceLine = page.getByTestId('balance-line');
    this.amountSlider = page.getByRole('slider', { name: 'Loan amount slider' });
    this.calculateButton = page.getByRole('button', { name: 'Calculate EMI' });
    this.resetButton = page.getByRole('button', { name: 'Reset' });

    // dashboard
    this.heading = page.getByRole('heading', { level: 1 });
    this.pieChart = page.getByTestId('pie-chart');
    this.pieSegments = { principal: page.getByTestId('pie-principal'), interest: page.getByTestId('pie-interest') };
    this.barChart = page.getByTestId('bar-chart');
    this.principalBars = page.getByTestId('bar-principal');
    this.interestBars = page.getByTestId('bar-interest');
    this.barTooltip = page.getByTestId('bar-tooltip');

    // report
    this.reportMode = page.getByLabel('View');
    this.reportYear = page.getByLabel('Year', { exact: true });
    this.scheduleRows = page.getByTestId('schedule-row');
    this.scheduleTotal = page.getByTestId('schedule-total');
    this.reportSummary = page.getByTestId('report-summary');
  }

  async open() {
    await this.page.goto(config.webappUrl, { waitUntil: 'domcontentloaded' });
    await expect(this.heading).toBeVisible();
  }

  async navigateTo(name) {
    await this.page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true }).click();
  }

  async enterLoan({ amount, rate, tenure, unit = 'Years', start, extra }) {
    await this.amount.fill(String(amount));
    await this.rate.fill(String(rate));
    await this.tenure.fill(String(tenure));
    await this.tenureUnit.selectOption({ label: unit });
    if (start) await this.startMonth.fill(start);
    if (extra !== undefined) await this.extra.fill(String(extra));
  }

  async calculate() {
    await this.calculateButton.click();
  }

  kpi(name) {
    return this.page.getByTestId(`kpi-${name}`);
  }

  /** Exact numbers are exposed in data-value so tests do not depend on locale formatting. */
  async kpiValue(name) {
    return Number(await this.kpi(name).getAttribute('data-value'));
  }

  async kpiText(name) {
    return this.kpi(name).innerText();
  }

  fieldError(field) {
    return this.page.getByTestId(`error-${field}`);
  }

  async pieValues() {
    return {
      principal: Number(await this.pieSegments.principal.getAttribute('data-value')),
      interest: Number(await this.pieSegments.interest.getAttribute('data-value')),
    };
  }

  /** [{year, principal, interest}] read from the bar chart's data attributes */
  async barData() {
    return this.principalBars.evaluateAll((principalBars) => {
      const interest = Object.fromEntries(
        [...document.querySelectorAll('[data-testid=bar-interest]')].map((b) => [b.dataset.year, Number(b.dataset.interest)]),
      );
      return principalBars.map((b) => ({ year: Number(b.dataset.year), principal: Number(b.dataset.principal), interest: interest[b.dataset.year] }));
    });
  }

  async hoverBar(index) {
    await this.principalBars.nth(index).hover();
    await expect(this.barTooltip).toBeVisible();
    return this.barTooltip.innerText();
  }

  async chooseReportView(mode) {
    await this.reportMode.selectOption({ label: mode });
  }

  async chooseReportYear(year) {
    await this.reportYear.selectOption(String(year));
  }

  async totalsRow() {
    const read = async (col) => Number(await this.scheduleTotal.locator(`[data-col=${col}]`).getAttribute('data-value'));
    return { paid: await read('paid'), principal: await read('principal'), interest: await read('interest') };
  }

  async fillCompare(which, { amount, rate, years }) {
    await this.page.getByRole('textbox', { name: `Loan ${which} amount` }).fill(String(amount));
    await this.page.getByRole('textbox', { name: `Loan ${which} rate` }).fill(String(rate));
    await this.page.getByRole('textbox', { name: `Loan ${which} tenure` }).fill(String(years));
  }

  /** exact value of a comparison cell, e.g. ('emi','a') or ('total','diff') */
  async compareValue(measure, col) {
    return Number(await this.page.getByTestId(`cmp-${measure}-${col}`).getAttribute('data-value'));
  }

  async lastRowClosingBalance() {
    return toNumber(await this.scheduleRows.last().locator('td').last().innerText());
  }
}

module.exports = { WebAppPage };
