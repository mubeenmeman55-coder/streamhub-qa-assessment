// Steps for emi_app_features.feature and emi_app_dynamic.feature
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');
const { WebAppPage } = require('../../pages/WebAppPage');
const { summary, yearlySchedule, prepayment } = require('../../utils/emi');
const { toNumber } = require('../../utils/parse');

const CENT = 0.05;
const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
const loanOf = (w) => w.state.loan;
const yearsOf = (w) => loanOf(w).months / 12;
const schedule = (w, opts = {}) => {
  const l = loanOf(w);
  return yearlySchedule(l.principal, l.rate, yearsOf(w), l.startYear, l.startMonth, { advance: w.state.advance === true, fy: w.state.fy === true, ...opts });
};
const PRODUCT_DEFAULTS = {
  'Home loan': { principal: 2500000, rate: 10, months: 120 },
  'Personal loan': { principal: 500000, rate: 12, months: 36 },
  'Car loan': { principal: 800000, rate: 9, months: 60 },
};

// ---------- amount in words / live typing ----------
When('I type {string} in the loan amount field', async function (value) {
  await this.app.amount.fill(value);
  const n = Number(value.replace(/,/g, ''));
  if (Number.isFinite(n)) this.state.loan = { ...loanOf(this), principal: n };
});

Then('the amount in words reads {string}', async function (words) {
  await expect(this.app.amountWords).toHaveText(words);
});

Then('the EMI updates by itself to match my own calculation', async function () {
  const want = summary(loanOf(this).principal, loanOf(this).rate, yearsOf(this), this.state.advance === true);
  await expect.poll(async () => this.app.kpiValue('emi'), { message: 'EMI should update without pressing Calculate' }).toBeCloseTo(want.emi, 1);
  expect(Math.abs((await this.app.kpiValue('interest')) - want.totalInterest)).toBeLessThan(CENT);
});

Then('the EMI still shows the figure for {word}', async function (amount) {
  const want = summary(Number(amount.replace(/,/g, '')), loanOf(this).rate, yearsOf(this));
  await this.page.waitForTimeout(500); // let any (wrong) live update land before asserting it did not
  expect(await this.app.kpiValue('emi')).toBeCloseTo(want.emi, 1);
});

When('I press ArrowRight {int} times on the loan amount slider', async function (times) {
  await this.app.amountSlider.focus();
  for (let i = 0; i < times; i++) await this.page.keyboard.press('ArrowRight');
  this.state.loan = { ...loanOf(this), principal: 2500000 + times * 50000 };
});

// ---------- prepayment ----------
Then('the prepayment impact is shown', async function () {
  await expect(this.app.savings).toBeVisible();
});

Then('the prepayment impact is not shown', async function () {
  await expect(this.app.savings).toBeHidden();
});

function prepayOracle(w) {
  const l = loanOf(w);
  return prepayment(l.principal, l.rate, yearsOf(w), l.extra);
}

Then('the interest saved and months saved match my own calculation', async function () {
  const want = prepayOracle(this);
  const savedInterest = Number(await this.page.getByTestId('saved-interest').getAttribute('data-value'));
  const savedMonths = Number(await this.page.getByTestId('saved-months').getAttribute('data-value'));
  const actual = Number(await this.page.getByTestId('actual-months').getAttribute('data-value'));
  this.attach(`Oracle: ends after ${want.months} months, saves ${want.monthsSaved} months and ${want.interestSaved.toFixed(2)} interest`);
  expect(actual).toBe(want.months);
  expect(savedMonths).toBe(want.monthsSaved);
  expect(Math.abs(savedInterest - want.interestSaved)).toBeLessThan(CENT * 20);
});

Then('the dashboard interest and total payment reflect the prepayment', async function () {
  const want = prepayOracle(this);
  const l = loanOf(this);
  expect(Math.abs((await this.app.kpiValue('interest')) - want.totalInterest)).toBeLessThan(CENT * 20);
  expect(Math.abs((await this.app.kpiValue('total')) - (l.principal + want.totalInterest))).toBeLessThan(CENT * 20);
  expect(Math.abs((await this.app.kpiValue('emi')) - summary(l.principal, l.rate, yearsOf(this)).emi)).toBeLessThan(CENT); // EMI itself is unchanged
});

