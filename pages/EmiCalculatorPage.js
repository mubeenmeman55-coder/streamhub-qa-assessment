const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');
const { toNumber } = require('../utils/parse');

const SLIDER_IDS = { amount: 'loanamountslider', rate: 'loaninterestslider', tenure: 'loantermslider' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

class EmiCalculatorPage extends BasePage {
  constructor(page) {
    super(page);
    // Form fields: located by their visible labels (survives layout/id changes)
    this.amountInput = page.getByRole('textbox', { name: /Loan Amount$/ });
    this.rateInput = page.getByRole('textbox', { name: 'Interest Rate' });
    this.tenureInput = page.getByRole('textbox', { name: 'Loan Tenure' });
    this.startMonthInput = page.getByRole('textbox', { name: 'Schedule showing EMI payments starting from' });

    // Charts: Highcharts renders SVG inside a stable container
    this.pieChart = page.locator('#emipiechart');
    this.pieSlices = this.pieChart.locator('.highcharts-pie-series path.highcharts-point');
    this.barChart = page.locator('#emibarchart');
    this.bars = this.barChart.locator('.highcharts-series-group .highcharts-column-series .highcharts-point');

    this.datepicker = page.locator('.datepicker-months');
  }

  async open() {
    await this.goto('/');
    await expect(this.page).toHaveTitle(/EMI Calculator/i);
    await expect(this.amountInput).toBeVisible();
  }

  loanTab(name) {
    return this.page.locator('.loanproduct-nav').getByRole('link', { name, exact: true });
  }

  async selectLoanTab(name) {
    await this.loanTab(name).click();
    await expect(this.page.getByRole('textbox', { name: `${name} Amount` })).toBeVisible();
    await expect(this.page.locator('.loanproduct-nav li').filter({ has: this.page.getByRole('link', { name, exact: true }) })).toHaveClass(/active/);
  }

  // ----- typed input -----
  async enterLoanDetails({ amount, rate, years }) {
    await this.#type(this.amountInput, amount);
    await this.#type(this.rateInput, rate);
    await this.#type(this.tenureInput, years);
  }

  async #type(input, value) {
    await input.fill(String(value));
    await input.press('Tab'); // blur triggers the recalculation
  }

  // ----- slider interaction -----
  /** Drag/click a jQuery-UI slider to `value`, then fine-tune with arrow keys until the text field agrees. */
  async setSlider(kind, value) {
    const slider = this.page.locator(`#${SLIDER_IDS[kind]}`);
    const ticks = await this.page.locator(`#${SLIDER_IDS[kind].replace('slider', 'steps')} .marker`).allTextContents();
    const toValue = (t) => (/L$/i.test(t) ? parseFloat(t) * 100000 : parseFloat(t));
    const min = toValue(ticks[0]);
    const max = toValue(ticks[ticks.length - 1]);
    expect(value, `${kind} ${value} outside slider range ${min}-${max}`).toBeGreaterThanOrEqual(min);
    expect(value).toBeLessThanOrEqual(max);

    const box = await slider.boundingBox();
    const ratio = (value - min) / (max - min);
    await this.page.mouse.click(box.x + box.width * ratio, box.y + box.height / 2);

    const input = { amount: this.amountInput, rate: this.rateInput, tenure: this.tenureInput }[kind];
    const handle = slider.locator('.ui-slider-handle');
    await handle.focus();
    for (let i = 0; i < 100; i++) {
      const current = toNumber(await input.inputValue());
      if (Math.abs(current - value) < 1e-9) return;
      await this.page.keyboard.press(current < value ? 'ArrowRight' : 'ArrowLeft');
    }
    throw new Error(`Slider "${kind}" could not reach ${value}; field shows "${await input.inputValue()}"`);
  }

  // ----- schedule start month (calendar widget) -----
  async pickStartMonth(monthName, year) {
    await this.startMonthInput.click();
    await expect(this.datepicker).toBeVisible();
    const yearSwitch = this.datepicker.locator('.datepicker-switch');
    for (let guard = 0; guard < 50; guard++) {
      const shown = Number(await yearSwitch.innerText());
      if (shown === year) break;
      await this.datepicker.locator(shown < year ? '.next' : '.prev').click();
    }
    await expect(yearSwitch).toHaveText(String(year));
    await this.datepicker.getByText(monthName, { exact: true }).click();
    await expect(this.startMonthInput).toHaveValue(new RegExp(`${monthName}\\s+${year}`));
  }

  static monthIndex(name) {
    return MONTHS.indexOf(name);
  }

  // ----- results -----
  summaryValue(heading) {
    return this.page
      .locator('#emipaymentsummary')
      .locator('div')
      .filter({ has: this.page.getByRole('heading', { name: heading }) })
      .locator('p');
  }

  async readSummary() {
    return {
      emi: toNumber(await this.summaryValue('Loan EMI').innerText()),
      totalInterest: toNumber(await this.summaryValue('Total Interest Payable').innerText()),
      totalPayment: toNumber(await this.summaryValue('Total Payment').innerText()),
    };
  }

  // ----- pie chart -----
  /** Hover each slice and parse its tooltip, e.g. "Total Interest: 53.7%" */
  async readPieSlices() {
    const count = await this.pieSlices.count();
    const out = [];
    const tip = this.pieChart.locator('.highcharts-tooltip');
    for (let i = 0; i < count; i++) {
      const previous = out.length ? out[out.length - 1].raw : null;
      // a slice's bounding-box centre can lie over its neighbour, so aim at a point on the slice's own arc
      const at = await this.#pointInSlice(i);
      await this.page.mouse.move(at.x, at.y);
      await expect(tip).toBeVisible();
      // the tooltip is reused between slices - wait until it shows a different slice than the last one read
      await expect.poll(async () => (await tip.textContent()).trim(), { message: `pie tooltip for slice ${i}` }).not.toBe(previous);
      const text = (await tip.textContent()).trim();
      const m = /^(.*?):\s*([\d.]+)%/.exec(text);
      if (!m) throw new Error(`Unexpected pie tooltip "${text}"`);
      out.push({ label: m[1].trim(), percent: Number(m[2]), raw: text });
    }
    return out;
  }

  async #pointInSlice(index) {
    await this.pieChart.scrollIntoViewIfNeeded();
    return this.page.evaluate((i) => {
      const chart = window.Highcharts.charts.find((c) => c && c.renderTo.id === 'emipiechart');
      const series = chart.series[0];
      const { start, end } = series.points[i].shapeArgs;
      const mid = (start + end) / 2;
      const [cx, cy, size] = series.center;
      const rect = chart.container.getBoundingClientRect();
      return { x: rect.left + cx + Math.cos(mid) * size * 0.35, y: rect.top + cy + Math.sin(mid) * size * 0.35 };
    }, index);
  }

  /** Underlying chart data as plotted by Highcharts (absolute amounts) - used as a cross-check */
  async readPieChartData() {
    return this.page.evaluate(() => {
      const chart = window.Highcharts.charts.find((c) => c && c.renderTo.id === 'emipiechart');
      return chart.series[0].points.map((p) => ({ name: p.name, value: p.y }));
    });
  }

  // ----- bar chart -----
  async barCount() {
    return this.bars.count();
  }

  /** Hover one bar and parse "Year : 2027 / Interest : ₹ 11,000 / Total Payment : ₹ 70,000" */
  async readBarTooltip(index) {
    await this.bars.nth(index).scrollIntoViewIfNeeded();
    await this.bars.nth(index).hover({ force: true });
    const tip = this.barChart.locator('.highcharts-tooltip');
    await expect(tip).toBeVisible();
    const raw = (await tip.locator('tspan').allTextContents()).map((s) => s.trim());
    const parsed = {};
    for (const line of raw) {
      const [k, ...rest] = line.split(':');
      parsed[k.trim()] = rest.join(':').trim();
    }
    return { raw, year: Number(parsed.Year), interest: toNumber(parsed.Interest), totalPayment: toNumber(parsed['Total Payment']) };
  }
}

module.exports = { EmiCalculatorPage };
