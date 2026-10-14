(() => {
  const $ = (id) => document.getElementById(id);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DEFAULTS = { amount: '25,00,000', rate: '10', tenure: '10', unit: 'years', start: '2027-01' };
  const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
  let loan = null; // last successfully calculated loan: {principal, rate, months, startYear, startMonth, emi, rows}

  // ---------- maths ----------
  function emiFor(P, annualRate, months) {
    const r = annualRate / 12 / 100;
    return (P * r * (1 + r) ** months) / ((1 + r) ** months - 1);
  }

  /** Month-by-month amortisation, each row tagged with its calendar year/month. */
  function buildSchedule(P, annualRate, months, startYear, startMonth) {
    const r = annualRate / 12 / 100;
    const emi = emiFor(P, annualRate, months);
    let balance = P;
    const rows = [];
    for (let i = 0; i < months; i++) {
      const interest = balance * r;
      const principal = emi - interest;
      const opening = balance;
      balance = i === months - 1 ? 0 : balance - principal;
      rows.push({
        n: i + 1,
        year: startYear + Math.floor((startMonth + i) / 12),
        month: (startMonth + i) % 12,
        opening,
        paid: emi,
        principal,
        interest,
        closing: balance,
      });
    }
    return { emi, rows };
  }

  function byYear(rows) {
    const map = new Map();
    for (const r of rows) {
      const y = map.get(r.year) || { year: r.year, opening: r.opening, paid: 0, principal: 0, interest: 0, closing: 0 };
      y.paid += r.paid; y.principal += r.principal; y.interest += r.interest; y.closing = r.closing;
      map.set(r.year, y);
    }
    return [...map.values()];
  }

  // ---------- input parsing / validation ----------
  const num = (s) => Number(String(s).replace(/,/g, '').trim());
  function readForm() {
    const errors = {};
    const amountRaw = $('amount').value, rateRaw = $('rate').value, tenureRaw = $('tenure').value, start = $('start').value;
    const amount = num(amountRaw), rate = num(rateRaw), tenure = num(tenureRaw), unit = $('tenure-unit').value;
    if (amountRaw.trim() === '' || !Number.isFinite(amount)) errors.amount = 'Enter the loan amount as a number.';
    else if (amount < 10000 || amount > 1000000000) errors.amount = 'Loan amount must be between ₹10,000 and ₹100 crore.';
    if (rateRaw.trim() === '' || !Number.isFinite(rate)) errors.rate = 'Enter the interest rate as a number.';
    else if (rate < 0.1 || rate > 50) errors.rate = 'Interest rate must be between 0.1% and 50%.';
    const months = unit === 'years' ? tenure * 12 : tenure;
    if (tenureRaw.trim() === '' || !Number.isFinite(tenure)) errors.tenure = 'Enter the tenure as a number.';
    else if (!Number.isInteger(tenure)) errors.tenure = 'Tenure must be a whole number.';
    else if (months < 1 || months > 480) errors.tenure = 'Tenure must be between 1 month and 40 years.';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(start)) errors.start = 'Choose a valid start month.';
    return { errors, values: { amount, rate, months, start } };
  }

  function showErrors(errors) {
    for (const k of ['amount', 'rate', 'tenure', 'start']) {
      $('err-' + k).textContent = errors[k] || '';
      const input = $(k);
      if (errors[k]) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    }
  }

  // ---------- rendering ----------
  function setKpi(id, value, text) { const el = $(id); el.dataset.value = String(value); el.textContent = text; }

  function renderDashboard() {
    const total = loan.emi * loan.months;
    const interest = total - loan.principal;
    setKpi('kpi-emi', loan.emi.toFixed(2), inr(loan.emi));
    setKpi('kpi-interest', interest.toFixed(2), inr(interest));
    setKpi('kpi-total', total.toFixed(2), inr(total));
    const share = (interest / total) * 100;
    setKpi('kpi-share', share.toFixed(2), share.toFixed(1) + '%');

    // pie: two stroke-dasharray arcs on a circle with circumference 100
    const principalPct = 100 - share;
    const p = $('pie-principal'), i = $('pie-interest');
    p.dataset.value = principalPct.toFixed(2); i.dataset.value = share.toFixed(2);
    p.setAttribute('stroke-dasharray', `${principalPct} ${100 - principalPct}`);
    p.setAttribute('stroke-dashoffset', '0');
    i.setAttribute('stroke-dasharray', `${share} ${100 - share}`);
    i.setAttribute('stroke-dashoffset', String(-principalPct));
    $('legend-principal').textContent = `${inr(loan.principal)} (${principalPct.toFixed(1)}%)`;
    $('legend-interest').textContent = `${inr(interest)} (${share.toFixed(1)}%)`;
    renderBars();
  }

  function renderBars() {
    const years = byYear(loan.rows);
    const W = 640, H = 260, m = { l: 54, r: 10, t: 12, b: 28 };
    const max = Math.max(...years.map((y) => y.paid));
    const bw = (W - m.l - m.r) / years.length;
    let svg = '';
    for (let k = 0; k <= 4; k++) {
      const v = (max / 4) * k, y = H - m.b - (v / max) * (H - m.t - m.b);
      svg += `<line x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${m.l - 6}" y="${y + 4}" text-anchor="end">${v >= 1e5 ? (v / 1e5).toFixed(1) + 'L' : Math.round(v / 1e3) + 'k'}</text>`;
    }
    years.forEach((y, idx) => {
      const x = m.l + idx * bw + bw * 0.15, w = bw * 0.7, h = H - m.t - m.b, base = H - m.b;
      const hp = (y.principal / max) * h, hi = (y.interest / max) * h;
      const attrs = `data-year="${y.year}" data-principal="${y.principal.toFixed(2)}" data-interest="${y.interest.toFixed(2)}"`;
      svg += `<rect class="bar bar-principal" data-testid="bar-principal" ${attrs} x="${x}" y="${base - hp}" width="${w}" height="${hp}" rx="2"/>`;
      svg += `<rect class="bar bar-interest" data-testid="bar-interest" ${attrs} x="${x}" y="${base - hp - hi}" width="${w}" height="${hi}" rx="2"/>`;
      if (years.length <= 16 || idx % 2 === 0) svg += `<text x="${x + w / 2}" y="${H - 9}" text-anchor="middle">${y.year}</text>`;
    });
    $('bar-chart').innerHTML = svg;
  }

  function populateYearFilter() {
    const years = [...new Set(loan.rows.map((r) => r.year))];
    const current = $('report-year').value;
    $('report-year').innerHTML = '<option value="all">All years</option>' + years.map((y) => `<option value="${y}">${y}</option>`).join('');
    if (years.map(String).includes(current)) $('report-year').value = current;
  }

  function renderReport() {
    const mode = $('report-mode').value, yearSel = $('report-year').value;
    let rows = loan.rows;
    if (yearSel !== 'all') rows = rows.filter((r) => String(r.year) === yearSel);
    const display = mode === 'yearly'
      ? byYear(rows).map((y) => ({ label: String(y.year), ...y }))
      : rows.map((r) => ({ label: `${MONTHS[r.month]} ${r.year}`, ...r }));
    $('schedule-body').innerHTML = display.map((r) =>
      `<tr data-testid="schedule-row" data-period="${r.label}" data-principal="${r.principal.toFixed(2)}" data-interest="${r.interest.toFixed(2)}" data-paid="${r.paid.toFixed(2)}">` +
      `<th scope="row">${r.label}</th><td>${inr(r.opening)}</td><td>${inr(r.paid)}</td><td>${inr(r.principal)}</td><td>${inr(r.interest)}</td><td>${inr(r.closing)}</td></tr>`).join('');
    const sum = (k) => display.reduce((a, r) => a + r[k], 0);
    const foot = $('schedule-total');
    for (const [col, key] of [['paid', 'paid'], ['principal', 'principal'], ['interest', 'interest']]) {
      const td = foot.querySelector(`[data-col=${col}]`);
      td.textContent = inr(sum(key)); td.dataset.value = sum(key).toFixed(2);
    }
    $('report-summary').textContent = `${display.length} ${mode === 'yearly' ? 'year' : 'month'}${display.length === 1 ? '' : 's'} shown` + (yearSel === 'all' ? '' : ` for ${yearSel}`);
  }

  // ---------- actions ----------
  function calculate() {
    const { errors, values } = readForm();
    showErrors(errors);
    if (Object.keys(errors).length) return false;
    const [sy, sm] = values.start.split('-').map(Number);
    const { emi, rows } = buildSchedule(values.amount, values.rate, values.months, sy, sm - 1);
    loan = { principal: values.amount, rate: values.rate, months: values.months, emi, rows };
    renderDashboard(); populateYearFilter(); renderReport();
    return true;
  }

  // keep text fields and sliders in sync
  const pairs = [['amount', 'amount-range', (v) => v.toLocaleString('en-IN')], ['rate', 'rate-range', String], ['tenure', 'tenure-range', String]];
  for (const [text, range, fmt] of pairs) {
    $(range).addEventListener('input', () => { $(text).value = fmt(Number($(range).value)); });
    $(text).addEventListener('input', () => { const v = num($(text).value); if (Number.isFinite(v)) $(range).value = v; });
  }
  $('tenure-unit').addEventListener('change', () => {
    const years = $('tenure-unit').value === 'years';
    $('tenure-range').max = years ? 30 : 360; $('tenure-range').step = years ? 1 : 6;
  });

  $('loan-form').addEventListener('submit', (e) => { e.preventDefault(); calculate(); });
  $('reset').addEventListener('click', () => {
    $('amount').value = DEFAULTS.amount; $('rate').value = DEFAULTS.rate; $('tenure').value = DEFAULTS.tenure;
    $('tenure-unit').value = DEFAULTS.unit; $('start').value = DEFAULTS.start;
    $('amount-range').value = 2500000; $('rate-range').value = 10; $('tenure-range').value = 10;
    showErrors({}); calculate();
  });
  $('report-mode').addEventListener('change', () => loan && renderReport());
  $('report-year').addEventListener('change', () => loan && renderReport());

  // bar tooltip (mouse + keyboard-less hover)
  const tip = $('bar-tooltip');
  $('bar-chart').addEventListener('mousemove', (e) => {
    const bar = e.target.closest('rect.bar');
    if (!bar) { tip.hidden = true; return; }
    const principal = Number(bar.dataset.principal), interest = Number(bar.dataset.interest);
    tip.innerHTML = `<b>${bar.dataset.year}</b><br>Principal: ${inr(principal)}<br>Interest: ${inr(interest)}<br>Total: ${inr(principal + interest)}`;
    const box = $('bar-chart').parentElement.getBoundingClientRect();
    tip.style.left = Math.min(e.clientX - box.left + 12, box.width - 160) + 'px';
    tip.style.top = e.clientY - box.top + 12 + 'px';
    tip.hidden = false;
  });
  $('bar-chart').addEventListener('mouseleave', () => { tip.hidden = true; });

  // ---------- routing ----------
  function route() {
    const view = location.hash === '#/report' ? 'report' : 'dashboard';
    $('view-dashboard').hidden = view !== 'dashboard';
    $('view-report').hidden = view !== 'report';
    $('page-title').textContent = view === 'report' ? 'Amortisation report' : 'Loan EMI dashboard';
    document.title = (view === 'report' ? 'Report' : 'Dashboard') + ' - EMI Calculator - Streamhub';
    for (const v of ['dashboard', 'report']) {
      const a = $('nav-' + v);
      if (v === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    }
  }
  window.addEventListener('hashchange', route);
  route();
  calculate();
})();