Then('the bar chart spans only the years the shortened loan actually runs', async function () {
  const l = loanOf(this);
  const months = prepayOracle(this).months;
  const expectedYears = Math.floor((l.startMonth + months - 1) / 12) + 1;
  await expect(this.app.principalBars).toHaveCount(expectedYears);
  const years = (await this.app.barData()).map((b) => b.year);
  expect(years.at(-1)).toBe(l.startYear + Math.floor((l.startMonth + months - 1) / 12));
});

Then('the schedule totals equal the prepayment principal and interest', async function () {
  const want = prepayOracle(this);
  const totals = await this.app.totalsRow();
  expect(Math.abs(totals.principal - loanOf(this).principal)).toBeLessThan(CENT * 20);
  expect(Math.abs(totals.interest - want.totalInterest)).toBeLessThan(CENT * 20);
});

// ---------- EMI timing ----------
When('I choose to pay the EMI at the start of the month', async function () {
  await this.app.startOfMonthRadio.check();
  this.state.advance = true;
});

Then('the EMI equals the end-of-month EMI divided by one plus the monthly rate', async function () {
  const l = loanOf(this);
  const arrears = summary(l.principal, l.rate, yearsOf(this), false).emi;
  const r = l.rate / 12 / 100;
  await expect.poll(async () => this.app.kpiValue('emi')).toBeCloseTo(arrears / (1 + r), 1);
  expect(await this.app.kpiValue('emi')).toBeLessThan(arrears);
});

// ---------- loan types ----------
When('I choose the {string} loan type', async function (type) {
  await this.page.getByRole('tab', { name: type, exact: true }).click();
  this.state.loan = { ...loanOf(this), ...PRODUCT_DEFAULTS[type], extra: 0 };
});

Then('the {string} loan type is selected', async function (type) {
  await expect(this.page.getByRole('tab', { name: type, exact: true })).toHaveAttribute('aria-selected', 'true');
});

Then('the amount slider maximum is {int}', async function (max) {
  await expect(this.app.amountSlider).toHaveAttribute('max', String(max));
});

// ---------- compare ----------
When('I compare loan A {string} at {string} for {string} years with loan B {string} at {string} for {string} years', async function (aAmt, aRate, aYears, bAmt, bRate, bYears) {
  this.state.compare = {
    a: { principal: Number(aAmt.replace(/,/g, '')), rate: Number(aRate), years: Number(aYears) },
    b: { principal: Number(bAmt.replace(/,/g, '')), rate: Number(bRate), years: Number(bYears) },
  };
  await this.app.fillCompare('A', { amount: aAmt, rate: aRate, years: aYears });
  await this.app.fillCompare('B', { amount: bAmt, rate: bRate, years: bYears });
  await this.app.compareButton.click();
});

Then('every comparison figure matches my own calculation', async function () {
  const { a, b } = this.state.compare;
  const sa = summary(a.principal, a.rate, a.years), sb = summary(b.principal, b.rate, b.years);
  const rows = { emi: [sa.emi, sb.emi], interest: [sa.totalInterest, sb.totalInterest], total: [sa.totalPayment, sb.totalPayment], months: [a.years * 12, b.years * 12] };
  for (const [measure, [av, bv]] of Object.entries(rows)) {
    expect(Math.abs((await this.app.compareValue(measure, 'a')) - av), `${measure} A`).toBeLessThan(CENT);
    expect(Math.abs((await this.app.compareValue(measure, 'b')) - bv), `${measure} B`).toBeLessThan(CENT);
    expect(Math.abs((await this.app.compareValue(measure, 'diff')) - (bv - av)), `${measure} B-A`).toBeLessThan(CENT * 2);
  }
  this.attach(`Compare oracle: total A ${sa.totalPayment.toFixed(2)}, total B ${sb.totalPayment.toFixed(2)}`);
});

Then('the verdict says loan {string} is cheaper overall', async function (winner) {
  await expect(this.app.compareVerdict).toHaveAttribute('data-winner', winner);
  await expect(this.app.compareVerdict).toContainText(`Loan ${winner} is cheaper overall`);
  const { a, b } = this.state.compare;
  const diff = Math.abs(summary(a.principal, a.rate, a.years).totalPayment - summary(b.principal, b.rate, b.years).totalPayment);
  await expect(this.app.compareVerdict).toContainText(inr(diff));
});

