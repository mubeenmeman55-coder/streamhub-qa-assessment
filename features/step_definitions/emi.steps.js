const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');
const { EmiCalculatorPage } = require('../../pages/EmiCalculatorPage');
const { summary, yearlySchedule } = require('../../utils/emi');
const { lakhs } = require('../../utils/parse');

const RUPEE_TOLERANCE = 1; // the site rounds each figure to a whole rupee

Given('I launch the EMI calculator', async function () {
  this.emiPage = new EmiCalculatorPage(this.page);
  await this.emiPage.open();
});

When('I open the {string} tab', async function (tab) {
  this.state.tab = tab;
  await this.emiPage.selectLoanTab(tab);
});

When(
  'I enter loan amount {string}, interest rate {string} and tenure {string} years',
  async function (amount, rate, years) {
    this.state.loan = { principal: lakhs(amount), rate: Number(rate), years: Number(years) };
    await this.emiPage.enterLoanDetails({ amount: this.state.loan.principal, rate, years });
  },
);

When(
  'I set the sliders to amount {string}, interest rate {string} and tenure {string} years',
  async function (amount, rate, years) {
    this.state.loan = { principal: lakhs(amount), rate: Number(rate), years: Number(years) };
    await this.emiPage.setSlider('amount', this.state.loan.principal);
    await this.emiPage.setSlider('rate', this.state.loan.rate);
    await this.emiPage.setSlider('tenure', this.state.loan.years);
  },
);

When('I choose {string} in the {string} calendar', async function (monthYear, _label) {
  const [month, year] = monthYear.split(' ');
  this.state.start = { month: EmiCalculatorPage.monthIndex(month), year: Number(year) };
  await this.emiPage.pickStartMonth(month, Number(year));
});

Then('the displayed EMI, total interest and total payment match my own calculation', async function () {
  const { principal, rate, years } = this.state.loan;
  const expected = summary(principal, rate, years);
  this.attach(`Expected (calculated in test): ${JSON.stringify(expected)}`);
  // poll: the page recalculates asynchronously after input
  await expect
    .poll(async () => (await this.emiPage.readSummary()).emi, { message: 'EMI shown by the app' })
    .toBeCloseTo(expected.emi, 0);
  const shown = await this.emiPage.readSummary();
  this.attach(`Displayed by app: ${JSON.stringify(shown)}`);
  expect(Math.abs(shown.emi - expected.emi)).toBeLessThanOrEqual(RUPEE_TOLERANCE);
  expect(Math.abs(shown.totalInterest - expected.totalInterest)).toBeLessThanOrEqual(RUPEE_TOLERANCE * 120);
  expect(Math.abs(shown.totalPayment - expected.totalPayment)).toBeLessThanOrEqual(RUPEE_TOLERANCE * 120);
  // EMI is shown rounded, so the app's totals are EMI*months - allow that rounding but nothing larger
  expect(shown.totalPayment - shown.totalInterest).toBe(principal);
});

// ---------- pie chart ----------
Then('the pie chart is visible', async function () {
  await expect(this.emiPage.pieChart).toBeVisible();
  await expect(this.emiPage.pieChart.locator('svg')).toBeVisible();
  expect(await this.emiPage.pieSlices.count(), 'pie slices').toBe(2);
});

Then('both pie chart sections have values greater than zero', async function () {
  const slices = await this.emiPage.readPieSlices();
  this.state.slices = slices;
  this.attach(`Pie sections: ${JSON.stringify(slices)}`);
  expect(slices).toHaveLength(2);
  for (const s of slices) expect(s.percent, `${s.label} must be > 0`).toBeGreaterThan(0);
  const data = await this.emiPage.readPieChartData();
  this.attach(`Pie chart data: ${JSON.stringify(data)}`);
  for (const d of data) expect(d.value, `${d.name} must be > 0`).toBeGreaterThan(0);
});

Then('the pie chart split matches the calculated principal and interest share', async function () {
  const { principal, rate, years } = this.state.loan;
  const { totalPayment } = summary(principal, rate, years);
  const expectedPrincipalPct = (principal / totalPayment) * 100;
  const byLabel = Object.fromEntries(this.state.slices.map((s) => [s.label, s.percent]));
  const principalPct = byLabel['Principal Loan Amount'];
  const interestPct = byLabel['Total Interest'];
  expect(principalPct, 'principal %').toBeCloseTo(expectedPrincipalPct, 0); // tooltip shows 1 decimal
  expect(principalPct + interestPct).toBeCloseTo(100, 0);
});

// ---------- bar chart ----------
Then('the bar chart is visible', async function () {
  await expect(this.emiPage.barChart).toBeVisible();
  await expect(this.emiPage.barChart.locator('svg')).toBeVisible();
  expect(await this.emiPage.barCount()).toBeGreaterThan(0);
});

Then('the bar chart has one interest bar and one principal bar for each year of the schedule', async function () {
  const { principal, rate, years } = this.state.loan;
  const { year, month } = this.state.start;
  const schedule = yearlySchedule(principal, rate, years, year, month);
  // the chart redraws after the calendar selection - wait for the expected bar count instead of sleeping
  await expect.poll(() => this.emiPage.barCount(), { message: 'bars in chart' }).toBe(schedule.length * 2);
  const total = await this.emiPage.barCount();
  this.attach(`Total bars in chart: ${total} (schedule spans ${schedule.length} calendar years)`);
  console.log(`      total bars in chart = ${total}`);
  expect(total).toBe(schedule.length * 2);
});

Then('the tooltip of the first bar matches the calculated schedule for the first year', async function () {
  const { principal, rate, years } = this.state.loan;
  const { year, month } = this.state.start;
  const first = yearlySchedule(principal, rate, years, year, month)[0];
  const tip = await this.emiPage.readBarTooltip(0);
  this.attach(`Tooltip: ${tip.raw.join(' | ')}`);
  console.log(`      bar tooltip = ${tip.raw.join(' | ')}`);
  expect(tip.year).toBe(first.year);
  expect(Math.abs(tip.interest - first.interest)).toBeLessThanOrEqual(RUPEE_TOLERANCE * 12);
  expect(Math.abs(tip.totalPayment - first.payment)).toBeLessThanOrEqual(RUPEE_TOLERANCE * 12);
  expect(tip.interest).toBeGreaterThan(0);
});
