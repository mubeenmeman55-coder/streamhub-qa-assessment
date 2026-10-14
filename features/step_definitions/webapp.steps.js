const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');
const { WebAppPage } = require('../../pages/WebAppPage');
const { summary, yearlySchedule } = require('../../utils/emi');

const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
const CENT = 0.05; // data-value attributes carry 2 decimals

/** Independent oracle for whatever loan the scenario last entered (utils/emi.js, not the app's code) */
function expectedFor(world) {
  const { principal, rate, months, startYear, startMonth } = world.state.loan;
  const years = months / 12;
  return { ...summary(principal, rate, years), schedule: yearlySchedule(principal, rate, years, startYear, startMonth) };
}

function rememberLoan(world, { amount, rate, tenure, unit, start = '2027-01' }) {
  const [startYear, month] = start.split('-').map(Number);
  const principal = Number(String(amount).replace(/,/g, ''));
  if (![principal, Number(rate), Number(tenure)].every(Number.isFinite) || String(rate).trim() === '') return; // invalid-input scenarios keep the last valid loan
  world.state.loan = {
    principal,
    rate: Number(rate),
    months: unit === 'Years' ? Number(tenure) * 12 : Number(tenure),
    startYear,
    startMonth: month - 1,
  };
}

Given('I open the EMI app', async function () {
  this.app = new WebAppPage(this.page);
  await this.app.open();
  this.state.loan = { principal: 2500000, rate: 10, months: 120, startYear: 2027, startMonth: 0 };
});

// ---------- dashboard ----------
Then('the page title contains {string}', async function (text) {
  await expect(this.page).toHaveTitle(new RegExp(text));
});

Then('the heading reads {string}', async function (text) {
  await expect(this.app.heading).toHaveText(text);
});

Then('the dashboard shows the monthly EMI, total interest, total payment and interest share', async function () {
  for (const k of ['emi', 'interest', 'total', 'share']) {
    await expect(this.app.kpi(k)).toBeVisible();
    expect(await this.app.kpiValue(k), `${k} KPI`).toBeGreaterThan(0);
  }
});

Then('the form is pre-filled with amount {string}, rate {string} and tenure {string} {string}', async function (amount, rate, tenure, unit) {
  await expect(this.app.amount).toHaveValue(amount);
  await expect(this.app.rate).toHaveValue(rate);
  await expect(this.app.tenure).toHaveValue(tenure);
  await expect(this.app.tenureUnit).toHaveValue(unit.toLowerCase());
});

When('I enter loan amount {string}, rate {string}, tenure {string} {string} and calculate', async function (amount, rate, tenure, unit) {
  this.state.emiBefore = await this.app.kpiValue('emi');
  await this.app.enterLoan({ amount, rate, tenure, unit });
  await this.app.calculate();
  rememberLoan(this, { amount, rate, tenure, unit });
});

When('I enter loan amount {string}, rate {string}, tenure {string} {string} starting {string} and calculate', async function (amount, rate, tenure, unit, start) {
  await this.app.enterLoan({ amount, rate, tenure, unit, start });
  await this.app.calculate();
  rememberLoan(this, { amount, rate, tenure, unit, start });
});

Then('the dashboard figures match my own calculation', async function () {
  const want = expectedFor(this);
  this.attach(`Expected (independent calculation): EMI ${want.emi.toFixed(2)}, interest ${want.totalInterest.toFixed(2)}, total ${want.totalPayment.toFixed(2)}`);
  expect(Math.abs((await this.app.kpiValue('emi')) - want.emi)).toBeLessThan(CENT);
  expect(Math.abs((await this.app.kpiValue('interest')) - want.totalInterest)).toBeLessThan(CENT);
  expect(Math.abs((await this.app.kpiValue('total')) - want.totalPayment)).toBeLessThan(CENT);
  // and what the user actually reads on screen
  expect(await this.app.kpiText('emi')).toBe(inr(want.emi));
  expect(await this.app.kpiText('interest')).toBe(inr(want.totalInterest));
  expect(await this.app.kpiText('total')).toBe(inr(want.totalPayment));
});

// ---------- pie ----------
Then('the app shows a visible pie chart', async function () {
  await expect(this.app.pieChart).toBeVisible();
  await expect(this.app.pieSegments.principal).toBeAttached();
  await expect(this.app.pieSegments.interest).toBeAttached();
});

Then('both pie segments are greater than zero and add up to 100 percent', async function () {
  const { principal, interest } = await this.app.pieValues();
  this.attach(`Pie: principal ${principal}%, interest ${interest}%`);
  expect(principal).toBeGreaterThan(0);
  expect(interest).toBeGreaterThan(0);
  expect(principal + interest).toBeCloseTo(100, 1);
});

Then('the pie split matches the calculated principal and interest share', async function () {
  const want = expectedFor(this);
  const { principal } = this.state.loan;
  const { principal: pct } = await this.app.pieValues();
  expect(pct).toBeCloseTo((principal / want.totalPayment) * 100, 1);
});

