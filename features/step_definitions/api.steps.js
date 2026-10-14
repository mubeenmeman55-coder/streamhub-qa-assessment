const { When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');
const { CatalogApi } = require('../../pages/api/CatalogApi');
const { summary } = require('../../utils/emi');

const TITLE_FIELDS = { id: 'number', title: 'string', type: 'string', genre: 'string', year: 'number', rating: 'number', duration: 'number' };

async function send(world, call) {
  world.catalog ??= new CatalogApi(world.api);
  world.response = await call(world.catalog);
  world.body = await world.response.json();
  world.attach(`HTTP ${world.response.status()} ${world.response.url()}\n${JSON.stringify(world.body, null, 2).slice(0, 1500)}`);
}

function expectTitleShape(t) {
  for (const [field, type] of Object.entries(TITLE_FIELDS)) expect(typeof t[field], `${field} type`).toBe(type);
}

// ---------- requests ----------
When('I request the titles list with no parameters', (async function () { await send(this, (c) => c.listTitles()); }));

When('I request the titles list with {string} set to {string}', async function (param, value) {
  this.state.params = { [param]: value };
  await send(this, (c) => c.listTitles(this.state.params));
});

When('I request the titles list with:', async function (table) {
  this.state.params = Object.fromEntries(table.raw());
  await send(this, (c) => c.listTitles(this.state.params));
});

When('I request the titles list with a search text of {int} characters', async function (n) {
  await send(this, (c) => c.listTitles({ q: 'a'.repeat(n) }));
});

When('I request the title with id {int}', async function (id) {
  await send(this, (c) => c.getTitle(id));
});

When('I send the raw request {string}', async function (pathAndQuery) {
  await send(this, (c) => c.getRaw(pathAndQuery));
});

When('I request the genres', async function () {
  await send(this, (c) => c.genres());
});

When('I request the EMI for principal {float}, rate {float} and years {int}', async function (principal, rate, years) {
  this.state.loan = { principal, rate, years };
  await send(this, (c) => c.emi({ principal, rate, years }));
});

When('I fetch every page of titles with limit {int}', async function (limit) {
  const catalog = new CatalogApi(this.api);
  this.state.pages = [];
  for (let page = 1; page <= 20; page++) {
    const res = await catalog.listTitles({ limit, page });
    expect(res.status()).toBe(200);
    const body = await res.json();
    this.state.pages.push(body);
    if (page >= body.meta.totalPages) break;
  }
});

// ---------- assertions ----------
Then('the response status is {int}', async function (status) {
  expect(this.response.status()).toBe(status);
  expect(this.response.headers()['content-type']).toContain('application/json');
});

Then('the response has a {string} array of titles and pagination {string}', async function (dataKey, metaKey) {
  expect(Array.isArray(this.body[dataKey])).toBe(true);
  expect(this.body[dataKey].length).toBeGreaterThan(0);
  this.body[dataKey].forEach(expectTitleShape);
  expect(Object.keys(this.body[metaKey]).sort()).toEqual(['limit', 'page', 'total', 'totalPages']);
});

Then('the page size used is {int} and the page is {int}', async function (limit, page) {
  expect(this.body.meta).toMatchObject({ limit, page });
  expect(this.body.data.length).toBeLessThanOrEqual(limit);
});

Then('every returned title satisfies {string} {string}', async function (param, value) {
  expect(this.body.data.length, 'filter should return at least one title').toBeGreaterThan(0);
  const rules = {
    genre: (t) => t.genre === value,
    type: (t) => t.type === value,
    minYear: (t) => t.year >= Number(value),
    maxYear: (t) => t.year <= Number(value),
    minRating: (t) => t.rating >= Number(value),
    q: (t) => t.title.toLowerCase().includes(value.toLowerCase()),
  };
  for (const t of this.body.data) expect(rules[param](t), `${JSON.stringify(t)} vs ${param}=${value}`).toBe(true);
});

Then('the titles are sorted by {string} {string}', async function (field, order) {
  const values = this.body.data.map((t) => t[field]);
  expect(values.length).toBeGreaterThan(1);
  const sorted = [...values].sort((a, b) => (typeof a === 'string' ? a.localeCompare(b) : a - b));
  if (order === 'desc') sorted.reverse();
  expect(values).toEqual(sorted);
});

Then('the pagination meta reports limit {int} and page {int}', async function (limit, page) {
  expect(this.body.meta).toMatchObject({ limit, page });
});

Then('at most {int} titles are returned', async function (n) {
  expect(this.body.data.length).toBeLessThanOrEqual(n);
});

Then('the title has id {int} and all expected fields', async function (id) {
  expect(this.body.data.id).toBe(id);
  expectTitleShape(this.body.data);
});

Then('the error response has code {string} and a helpful message', async function (code) {
  expect(Object.keys(this.body)).toEqual(['error']);
  expect(this.body.error.code).toBe(code);
  expect(typeof this.body.error.message).toBe('string');
  expect(this.body.error.message.length).toBeGreaterThan(5);
});

Then('the pages contain each title exactly once', async function () {
  const ids = this.state.pages.flatMap((p) => p.data.map((t) => t.id));
  expect(new Set(ids).size, 'no duplicates across pages').toBe(ids.length);
  expect(ids.length).toBe(this.state.pages[0].meta.total);
});

Then('the genre counts add up to the total number of titles', async function () {
  const catalog = new CatalogApi(this.api);
  const all = await (await catalog.listTitles({ limit: 50 })).json();
  const sum = this.body.data.reduce((acc, g) => acc + g.count, 0);
  expect(sum).toBe(all.meta.total);
  for (const g of this.body.data) {
    const res = await (await catalog.listTitles({ genre: g.name, limit: 50 })).json();
    expect(res.meta.total, `count for ${g.name}`).toBe(g.count);
  }
});

Then('the EMI response matches my own calculation', async function () {
  const { principal, rate, years } = this.state.loan;
  const expected = summary(principal, rate, years);
  const d = this.body.data;
  expect(d).toMatchObject({ principal, rate, years });
  expect(Math.abs(d.emi - expected.emi)).toBeLessThanOrEqual(1);
  expect(Math.abs(d.totalInterest - expected.totalInterest)).toBeLessThanOrEqual(1);
  expect(Math.abs(d.totalPayment - expected.totalPayment)).toBeLessThanOrEqual(1);
});
