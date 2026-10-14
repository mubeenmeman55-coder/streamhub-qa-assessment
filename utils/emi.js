// Independent EMI maths used as the test oracle. Deliberately NOT shared with src/api.

/** Standard reducing-balance EMI: P*r*(1+r)^n / ((1+r)^n - 1), r = annual% / 12 / 100 */
function emi(principal, annualRatePct, years) {
  const r = annualRatePct / 12 / 100;
  const n = years * 12;
  return (principal * r * (1 + r) ** n) / ((1 + r) ** n - 1);
}

function summary(principal, annualRatePct, years) {
  const monthly = emi(principal, annualRatePct, years);
  const totalPayment = monthly * years * 12;
  return { emi: monthly, totalPayment, totalInterest: totalPayment - principal };
}

/**
 * Month-by-month amortisation grouped by calendar year.
 * startMonth is 0-based (0 = Jan). Returns [{year, interest, principal, payment}].
 */
function yearlySchedule(principal, annualRatePct, years, startYear, startMonth) {
  const r = annualRatePct / 12 / 100;
  const monthly = emi(principal, annualRatePct, years);
  const byYear = new Map();
  let balance = principal;
  for (let i = 0; i < years * 12; i++) {
    const year = startYear + Math.floor((startMonth + i) / 12);
    const interest = balance * r;
    const princ = monthly - interest;
    balance -= princ;
    const row = byYear.get(year) || { year, interest: 0, principal: 0, payment: 0 };
    row.interest += interest;
    row.principal += princ;
    row.payment += monthly;
    byYear.set(year, row);
  }
  return [...byYear.values()];
}

module.exports = { emi, summary, yearlySchedule };
