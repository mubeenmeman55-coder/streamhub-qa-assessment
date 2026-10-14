/** "₹ 1,07,96,711" / "10,00,000" / "46.3%" -> number */
function toNumber(text) {
  const cleaned = String(text).replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || Number.isNaN(Number(cleaned))) throw new Error(`Cannot parse number from "${text}"`);
  return Number(cleaned);
}

/** Lakh shorthand used in the feature files: "25L" -> 2500000 */
function lakhs(text) {
  const m = /^(\d+(?:\.\d+)?)\s*L$/i.exec(text.trim());
  if (!m) throw new Error(`Expected a lakh amount like "25L", got "${text}"`);
  return Math.round(Number(m[1]) * 100000);
}

module.exports = { toNumber, lakhs };
