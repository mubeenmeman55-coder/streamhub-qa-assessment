/**
 * A small posts API with the validation JSONPlaceholder lacks. It exists so the Section A3 expectation
 * ("appropriate HTTP error codes for invalid input, no server-side failures") can be demonstrated and tested.
 *
 *   POST /posts   { userId: positive integer (required), title: 1-200 chars (required), body: string <= 1000 (optional) }
 *
 *   201  created, echoes the stored post with an id
 *   400  malformed JSON
 *   413  body larger than 100 KB
 *   415  content type is not application/json
 *   422  validation failed, with a list of the offending fields
 *
 * Policy on special characters: text such as <script>, SQL fragments and emoji is ordinary data and is stored as-is
 * (escaping is an output concern). What is *unsupported* is anything that corrupts text handling: control characters
 * (including NUL) and bidirectional override characters.
 */
const express = require('express');

const TITLE_MAX = 200;
const BODY_MAX = 1000;
// C0 controls except tab/newline/carriage return, DEL, and bidi embedding/override/isolate characters
const UNSUPPORTED_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/;

function validate(input) {
  const problems = [];
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return [{ field: '(body)', message: 'Request body must be a JSON object' }];
  }
  const { userId, title, body } = input;
  if (userId === undefined) problems.push({ field: 'userId', message: 'userId is required' });
  else if (!Number.isInteger(userId) || userId < 1) problems.push({ field: 'userId', message: 'userId must be a positive integer' });

  if (title === undefined || title === null) problems.push({ field: 'title', message: 'title is required' });
  else if (typeof title !== 'string') problems.push({ field: 'title', message: 'title must be a string' });
  else if (title.trim().length === 0) problems.push({ field: 'title', message: 'title must not be empty' });
  else if (title.length > TITLE_MAX) problems.push({ field: 'title', message: `title must be at most ${TITLE_MAX} characters` });
  else if (UNSUPPORTED_CHARS.test(title)) problems.push({ field: 'title', message: 'title contains unsupported control or bidirectional characters' });

  if (body !== undefined) {
    if (typeof body !== 'string') problems.push({ field: 'body', message: 'body must be a string' });
    else if (body.length > BODY_MAX) problems.push({ field: 'body', message: `body must be at most ${BODY_MAX} characters` });
    else if (UNSUPPORTED_CHARS.test(body)) problems.push({ field: 'body', message: 'body contains unsupported control or bidirectional characters' });
  }
  return problems;
}

function createApp() {
  const app = express();
  let nextId = 101;

  app.post('/posts', (req, res, next) => {
    if (!req.is('application/json')) {
      return res.status(415).json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Content-Type must be application/json' } });
    }
    next();
  }, express.json({ limit: '100kb' }), (req, res) => {
    const problems = validate(req.body);
    if (problems.length) {
      return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'The post is invalid', details: problems } });
    }
    const { userId, title, body } = req.body; // unknown fields are ignored, never stored
    res.status(201).json({ id: nextId++, userId, title, ...(body !== undefined && { body }) });
  });

  app.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'MALFORMED_JSON', message: 'Request body is not valid JSON' } });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds 100 KB' } });
    res.status(err.status || 500).json({ error: { code: 'INTERNAL_ERROR', message: err.status ? err.message : 'Unexpected error' } });
  });
  return app;
}

function startPostsApi(port) {
  return new Promise((resolve, reject) => {
    const server = createApp().listen(port, () => resolve(server));
    server.once('error', reject);
  });
}

module.exports = { startPostsApi, validate };

if (require.main === module) {
  const config = require('../../config/env');
  startPostsApi(new URL(config.postsApiUrl).port || 80).then(() => console.log(`Validating posts API: ${config.postsApiUrl}`));
}
