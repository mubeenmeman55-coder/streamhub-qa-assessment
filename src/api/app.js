const path = require('path');
const express = require('express');
const titles = require('./data/titles.json');
const { ApiError, allowOnly, single, number, oneOf } = require('./validation');

const TYPES = ['movie', 'series'];
const SORT_FIELDS = ['title', 'year', 'rating', 'duration'];
const GENRES = [...new Set(titles.map((t) => t.genre))].sort();

function createApp() {
  const app = express();
  const router = express.Router();

  router.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // GET /api/titles?genre&type&minYear&maxYear&minRating&q&sortBy&order&page&limit
  router.get('/titles', (req, res) => {
    const q = req.query;
    allowOnly(q, ['genre', 'type', 'minYear', 'maxYear', 'minRating', 'q', 'sortBy', 'order', 'page', 'limit']);

    const genre = oneOf(q, 'genre', GENRES);
    const type = oneOf(q, 'type', TYPES);
    const minYear = number(q, 'minYear', { integer: true, min: 1900, max: 2100 });
    const maxYear = number(q, 'maxYear', { integer: true, min: 1900, max: 2100 });
    const minRating = number(q, 'minRating', { min: 0, max: 10 });
    const search = single(q, 'q');
    const sortBy = oneOf(q, 'sortBy', SORT_FIELDS, 'id');
    const order = oneOf(q, 'order', ['asc', 'desc'], 'asc');
    const page = number(q, 'page', { integer: true, min: 1 }) ?? 1;
    const limit = number(q, 'limit', { integer: true, min: 1, max: 50 }) ?? 10;

    if (minYear !== undefined && maxYear !== undefined && minYear > maxYear) {
      throw new ApiError(400, 'INVALID_RANGE', "'minYear' must not be greater than 'maxYear'", { minYear, maxYear });
    }
    if (search !== undefined && search.length > 100) {
      throw new ApiError(400, 'INVALID_PARAMETER', "'q' must be at most 100 characters");
    }

    let result = titles.filter(
      (t) =>
        (!genre || t.genre === genre) &&
        (!type || t.type === type) &&
        (minYear === undefined || t.year >= minYear) &&
        (maxYear === undefined || t.year <= maxYear) &&
        (minRating === undefined || t.rating >= minRating) &&
        (!search || t.title.toLowerCase().includes(search.toLowerCase())),
    );

    const dir = order === 'desc' ? -1 : 1;
    result = [...result].sort((a, b) => {
      const x = a[sortBy];
      const y = b[sortBy];
      const cmp = typeof x === 'string' ? x.localeCompare(y) : x - y;
      return (cmp || a.id - b.id) * dir;
    });

    const total = result.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    if (page > totalPages) throw new ApiError(404, 'PAGE_OUT_OF_RANGE', `Page ${page} does not exist`, { totalPages });

    res.json({ data: result.slice((page - 1) * limit, page * limit), meta: { total, page, limit, totalPages } });
  });

  router.get('/titles/:id', (req, res) => {
    if (!/^\d+$/.test(req.params.id)) {
      throw new ApiError(400, 'INVALID_PARAMETER', "Path parameter 'id' must be a positive integer");
    }
    const found = titles.find((t) => t.id === Number(req.params.id));
    if (!found) throw new ApiError(404, 'NOT_FOUND', `Title ${req.params.id} not found`);
    res.json({ data: found });
  });

  router.get('/genres', (_req, res) => {
    res.json({ data: GENRES.map((name) => ({ name, count: titles.filter((t) => t.genre === name).length })) });
  });

  // GET /api/emi?principal&rate&years - same maths the UI tests verify against emicalculator.net
  router.get('/emi', (req, res) => {
    const q = req.query;
    allowOnly(q, ['principal', 'rate', 'years']);
    const principal = number(q, 'principal', { required: true, min: 1, max: 1e9 });
    const rate = number(q, 'rate', { required: true, min: 0.1, max: 50 });
    const years = number(q, 'years', { required: true, min: 1, max: 40, integer: true });
    const r = rate / 12 / 100;
    const n = years * 12;
    const emi = (principal * r * (1 + r) ** n) / ((1 + r) ** n - 1);
    const totalPayment = emi * n;
    res.json({
      data: {
        principal,
        rate,
        years,
        emi: Math.round(emi),
        totalInterest: Math.round(totalPayment - principal),
        totalPayment: Math.round(totalPayment),
      },
    });
  });

  // Browser UI for the API (catalogue explorer, EMI calculator, API explorer)
  app.use(express.static(path.join(__dirname, 'public')));

  app.use('/api', router);

  app.use((req, _res, next) => next(new ApiError(404, 'ROUTE_NOT_FOUND', `No route for ${req.method} ${req.path}`)));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    res.status(status).json({ error: { code: err.code || 'INTERNAL_ERROR', message: err.message, details: err.details } });
  });
  return app;
}

module.exports = { createApp };