Then('the comparison shows the error {string}', async function (message) {
  await expect(this.page.getByTestId('error-compare')).toHaveText(message);
  await expect(this.page.getByTestId('compare-table')).toBeHidden();
});

When('I use the current loan as loan A', async function () {
  await this.page.getByRole('button', { name: 'Use current loan as Loan A' }).click();
});

Then('loan A in the comparison is {string} at {string} for {string} years', async function (amount, rate, years) {
  await expect(this.page.getByRole('textbox', { name: 'Loan A amount' })).toHaveValue(amount);
  await expect(this.page.getByRole('textbox', { name: 'Loan A rate' })).toHaveValue(rate);
  await expect(this.page.getByRole('textbox', { name: 'Loan A tenure' })).toHaveValue(years);
});

// ---------- CSV ----------
When('I download the schedule as CSV', async function () {
  const [download] = await Promise.all([this.page.waitForEvent('download'), this.app.csvButton.click()]);
  this.state.csvName = download.suggestedFilename();
  const file = path.join(os.tmpdir(), `${Date.now()}-${this.state.csvName}`);
  await download.saveAs(file);
  this.state.csv = fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => l.split(','));
  fs.unlinkSync(file);
});

Then('the file is named {string}', async function (name) {
  expect(this.state.csvName).toBe(name);
});

Then('the CSV has a header and {int} monthly rows', async function (n) {
  const [header, ...rows] = this.state.csv;
  expect(header).toEqual(['Period', 'Opening balance', 'EMI paid', 'Principal', 'Interest', 'Closing balance']);
  expect(rows).toHaveLength(n);
  expect(rows[0][0]).toBe('Jan 2030');
});

Then("the CSV interest adds up to that year's yearly interest", async function () {
  const [, ...rows] = this.state.csv;
  const sum = rows.reduce((a, r) => a + Number(r[4]), 0);
  const year2030 = schedule(this).find((y) => y.year === 2030);
  expect(Math.abs(sum - year2030.interest)).toBeLessThan(0.12);
});

// ---------- saved scenarios ----------
When('I save the scenario as {string}', async function (name) {
  await this.app.scenarioName.fill(name);
  await this.app.saveButton.click();
  (this.state.savedLoans ??= {})[name] = { ...loanOf(this) };
});

Then('the saved list shows {string}', async function (name) {
  await expect(this.app.savedItems.filter({ hasText: name })).toHaveCount(1);
});

When('I reload the app', async function () {
  await this.page.reload();
  this.app = new WebAppPage(this.page);
  await expect(this.app.heading).toBeVisible();
});

When('I load the saved scenario {string}', async function (name) {
  await this.page.getByRole('button', { name: `Load scenario ${name}` }).click();
  this.state.loan = this.state.savedLoans[name];
});

When('I delete the saved scenario {string}', async function (name) {
  await this.page.getByRole('button', { name: `Delete scenario ${name}` }).click();
});

Then('the saved list is empty', async function () {
  await expect(this.app.savedItems).toHaveCount(0);
  await expect(this.app.savedEmpty).toBeVisible();
});

Then('the save error says {string}', async function (message) {
  await expect(this.page.getByTestId('error-save')).toHaveText(message);
});

// ---------- share link ----------
When('I copy the share link', async function () {
  await this.context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await this.app.shareButton.click();
  await expect(this.app.shareUrl).toBeVisible();
  this.state.shareUrl = await this.app.shareUrl.inputValue();
});

Then('the share link contains the loan details', async function () {
  const url = new URL(this.state.shareUrl);
  expect(url.searchParams.get('amount')).toBe('50,00,000');
  expect(url.searchParams.get('rate')).toBe('7.5');
  expect(url.searchParams.get('tenure')).toBe('15');
  expect(url.searchParams.get('extra')).toBe('2000');
});

When('I open the share link', async function () {
  await this.page.goto(this.state.shareUrl);
  this.app = new WebAppPage(this.page);
  await expect(this.app.heading).toBeVisible();
});

Then('the extra payment field shows {string}', async function (value) {
  await expect(this.app.extra).toHaveValue(value);
});

// ---------- theme ----------
When('I toggle the theme', async function () {
  await this.app.themeToggle.click();
});

