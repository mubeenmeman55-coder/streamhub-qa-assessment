(() => {
  const $ = (id) => document.getElementById(id);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
  const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } } };

  // Loan products: each has its own starting values and slider ranges
  const PRODUCTS = {
    home: { amount: '25,00,000', rate: '10', tenure: '10', max: { amount: 10000000, rate: 25, tenure: 30 } },
    personal: { amount: '5,00,000', rate: '12', tenure: '3', max: { amount: 3000000, rate: 30, tenure: 7 } },
    car: { amount: '8,00,000', rate: '9', tenure: '5', max: { amount: 4000000, rate: 20, tenure: 10 } },
  };
  const BASE = { start: '2027-01', extra: '0', timing: 'arrears', unit: 'years' };
  let product = 'home';
  let loan = null; // last successfully calculated loan
  const expandedYears = new Set();

  // ---------- maths ----------
  /** EMI paid at the END of each month (arrears). In advance (start of month) it is EMI/(1+r). */
  function emiFor(P, annualRate, months, advance = false) {
    const r = annualRate / 12 / 100;
    const e = (P * r * (1 + r) ** months) / ((1 + r) ** months - 1);
    return advance ? e / (1 + r) : e;
  }

  /** Month-by-month amortisation; `extra` is an additional payment every month (prepayment). */
  function buildSchedule(P, annualRate, months, startYear, startMonth, extra = 0, advance = false, lump = { amount: 0, month: 0 }) {
    const r = annualRate / 12 / 100;
    const emi = emiFor(P, annualRate, months, advance);
    let balance = P;
    const rows = [];
    for (let i = 0; i < months && balance > 0.005; i++) {
      const pay = emi + extra;
      // arrears: interest accrues on the opening balance; advance: payment lands first, interest on what is left
      let interest = advance ? Math.max(0, balance - pay) * r : balance * r;
      let principal = pay - interest;
      let paid = pay;
      if (principal >= balance || i === months - 1) { principal = balance; paid = principal + interest; }
      const opening = balance;
      balance = principal >= balance ? 0 : balance - principal;
      // one-time prepayment: paid right after this month's EMI, straight off the principal
      let lumpPaid = 0;
      if (lump.amount > 0 && i + 1 === lump.month && balance > 0.005) { lumpPaid = Math.min(lump.amount, balance); balance -= lumpPaid; }
      rows.push({
        n: i + 1,
        year: startYear + Math.floor((startMonth + i) / 12),
        month: (startMonth + i) % 12,
        opening, paid: paid + lumpPaid, principal: principal + lumpPaid, interest, closing: balance, lump: lumpPaid,
      });
    }
    return { emi, rows };
  }

  /** Financial year (Apr-Mar) is keyed by the calendar year it starts in. */
  const periodKey = (row, fy) => (fy && row.month < 3 ? row.year - 1 : row.year);
  const periodLabel = (key, fy) => (fy ? `FY ${key}-${String(key + 1).slice(2)}` : String(key));

  function byYear(rows, fy = false) {
    const map = new Map();
    for (const r of rows) {
      const key = periodKey(r, fy);
      const y = map.get(key) || { key, year: key, label: periodLabel(key, fy), opening: r.opening, paid: 0, principal: 0, interest: 0, closing: 0 };
      y.paid += r.paid; y.principal += r.principal; y.interest += r.interest; y.closing = r.closing;
      map.set(key, y);
    }
    return [...map.values()];
  }
  const fyMode = () => $('year-format').value === 'financial';

  /** "2500000" -> "Twenty-five lakh" (Indian numbering) */
  function inWords(n) {
    n = Math.floor(n);
    if (!(n > 0)) return '';
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const below100 = (x) => (x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? '-' + ones[x % 10] : ''));
    const below1000 = (x) => (x >= 100 ? ones[Math.floor(x / 100)] + ' hundred' + (x % 100 ? ' ' + below100(x % 100) : '') : below100(x));
    const parts = [];
    const crore = Math.floor(n / 1e7), lakh = Math.floor((n % 1e7) / 1e5), thousand = Math.floor((n % 1e5) / 1e3), rest = n % 1e3;
    if (crore) parts.push(below1000(crore) + ' crore');
    if (lakh) parts.push(below100(lakh) + ' lakh');
    if (thousand) parts.push(below100(thousand) + ' thousand');
    if (rest) parts.push(below1000(rest));
    const text = parts.join(' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  // ---------- input parsing / validation ----------
  const num = (s) => Number(String(s).replace(/,/g, '').trim());
  const timing = () => document.querySelector('input[name=timing]:checked').value;
  function readForm() {
    const errors = {};
    const amountRaw = $('amount').value, rateRaw = $('rate').value, tenureRaw = $('tenure').value, start = $('start').value, extraRaw = $('extra').value, incomeRaw = $('income').value, lumpRaw = $('lump').value, lumpMonthRaw = $('lump-month').value;
    const amount = num(amountRaw), rate = num(rateRaw), tenure = num(tenureRaw), unit = $('tenure-unit').value;
    const extra = extraRaw.trim() === '' ? 0 : num(extraRaw);
    if (amountRaw.trim() === '' || !Number.isFinite(amount)) errors.amount = 'Enter the loan amount as a number.';
    else if (amount < 10000 || amount > 1000000000) errors.amount = 'Loan amount must be between ₹10,000 and ₹100 crore.';
    if (rateRaw.trim() === '' || !Number.isFinite(rate)) errors.rate = 'Enter the interest rate as a number.';
    else if (rate < 0.1 || rate > 50) errors.rate = 'Interest rate must be between 0.1% and 50%.';
    const months = unit === 'years' ? tenure * 12 : tenure;
    if (tenureRaw.trim() === '' || !Number.isFinite(tenure)) errors.tenure = 'Enter the tenure as a number.';
    else if (!Number.isInteger(tenure)) errors.tenure = 'Tenure must be a whole number.';
    else if (months < 1 || months > 480) errors.tenure = 'Tenure must be between 1 month and 40 years.';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(start)) errors.start = 'Choose a valid start month.';
    if (!Number.isFinite(extra) || extra < 0) errors.extra = 'Extra payment must be zero or a positive number.';
    else if (Number.isFinite(amount) && extra > amount) errors.extra = 'Extra payment cannot be more than the loan amount.';
    const lump = lumpRaw.trim() === '' ? 0 : num(lumpRaw);
    const lumpMonth = num(lumpMonthRaw);
    if (!Number.isFinite(lump) || lump < 0) errors.lump = 'One-time prepayment must be zero or a positive number.';
    else if (Number.isFinite(amount) && lump > amount) errors.lump = 'One-time prepayment cannot be more than the loan amount.';
    else if (lump > 0 && (!Number.isInteger(lumpMonth) || lumpMonth < 1 || (Number.isFinite(months) && lumpMonth > months))) errors['lump-month'] = `Prepayment month must be a whole number between 1 and ${Number.isFinite(months) ? months : 'the loan term'}.`;
    const income = incomeRaw.trim() === '' ? 0 : num(incomeRaw);
    if (!Number.isFinite(income) || income < 0 || (incomeRaw.trim() !== '' && income === 0)) errors.income = 'Income must be a positive number.';
    return { errors, values: { amount, rate, months, start, extra, unit, tenure, income, lump, lumpMonth, advance: timing() === 'advance' } };
  }

  function showErrors(errors) {
    for (const k of ['amount', 'rate', 'tenure', 'start', 'extra', 'income', 'lump', 'lump-month']) {
      $('err-' + k).textContent = errors[k] || '';
      const input = $(k);
      if (errors[k]) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    }
  }

  let toastTimer;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
  }

  // ---------- rendering ----------
  function setKpi(id, value, text) { const el = $(id); el.dataset.value = String(value); el.textContent = text; }

  function renderDashboard() {
    const baseTotal = loan.emi * loan.months;
    const prepaying = loan.extra > 0 || loan.lump > 0;
    const total = prepaying ? loan.rows.reduce((a, r) => a + r.paid, 0) : baseTotal;
    const interest = total - loan.principal;
    setKpi('kpi-emi', loan.emi.toFixed(2), inr(loan.emi));
    setKpi('kpi-interest', interest.toFixed(2), inr(interest));
    setKpi('kpi-total', total.toFixed(2), inr(total));
    const share = (interest / total) * 100;
    setKpi('kpi-share', share.toFixed(2), share.toFixed(1) + '%');

    const principalPct = 100 - share;
    const p = $('pie-principal'), i = $('pie-interest');
    p.dataset.value = principalPct.toFixed(2); i.dataset.value = share.toFixed(2);
    p.setAttribute('stroke-dasharray', `${principalPct} ${100 - principalPct}`);
    p.setAttribute('stroke-dashoffset', '0');
    i.setAttribute('stroke-dasharray', `${share} ${100 - share}`);
    i.setAttribute('stroke-dashoffset', String(-principalPct));
    $('legend-principal').textContent = `${inr(loan.principal)} (${principalPct.toFixed(1)}%)`;
    $('legend-interest').textContent = `${inr(interest)} (${share.toFixed(1)}%)`;

    const box = $('savings');
    if (prepaying) {
      const savedInterest = (baseTotal - loan.principal) - interest;
      const savedMonths = loan.months - loan.rows.length;
      const fmtMonths = (m) => `${Math.floor(m / 12) ? Math.floor(m / 12) + ' yr ' : ''}${m % 12} mo`.trim();
      $('saved-interest').dataset.value = savedInterest.toFixed(2); $('saved-interest').textContent = inr(savedInterest);
      $('saved-months').dataset.value = String(savedMonths); $('saved-months').textContent = fmtMonths(savedMonths);
      $('actual-months').dataset.value = String(loan.rows.length); $('actual-months').textContent = fmtMonths(loan.rows.length);
      box.hidden = false;
    } else {
      box.hidden = true;
    }
    // insights
    const cost = (total / loan.principal) * 100;
    $('cost-per-100').dataset.value = cost.toFixed(2); $('cost-per-100').textContent = '₹' + cost.toFixed(2);
    const cross = loan.rows.find((r) => r.principal - r.lump > r.interest);
    const c = $('crossover');
    if (cross) { c.dataset.value = String(cross.n); c.textContent = `Month ${cross.n} (${MONTHS[cross.month]} ${cross.year})`; } else { c.dataset.value = '0'; c.textContent = 'Never'; }
    const aff = $('affordability');
    if (loan.income > 0) {
      const ratio = (loan.emi + loan.extra) / loan.income * 100;
      const status = ratio <= 30 ? 'comfortable' : ratio <= 50 ? 'stretching' : 'risky';
      $('afford-ratio').dataset.value = ratio.toFixed(2); $('afford-ratio').textContent = ratio.toFixed(1) + '%';
      $('afford-status').textContent = { comfortable: 'Comfortable', stretching: 'Stretching', risky: 'Risky' }[status];
      aff.dataset.status = status; aff.hidden = false;
    } else { aff.hidden = true; aff.dataset.status = ''; }
    renderBars();
  }

  function renderBars() {
    if (chartView === 'cumulative') { renderCumulative(); return; }
    document.querySelector('.legend li:has(.sw.balance)')?.classList.remove('hide');
    const years = byYear(loan.rows, fyMode());
    const W = 640, H = 260, m = { l: 54, r: 46, t: 12, b: 28 };
    const max = Math.max(...years.map((y) => y.paid));
    const bw = (W - m.l - m.r) / years.length, h = H - m.t - m.b, base = H - m.b;
    let svg = '';
    for (let k = 0; k <= 4; k++) {
      const v = (max / 4) * k, y = base - (v / max) * h;
      svg += `<line x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${m.l - 6}" y="${y + 4}" text-anchor="end">${v >= 1e5 ? (v / 1e5).toFixed(1) + 'L' : Math.round(v / 1e3) + 'k'}</text>`;
      const b = (loan.principal / 4) * k;   // right axis: outstanding balance
      svg += `<text x="${W - m.r + 6}" y="${y + 4}" fill="#12a150">${b >= 1e7 ? (b / 1e7).toFixed(1) + 'Cr' : b >= 1e5 ? (b / 1e5).toFixed(0) + 'L' : Math.round(b / 1e3) + 'k'}</text>`;
    }
    const pts = [];
    years.forEach((y, idx) => {
      const x = m.l + idx * bw + bw * 0.15, w = bw * 0.7;
      const hp = (y.principal / max) * h, hi = (y.interest / max) * h;
      const attrs = `data-year="${y.key}" data-label="${y.label}" data-principal="${y.principal.toFixed(2)}" data-interest="${y.interest.toFixed(2)}" data-balance="${y.closing.toFixed(2)}"`;
      svg += `<rect class="bar bar-principal" data-testid="bar-principal" ${attrs} x="${x}" y="${base - hp}" width="${w}" height="${hp}" rx="2"/>`;
      svg += `<rect class="bar bar-interest" data-testid="bar-interest" ${attrs} x="${x}" y="${base - hp - hi}" width="${w}" height="${hi}" rx="2"/>`;
      pts.push([x + w / 2, base - (y.closing / loan.principal) * h, y]);
      const short = fyMode() ? `${String(y.key).slice(2)}-${String(y.key + 1).slice(2)}` : String(y.key);
      if (years.length <= 16 || idx % 2 === 0) svg += `<text x="${x + w / 2}" y="${H - 9}" text-anchor="middle">${short}</text>`;
    });
    svg += `<path class="balance-line" data-testid="balance-line" d="${pts.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ')}"/>`;
    pts.forEach(([x, y, yr]) => { svg += `<circle class="balance-dot" data-testid="balance-point" data-year="${yr.key}" data-balance="${yr.closing.toFixed(2)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3"/>`; });
    $('bar-chart').innerHTML = svg;
  }

  let chartView = 'bars';
  function renderCumulative() {
    document.querySelector('.legend li:has(.sw.balance)')?.classList.add('hide');
    const years = byYear(loan.rows, fyMode());
    const W = 640, H = 260, m = { l: 54, r: 16, t: 12, b: 28 }, h = H - m.t - m.b, base = H - m.b;
    let cp = 0, ci = 0;
    const pts = years.map((y) => { cp += y.principal; ci += y.interest; return { y, cp, ci }; });
    const max = Math.max(cp, ci);
    const X = (i) => m.l + (years.length === 1 ? (W - m.l - m.r) / 2 : (i / (years.length - 1)) * (W - m.l - m.r));
    const Y = (v) => base - (v / max) * h;
    let svg = '';
    for (let k = 0; k <= 4; k++) {
      const v = (max / 4) * k;
      svg += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${v >= 1e7 ? (v / 1e7).toFixed(1) + 'Cr' : v >= 1e5 ? (v / 1e5).toFixed(1) + 'L' : Math.round(v / 1e3) + 'k'}</text>`;
    }
    for (const kind of ['principal', 'interest']) {
      const key = kind === 'principal' ? 'cp' : 'ci';
      svg += `<path class="cum-line-${kind}" data-testid="cum-line-${kind}" d="${pts.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p[key]).toFixed(1)).join(' ')}"/>`;
      pts.forEach((p, i) => { svg += `<circle class="cum-dot-${kind}" data-testid="cum-${kind}-point" data-year="${p.y.key}" data-value="${p[key].toFixed(2)}" cx="${X(i).toFixed(1)}" cy="${Y(p[key]).toFixed(1)}" r="3.5"><title>${p.y.label}: ${inr(p[key])} cumulative ${kind}</title></circle>`; });
    }
    pts.forEach((p, i) => { if (years.length <= 16 || i % 2 === 0) svg += `<text x="${X(i)}" y="${H - 9}" text-anchor="middle">${fyMode() ? `${String(p.y.key).slice(2)}-${String(p.y.key + 1).slice(2)}` : p.y.key}</text>`; });
    $('bar-chart').innerHTML = svg;
  }
  function setChartView(v) {
    chartView = v;
    $('view-bars').setAttribute('aria-pressed', String(v === 'bars')); $('view-cumulative').setAttribute('aria-pressed', String(v === 'cumulative'));
    $('bar-h').textContent = v === 'bars' ? 'Payments per year' : 'Cumulative paid';
    if (loan) renderBars();
  }

  function populateYearFilter() {
    const fy = fyMode();
    const keys = [...new Set(loan.rows.map((r) => periodKey(r, fy)))];
    const current = $('report-year').value;
    $('report-year').innerHTML = '<option value="all">All years</option>' + keys.map((k) => `<option value="${k}">${periodLabel(k, fy)}</option>`).join('');
    if (keys.map(String).includes(current)) $('report-year').value = current;
  }

  function displayRows() {
    const mode = $('report-mode').value, yearSel = $('report-year').value, fy = fyMode();
    let rows = loan.rows;
    if (yearSel !== 'all') rows = rows.filter((r) => String(periodKey(r, fy)) === yearSel);
    const monthRow = (r) => ({ label: `${MONTHS[r.month]} ${r.year}`, ...r });
    const display = mode === 'yearly'
      ? byYear(rows, fy).map((y) => ({ ...y, months: rows.filter((r) => periodKey(r, fy) === y.key).map(monthRow) }))
      : rows.map(monthRow);
    return { display, mode, yearSel };
  }

  const rowAttrs = (r) => `data-period="${r.label}" data-principal="${r.principal.toFixed(2)}" data-interest="${r.interest.toFixed(2)}" data-paid="${r.paid.toFixed(2)}"`;

  function renderReport() {
    const { display, mode, yearSel } = displayRows();
    $('schedule-body').innerHTML = display.map((r) => {
      const open = mode === 'yearly' && expandedYears.has(r.key);
      const toggle = mode === 'yearly'
        ? `<button type="button" class="year-toggle" data-testid="year-toggle" data-key="${r.key}" aria-expanded="${open}" aria-label="${open ? 'Hide' : 'Show'} months for ${r.label}">${open ? '&#9662;' : '&#9656;'}</button>` : '';
      let html = `<tr data-testid="schedule-row" ${rowAttrs(r)}>` +
        `<th scope="row">${toggle}${r.label}</th><td>${inr(r.opening)}</td><td>${inr(r.paid)}</td><td>${inr(r.principal)}</td><td>${inr(r.interest)}</td><td data-testid="cell-closing">${inr(r.closing)}</td></tr>`;
      if (open) html += r.months.map((mo) => `<tr class="month-sub" data-testid="schedule-month-row" ${rowAttrs(mo)}><th scope="row">${mo.label}</th><td>${inr(mo.opening)}</td><td>${inr(mo.paid)}</td><td>${inr(mo.principal)}</td><td>${inr(mo.interest)}</td><td data-testid="cell-closing">${inr(mo.closing)}</td></tr>`).join('');
      return html;
    }).join('');
    const sum = (k) => display.reduce((a, r) => a + r[k], 0);
    const foot = $('schedule-total');
    for (const col of ['paid', 'principal', 'interest']) {
      const td = foot.querySelector(`[data-col=${col}]`);
      td.textContent = inr(sum(col)); td.dataset.value = sum(col).toFixed(2);
    }
    $('report-summary').textContent = `${display.length} ${mode === 'yearly' ? (fyMode() ? 'financial year' : 'year') : 'month'}${display.length === 1 ? '' : 's'} shown` + (yearSel === 'all' ? '' : ` for ${periodLabel(Number(yearSel), fyMode())}`);
  }

  // ---------- main actions ----------
  /** silent = live recalculation while typing/dragging: apply only when valid, never nag with errors */
  function calculate(silent = false) {
    const { errors, values } = readForm();
    updateWords();
    if (Object.keys(errors).length) {
      if (!silent) showErrors(errors);
      return false;
    }
    showErrors({});
    const [sy, sm] = values.start.split('-').map(Number);
    const { emi, rows } = buildSchedule(values.amount, values.rate, values.months, sy, sm - 1, values.extra, values.advance, { amount: values.lump, month: values.lumpMonth });
    loan = { principal: values.amount, rate: values.rate, months: values.months, extra: values.extra, lump: values.lump, advance: values.advance, income: values.income, emi, rows };
    renderDashboard(); populateYearFilter(); renderReport();
    return true;
  }
  let liveTimer;
  const live = () => { clearTimeout(liveTimer); liveTimer = setTimeout(() => calculate(true), 220); };

  function updateWords() {
    const v = num($('amount').value);
    $('amount-words').textContent = Number.isFinite(v) && v > 0 ? inWords(v) + ' rupees' : '';
  }

  // ---------- products & slider ticks ----------
  const tickLabel = (v, kind) => (kind === 'amount' ? (v >= 1e7 ? +(v / 1e7).toFixed(1) + 'Cr' : v >= 1e5 ? +(v / 1e5).toFixed(1) + 'L' : v === 0 ? '0' : Math.round(v / 1e3) + 'k') : String(+v.toFixed(1)));
  function renderTicks() {
    for (const [id, kind] of [['amount-range', 'amount'], ['rate-range', 'rate'], ['tenure-range', 'tenure']]) {
      const el = $(id), min = Number(el.min), max = Number(el.max);
      document.querySelector(`.ticks[data-for=${id}]`).innerHTML = [0, 1, 2, 3, 4].map((k) => `<span>${tickLabel(min + ((max - min) / 4) * k, kind)}</span>`).join('');
    }
  }
  function applyProduct(name, resetValues) {
    product = name;
    const cfg = PRODUCTS[name];
    document.querySelectorAll('[data-product]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.product === name)));
    $('amount-range').max = cfg.max.amount; $('rate-range').max = cfg.max.rate;
    const years = $('tenure-unit').value === 'years';
    $('tenure-range').max = years ? cfg.max.tenure : cfg.max.tenure * 12;
    if (resetValues) {
      $('amount').value = cfg.amount; $('rate').value = cfg.rate; $('tenure').value = cfg.tenure; $('tenure-unit').value = 'years';
      $('tenure-range').max = cfg.max.tenure;
      $('amount-range').value = num(cfg.amount); $('rate-range').value = num(cfg.rate); $('tenure-range').value = num(cfg.tenure);
    }
    renderTicks();
  }

  // ---------- CSV export ----------
  function downloadCsv() {
    if (!loan) return;
    const { display, mode } = displayRows();
    const lines = [['Period', 'Opening balance', 'EMI paid', 'Principal', 'Interest', 'Closing balance'].join(',')];
    for (const r of display) lines.push([r.label, r.opening, r.paid, r.principal, r.interest, r.closing].map((v) => (typeof v === 'number' ? v.toFixed(2) : v)).join(','));
    const url = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `emi-schedule-${mode}.csv` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Downloaded ${display.length} row${display.length === 1 ? '' : 's'} as CSV`);
  }

  // ---------- share link ----------
  function formState() {
    return { product, amount: $('amount').value, rate: $('rate').value, tenure: $('tenure').value, unit: $('tenure-unit').value, start: $('start').value, extra: $('extra').value, income: $('income').value, lump: $('lump').value, lumpMonth: $('lump-month').value, timing: timing(), yfmt: $('year-format').value };
  }
  function shareUrl() {
    return `${location.origin}${location.pathname}?${new URLSearchParams(formState())}${location.hash}`;
  }
  async function share() {
    const url = shareUrl();
    $('share-url').value = url; $('share-box').hidden = false;
    history.replaceState(null, '', url);
    try { await navigator.clipboard.writeText(url); toast('Share link copied'); } catch { toast('Share link ready below'); }
  }
  function applyState(s) {
    applyProduct(PRODUCTS[s.product] ? s.product : 'home', false);
    const cfg = PRODUCTS[product];
    $('amount').value = s.amount ?? cfg.amount; $('rate').value = s.rate ?? cfg.rate;
    $('tenure-unit').value = s.unit === 'months' ? 'months' : 'years';
    $('tenure-range').max = $('tenure-unit').value === 'years' ? cfg.max.tenure : cfg.max.tenure * 12;
    $('tenure').value = s.tenure ?? cfg.tenure; $('start').value = s.start ?? BASE.start; $('extra').value = s.extra ?? BASE.extra; $('income').value = s.income ?? ''; $('lump').value = s.lump ?? '0'; $('lump-month').value = s.lumpMonth ?? '12';
    document.getElementById(s.timing === 'advance' ? 'timing-advance' : 'timing-arrears').checked = true;
    $('year-format').value = s.yfmt === 'financial' ? 'financial' : 'calendar';
    $('amount-range').value = num($('amount').value) || num(cfg.amount); $('rate-range').value = num($('rate').value) || num(cfg.rate); $('tenure-range').value = num($('tenure').value) || num(cfg.tenure);
    renderTicks();
  }

  // ---------- saved scenarios ----------
  const savedList = () => store.get('emi.saved', []);
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  function renderSaved() {
    const list = savedList();
    $('saved-empty').hidden = list.length > 0;
    $('saved-list').innerHTML = list.map((s, i) =>
      `<li data-testid="saved-item"><button type="button" class="load" data-load="${i}" aria-label="Load scenario ${esc(s.name)}">${esc(s.name)}<small>${inr(num(s.amount))} &middot; ${esc(s.rate)}% &middot; ${esc(s.tenure)} ${esc(s.unit)}</small></button>` +
      `<button type="button" class="del" data-del="${i}" aria-label="Delete scenario ${esc(s.name)}">&times;</button></li>`).join('');
  }
  function saveScenario() {
    const name = $('scenario-name').value.trim();
    const { errors } = readForm();
    $('err-save').textContent = '';
    if (!name) { $('err-save').textContent = 'Give the scenario a name first.'; return; }
    if (Object.keys(errors).length) { $('err-save').textContent = 'Fix the loan details before saving.'; return; }
    const list = savedList().filter((s) => s.name.toLowerCase() !== name.toLowerCase());
    list.unshift({ name, ...formState() });
    store.set('emi.saved', list.slice(0, 8));
    $('scenario-name').value = '';
    renderSaved(); toast(`Saved "${name}"`);
  }

  // ---------- compare ----------
  function readLoan(prefix) {
    const amount = num($(`${prefix}-amount`).value), rate = num($(`${prefix}-rate`).value), years = num($(`${prefix}-years`).value);
    const label = prefix.toUpperCase();
    if (![amount, rate, years].every(Number.isFinite) || $(`${prefix}-amount`).value.trim() === '' || $(`${prefix}-rate`).value.trim() === '' || $(`${prefix}-years`).value.trim() === '') return { error: `Loan ${label}: enter numbers for amount, rate and tenure.` };
    if (amount < 10000 || amount > 1000000000) return { error: `Loan ${label}: amount must be between ₹10,000 and ₹100 crore.` };
    if (rate < 0.1 || rate > 50) return { error: `Loan ${label}: rate must be between 0.1% and 50%.` };
    if (!Number.isInteger(years) || years < 1 || years > 40) return { error: `Loan ${label}: tenure must be a whole number of years from 1 to 40.` };
    const months = years * 12, emi = emiFor(amount, rate, months), total = emi * months;
    return { amount, rate, months, emi, total, interest: total - amount };
  }
  function compare() {
    const a = readLoan('a'), b = readLoan('b');
    const err = a.error || b.error || '';
    $('err-compare').textContent = err;
    if (err) { $('compare-result').hidden = true; return; }
    const set = (key, av, bv, fmt, lowerIsBetter = true) => {
      const diff = bv - av;
      const cells = { a: document.querySelector(`[data-testid=cmp-${key}-a]`), b: document.querySelector(`[data-testid=cmp-${key}-b]`), diff: document.querySelector(`[data-testid=cmp-${key}-diff]`) };
      cells.a.textContent = fmt(av); cells.a.dataset.value = av.toFixed(2);
      cells.b.textContent = fmt(bv); cells.b.dataset.value = bv.toFixed(2);
      cells.diff.textContent = diff === 0 ? fmt(0) : (diff > 0 ? '+' : '−') + fmt(Math.abs(diff)); cells.diff.dataset.value = diff.toFixed(2);
      cells.a.classList.toggle('better', lowerIsBetter && av < bv); cells.b.classList.toggle('better', lowerIsBetter && bv < av);
    };
    set('emi', a.emi, b.emi, inr); set('interest', a.interest, b.interest, inr); set('total', a.total, b.total, inr); set('months', a.months, b.months, (v) => String(Math.round(v)));
    const d = b.total - a.total;
    $('compare-verdict').textContent = Math.abs(d) < 0.5 ? 'Both loans cost the same in total.' : d < 0
      ? `Loan B is cheaper overall: you pay ${inr(-d)} less in total.` : `Loan A is cheaper overall: you pay ${inr(d)} less in total.`;
    $('compare-verdict').dataset.winner = Math.abs(d) < 0.5 ? 'tie' : d < 0 ? 'B' : 'A';
    $('compare-result').hidden = false;
  }

  // ---------- eligibility (reverse calculator) ----------
  let eligible = null;
  function eligibilityCheck() {
    const budget = num($('el-budget').value), rate = num($('el-rate').value), years = num($('el-years').value);
    let err = '';
    if ([$('el-budget').value, $('el-rate').value, $('el-years').value].some((v) => v.trim() === '') || ![budget, rate, years].every(Number.isFinite)) err = 'Enter numbers for the EMI, rate and tenure.';
    else if (budget < 500 || budget > 10000000) err = 'Monthly EMI must be between \u20B9500 and \u20B91 crore.';
    else if (rate < 0.1 || rate > 50) err = 'Interest rate must be between 0.1% and 50%.';
    else if (!Number.isInteger(years) || years < 1 || years > 40) err = 'Tenure must be a whole number of years from 1 to 40.';
    $('err-eligibility').textContent = err;
    if (err) { $('el-result').hidden = true; eligible = null; return; }
    const r = rate / 12 / 100, n = years * 12;
    const principal = (budget * ((1 + r) ** n - 1)) / (r * (1 + r) ** n);
    const total = budget * n;
    eligible = { principal, rate, years };
    for (const [id, v] of [['el-amount', principal], ['el-interest', total - principal], ['el-total', total]]) { $(id).dataset.value = v.toFixed(2); $(id).textContent = inr(v); }
    $('el-words').textContent = inWords(principal) + ' rupees';
    $('el-result').hidden = false;
  }
  function useEligible() {
    if (!eligible) return;
    applyState({ product, amount: (Math.floor(eligible.principal / 1000) * 1000).toLocaleString('en-IN'), rate: String(eligible.rate), tenure: String(eligible.years), unit: 'years' });
    showErrors({}); calculate(); location.hash = '#/dashboard'; toast('Loan loaded from eligibility');
  }

  // ---------- wiring ----------
  const pairs = [['amount', 'amount-range', (v) => v.toLocaleString('en-IN')], ['rate', 'rate-range', String], ['tenure', 'tenure-range', String]];
  for (const [text, range, fmt] of pairs) {
    $(range).addEventListener('input', () => { $(text).value = fmt(Number($(range).value)); updateWords(); live(); });
    $(text).addEventListener('input', () => { const v = num($(text).value); if (Number.isFinite(v)) $(range).value = v; updateWords(); live(); });
  }
  $('extra').addEventListener('input', live);
  $('income').addEventListener('input', live);
  $('lump').addEventListener('input', live);
  $('lump-month').addEventListener('input', live);
  $('start').addEventListener('input', live);
  document.querySelectorAll('input[name=timing]').forEach((r) => r.addEventListener('change', () => calculate(true)));
  $('tenure-unit').addEventListener('change', () => {
    const years = $('tenure-unit').value === 'years', cfg = PRODUCTS[product];
    $('tenure-range').max = years ? cfg.max.tenure : cfg.max.tenure * 12; $('tenure-range').step = years ? 1 : 6;
    renderTicks(); live();
  });
  document.querySelectorAll('[data-product]').forEach((b) => b.addEventListener('click', () => {
    applyProduct(b.dataset.product, true); showErrors({}); calculate(); toast(`${b.textContent} defaults loaded`);
  }));

  $('loan-form').addEventListener('submit', (e) => { e.preventDefault(); calculate(); });
  $('reset').addEventListener('click', () => { applyState({ product }); showErrors({}); $('share-box').hidden = true; calculate(); });
  $('share').addEventListener('click', share);
  $('save-scenario').addEventListener('click', saveScenario);
  $('scenario-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveScenario(); } });
  $('saved-list').addEventListener('click', (e) => {
    const load = e.target.closest('[data-load]'), del = e.target.closest('[data-del]');
    if (load) { const s = savedList()[Number(load.dataset.load)]; applyState(s); showErrors({}); calculate(); toast(`Loaded "${s.name}"`); }
    if (del) { const list = savedList(); const [gone] = list.splice(Number(del.dataset.del), 1); store.set('emi.saved', list); renderSaved(); toast(`Deleted "${gone.name}"`); }
  });
  $('report-mode').addEventListener('change', () => loan && renderReport());
  $('report-year').addEventListener('change', () => loan && renderReport());
  $('year-format').addEventListener('change', () => { if (!loan) return; $('report-year').value = 'all'; expandedYears.clear(); populateYearFilter(); renderReport(); renderBars(); });
  $('schedule-body').addEventListener('click', (e) => {
    const t = e.target.closest('.year-toggle');
    if (!t) return;
    const key = Number(t.dataset.key);
    if (expandedYears.has(key)) expandedYears.delete(key); else expandedYears.add(key);
    renderReport();
    document.querySelector(`.year-toggle[data-key="${key}"]`)?.focus();
  });
  $('download-csv').addEventListener('click', downloadCsv);
  $('print-report').addEventListener('click', () => window.print());
  $('view-bars').addEventListener('click', () => setChartView('bars'));
  $('view-cumulative').addEventListener('click', () => setChartView('cumulative'));
  $('eligibility-form').addEventListener('submit', (e) => { e.preventDefault(); eligibilityCheck(); });
  $('el-use').addEventListener('click', useEligible);
  $('compare-form').addEventListener('submit', (e) => { e.preventDefault(); compare(); });
  $('compare-use-current').addEventListener('click', () => {
    const { values } = readForm();
    $('a-amount').value = $('amount').value; $('a-rate').value = $('rate').value; $('a-years').value = String(Math.max(1, Math.round(values.months / 12)));
    compare();
  });

  // theme
  function applyTheme(t) {
    document.documentElement.dataset.theme = t; store.set('emi.theme', t);
    $('theme-toggle').setAttribute('aria-pressed', String(t === 'dark'));
  }
  $('theme-toggle').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  applyTheme(store.get('emi.theme', null) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

  // bar tooltip
  const tip = $('bar-tooltip');
  $('bar-chart').addEventListener('mousemove', (e) => {
    const bar = e.target.closest('rect.bar');
    if (!bar) { tip.hidden = true; return; }
    const principal = Number(bar.dataset.principal), interest = Number(bar.dataset.interest);
    tip.innerHTML = `<b>${bar.dataset.label}</b><br>Principal: ${inr(principal)}<br>Interest: ${inr(interest)}<br>Total: ${inr(principal + interest)}<br>Balance left: ${inr(Number(bar.dataset.balance))}`;
    const box = $('bar-chart').parentElement.getBoundingClientRect();
    tip.style.left = Math.min(e.clientX - box.left + 12, box.width - 170) + 'px';
    tip.style.top = e.clientY - box.top + 12 + 'px';
    tip.hidden = false;
  });
  $('bar-chart').addEventListener('mouseleave', () => { tip.hidden = true; });

  // routing
  const TITLES = { dashboard: 'Loan EMI dashboard', report: 'Amortisation report', compare: 'Compare loans', eligibility: 'Loan eligibility' };
  function route() {
    const view = ['#/report', '#/compare', '#/eligibility'].includes(location.hash) ? location.hash.slice(2) : 'dashboard';
    for (const v of Object.keys(TITLES)) {
      $('view-' + v).hidden = v !== view;
      const a = $('nav-' + v);
      if (v === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    }
    const wide = view === 'compare' || view === 'eligibility';
    $('form-panel').hidden = $('saved-panel').hidden = wide;
    document.querySelector('main').classList.toggle('single', wide);
    $('page-title').textContent = TITLES[view];
    document.title = `${TITLES[view].replace('Loan EMI d', 'D')} - EMI Calculator - Streamhub`;
  }
  window.addEventListener('hashchange', route);

  // boot: restore from a share link if present
  const q = Object.fromEntries(new URLSearchParams(location.search));
  if (Object.keys(q).length) applyState(q); else applyProduct('home', false);
  renderSaved();
  route();
  calculate();
})();
