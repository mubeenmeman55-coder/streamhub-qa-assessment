// Independent EMI maths used as the test oracle. Deliberately NOT shared with src/api.

/**
 * Standard reducing-balance EMI: P*r*(1+r)^n / ((1+r)^n - 1), r = annual% / 12 / 100.
 * `advance` = EMI paid at the START of each month, which divides the arrears EMI by (1+r).
 */
function emi(principal, annualRatePct, years, advance = false) {
  const r = annualRatePct / 12 / 100;
  const n = years * 12;
  const arrears = (principal * r * (1 + r) ** n) / ((1 + r) ** n - 1);
  return advance ? arrears / (1 + r) : arrears;
}

function summary(principal, annualRatePct, years, advance = false) {
  const monthly = emi(principal, annualRatePct, years, advance);
  const totalPayment = monthly * years * 12;
  return { emi: monthly, totalPayment, totalInterest: totalPayment - principal };
}

/**
 * Month-by-month amortisation grouped by calendar year, or by financial year (Apr-Mar) with {fy:true}.
 * startMonth is 0-based (0 = Jan). Returns [{year, interest, principal, payment, closing, months}] where `year` is the
 * calendar year, or the year a financial year starts in.
 * Convention: arrears => interest on the opening balance; advance => payment first, interest on what is left.
 */
function yearlySchedule(principal, annualRatePct, years, startYear, startMonth, { advance = false, fy = false } = {}) {
  const r = annualRatePct / 12 / 100;
  const monthly = emi(principal, annualRatePct, years, advance);
  const groups = new Map();
  let balance = principal;
  for (let i = 0; i < years * 12; i++) {
    const calYear = startYear + Math.floor((startMonth + i) / 12);
    const month = (startMonth + i) % 12;
    const year = fy && month < 3 ? calYear - 1 : calYear;
    const interest = (advance ? balance - monthly : balance) * r;
    const princ = monthly - interest;
    balance -= princ;
    const row = groups.get(year) || { year, interest: 0, principal: 0, payment: 0, closing: 0, months: 0 };
    row.interest += interest;
    row.principal += princ;
    row.payment += monthly;
    row.closing = balance;
    row.months += 1;
    groups.set(year, row);
  }
  return [...groups.values()];
}

/**
 * Prepayment oracle using closed-form algebra (no month-by-month loop, unlike the app):
 *   months to clear = ceil( -ln(1 - P*r/pay) / ln(1+r) ),  pay = EMI + extra
 *   balance after k payments = P(1+r)^k - pay*((1+r)^k - 1)/r
 */
function prepayment(principal, annualRatePct, years, extra) {
  const r = annualRatePct / 12 / 100;
  const pay = emi(principal, annualRatePct, years) + extra;
  const months = Math.ceil(-Math.log(1 - (principal * r) / pay) / Math.log(1 + r) - 1e-9);
  const balanceAfter = (k) => principal * (1 + r) ** k - (pay * ((1 + r) ** k - 1)) / r;
  const totalPaid = pay * (months - 1) + balanceAfter(months - 1) * (1 + r);
  const base = summary(principal, annualRatePct, years);
  return {
    months,
    totalPaid,
    totalInterest: totalPaid - principal,
    interestSaved: base.totalInterest - (totalPaid - principal),
    monthsSaved: years * 12 - months,
  };
}

module.exports = { emi, summary, yearlySchedule, prepayment };