Then('the app is in {string} mode', async function (mode) {
  await expect(this.page.locator('html')).toHaveAttribute('data-theme', mode);
  await expect(this.app.themeToggle).toHaveAttribute('aria-pressed', String(mode === 'dark'));
});

// ---------- financial year ----------
When('I switch the year format to {string}', async function (label) {
  await this.app.yearFormat.selectOption({ label });
  this.state.fy = label.startsWith('Financial');
});

Then('the schedule rows are labelled as financial years starting {string}', async function (first) {
  await expect(this.app.scheduleRows.first()).toHaveAttribute('data-period', first);
  await expect(this.app.scheduleRows).toHaveCount(schedule(this).length);
});

Then('the financial-year rows match my own calculation', async function () {
  const want = schedule(this);
  const got = await this.app.scheduleRows.evaluateAll((els) => els.map((e) => ({ period: e.dataset.period, interest: Number(e.dataset.interest), principal: Number(e.dataset.principal) })));
  expect(got).toHaveLength(want.length);
  want.forEach((w, i) => {
    expect(got[i].period).toBe(`FY ${w.year}-${String(w.year + 1).slice(2)}`);
    expect(Math.abs(got[i].interest - w.interest)).toBeLessThan(CENT);
    expect(Math.abs(got[i].principal - w.principal)).toBeLessThan(CENT);
  });
  expect(want[0].months).toBe(3); // Jan-Mar 2027 belong to FY 2026-27
});

Then('the bar chart has one stacked bar per financial year', async function () {
  const want = schedule(this);
  await expect(this.app.principalBars).toHaveCount(want.length);
  const years = (await this.app.barData()).map((b) => b.year);
  expect(years).toEqual(want.map((w) => w.year));
});

// ---------- drill-down ----------
When('I expand the year {string}', async function (year) {
  await this.page.getByRole('button', { name: `Show months for ${year}` }).click();
  this.state.expanded = year;
});

Then('the schedule shows {int} month rows under that year', async function (n) {
  await expect(this.app.monthRows).toHaveCount(n);
  await expect(this.page.getByRole('button', { name: `Hide months for ${this.state.expanded}` })).toHaveAttribute('aria-expanded', 'true');
});

Then("the month rows add up to that year's yearly row", async function () {
  const months = await this.app.monthRows.evaluateAll((els) => els.map((e) => ({ i: Number(e.dataset.interest), p: Number(e.dataset.principal) })));
  const yearly = this.app.scheduleRows.filter({ has: this.page.getByRole('button', { name: `Hide months for ${this.state.expanded}` }) });
  const yi = Number(await yearly.getAttribute('data-interest')), yp = Number(await yearly.getAttribute('data-principal'));
  expect(Math.abs(months.reduce((a, m) => a + m.i, 0) - yi)).toBeLessThan(0.12);
  expect(Math.abs(months.reduce((a, m) => a + m.p, 0) - yp)).toBeLessThan(0.12);
});

Then('the yearly row count is still {int}', async function (n) {
  await expect(this.app.scheduleRows).toHaveCount(n);
});

When('I collapse the year {string}', async function (year) {
  await this.page.getByRole('button', { name: `Hide months for ${year}` }).click();
});

Then('no month rows are shown', async function () {
  await expect(this.app.monthRows).toHaveCount(0);
});

// ---------- balance line ----------
Then('the balance line is drawn with one point per year', async function () {
  await expect(this.app.balanceLine).toBeVisible();
  await expect(this.app.balancePoints).toHaveCount(schedule(this).length);
});

async function balances(world) {
  return world.app.balancePoints.evaluateAll((els) => els.map((e) => Number(e.dataset.balance)));
}

Then('the balance falls every year and ends at zero', async function () {
  const b = await balances(this);
  for (let i = 1; i < b.length; i++) expect(b[i]).toBeLessThan(b[i - 1]);
  expect(b[0]).toBeLessThan(loanOf(this).principal);
  expect(Math.abs(b.at(-1))).toBeLessThan(CENT);
});

Then('the year-end balances match my own calculation', async function () {
  const want = schedule(this);
  const got = await balances(this);
  want.forEach((w, i) => expect(Math.abs(got[i] - w.closing), `year ${w.year}`).toBeLessThan(CENT));
});