// ---------- bars ----------
Then('the bar chart is visible with one stacked bar per calendar year', async function () {
  await expect(this.app.barChart).toBeVisible();
  const want = expectedFor(this);
  await expect(this.app.principalBars).toHaveCount(want.schedule.length);
  await expect(this.app.interestBars).toHaveCount(want.schedule.length);
  this.attach(`Bars: ${want.schedule.length} calendar years (${want.schedule[0].year}-${want.schedule.at(-1).year})`);
});

Then('every bar has principal and interest greater than zero', async function () {
  for (const bar of await this.app.barData()) {
    expect(bar.principal, `${bar.year} principal`).toBeGreaterThan(0);
    expect(bar.interest, `${bar.year} interest`).toBeGreaterThan(0);
  }
});

Then('the bars add up to the loan amount and the total interest', async function () {
  const bars = await this.app.barData();
  const want = expectedFor(this);
  const sum = (k) => bars.reduce((a, b) => a + b[k], 0);
  expect(Math.abs(sum('principal') - this.state.loan.principal)).toBeLessThan(CENT * bars.length);
  expect(Math.abs(sum('interest') - want.totalInterest)).toBeLessThan(CENT * bars.length);
  // each bar also matches the independently computed year
  bars.forEach((b, i) => {
    expect(b.year).toBe(want.schedule[i].year);
    expect(Math.abs(b.interest - want.schedule[i].interest)).toBeLessThan(CENT);
  });
});

When('I hover the first bar', async function () {
  this.state.tooltip = await this.app.hoverBar(0);
});

Then('the tooltip shows year {int} with principal and interest matching my calculation', async function (year) {
  const first = expectedFor(this).schedule[0];
  this.attach(`Tooltip: ${this.state.tooltip.replace(/\n/g, ' | ')}`);
  expect(first.year).toBe(year);
  expect(this.state.tooltip).toContain(String(year));
  expect(this.state.tooltip).toContain(`Principal: ${inr(first.principal)}`);
  expect(this.state.tooltip).toContain(`Interest: ${inr(first.interest)}`);
});

Then('the chart spans {int} calendar years from {int} to {int}', async function (count, from, to) {
  const years = (await this.app.barData()).map((b) => b.year);
  expect(years).toHaveLength(count);
  expect(years[0]).toBe(from);
  expect(years.at(-1)).toBe(to);
});

// ---------- slider ----------
When('I press End on the loan amount slider', async function () {
  await this.app.amountSlider.focus();
  await this.page.keyboard.press('End');
});

Then('the loan amount field shows {string}', async function (value) {
  await expect(this.app.amount).toHaveValue(value);
});

// ---------- report ----------
When('I open the {string} page of the app', async function (name) {
  await this.app.navigateTo(name);
});

Then('the schedule has one row per calendar year', async function () {
  await expect(this.app.scheduleRows).toHaveCount(expectedFor(this).schedule.length);
});

Then('the schedule totals equal the loan amount and total interest', async function () {
  const totals = await this.app.totalsRow();
  const want = expectedFor(this);
  expect(Math.abs(totals.principal - this.state.loan.principal)).toBeLessThan(CENT * 10);
  expect(Math.abs(totals.interest - want.totalInterest)).toBeLessThan(CENT * 10);
  expect(Math.abs(totals.paid - want.totalPayment)).toBeLessThan(CENT * 10);
});

Then('the final closing balance is zero', async function () {
  expect(await this.app.lastRowClosingBalance()).toBe(0);
});

When('I switch the report to {string} for year {string}', async function (mode, year) {
  await this.app.chooseReportView(mode);
  await this.app.chooseReportYear(year);
});

Then('the schedule shows {int} monthly rows', async function (n) {
  await expect(this.app.scheduleRows).toHaveCount(n);
});

Then('the report summary says {string}', async function (text) {
  await expect(this.app.reportSummary).toHaveText(text);
});

Then("the monthly rows add up to that year's yearly interest", async function () {
  const year = 2030;
  const want = expectedFor(this).schedule.find((y) => y.year === year);
  const rows = await this.app.scheduleRows.evaluateAll((els) => els.map((e) => Number(e.dataset.interest)));
  const sum = rows.reduce((a, b) => a + b, 0);
  expect(Math.abs(sum - want.interest)).toBeLessThan(CENT * 12);
});

// ---------- validation / reset ----------
Then('the {string} field shows the error {string}', async function (field, message) {
  await expect(this.app.fieldError(field)).toHaveText(message);
});

Then('the dashboard still shows the previous EMI', async function () {
  expect(await this.app.kpiValue('emi')).toBe(this.state.emiBefore);
  expect(Number.isNaN(await this.app.kpiValue('emi'))).toBe(false);
});

When('I reset the form', async function () {
  await this.app.resetButton.click();
  this.state.loan = { principal: 2500000, rate: 10, months: 120, startYear: 2027, startMonth: 0 };
});
