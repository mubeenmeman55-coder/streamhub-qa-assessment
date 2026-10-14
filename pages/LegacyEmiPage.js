/**
 * INTENTIONALLY BROKEN LOCATORS - part of the AI self-healing exercise (see docs/SELF_HEALING.md).
 * These are left broken on purpose. Run `npm run test:broken` to watch them fail and `npm run heal`
 * to see the proof-of-concept propose validated replacements. Do NOT "fix" them by hand.
 *
 * `intent` is the human-readable purpose of each locator: the stable thing an AI can reason about
 * when the selector itself has rotted.
 */
const BROKEN_LOCATORS = {
  loanAmountInput: {
    // brittle #1: stale id (real id is "loanamount")
    selector: '#loan-amount',
    kind: 'input',
    intent: 'Text box where the user types the home loan amount',
  },
  interestRateInput: {
    // brittle #2: positional XPath that breaks as soon as a parent wrapper is added/removed
    selector: 'xpath=//div[3]/form/div[2]/div/input',
    kind: 'input',
    intent: 'Text box where the user types the interest rate in percent',
  },
  personalLoanTab: {
    // brittle #3: text that no longer matches (real tab is called "Personal Loan")
    selector: 'role=link[name="Personal Loans"]',
    kind: 'link',
    intent: 'Tab link that switches the calculator to Personal Loan',
  },
  emiResult: {
    // brittle #4: class-based path that does not exist any more
    selector: '.emi-result > span.value',
    kind: 'text',
    intent: 'Monthly Loan EMI amount shown in the payment summary',
  },
  pieChart: {
    // brittle #5: expects a <canvas> inside a renamed container (the chart is SVG)
    selector: '#emi-pie-chart canvas',
    kind: 'chart',
    intent: 'Pie chart showing principal vs total interest',
  },
};

class LegacyEmiPage {
  constructor(page) {
    this.page = page;
  }

  locator(key) {
    return this.page.locator(BROKEN_LOCATORS[key].selector);
  }
}

module.exports = { LegacyEmiPage, BROKEN_LOCATORS };
