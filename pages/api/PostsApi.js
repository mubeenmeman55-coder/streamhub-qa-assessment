/** Client + payload catalogue for JSONPlaceholder's POST /posts (the API-side page object). */
const valid = { userId: 1, title: 'A valid title', body: 'A valid body' };

/** Named payloads, so feature files stay readable while the awkward data lives in one place. */
const PAYLOADS = {
  valid,
  'title-1k': { ...valid, title: 'a'.repeat(1_000) },
  'title-10k': { ...valid, title: 'a'.repeat(10_000) },
  'title-100k': { ...valid, title: 'a'.repeat(100_000) },
  'title-1m': { ...valid, title: 'a'.repeat(1_000_000) },
  'html-script': { ...valid, title: '<script>alert("x")</script><img src=x onerror=alert(1)>' },
  'sql-injection': { ...valid, title: "'; DROP TABLE posts; --" },
  emoji: { ...valid, title: 'Launch \u{1F680}\u{1F525} \u{1F468}‍\u{1F469}‍\u{1F467} café' },
  'control-chars': { ...valid, title: 'line1\nline2\ttab\r\nend\u0007bell\u001b[31m' },
  'null-byte': { ...valid, title: 'before\u0000after' },
  'rtl-unicode': { ...valid, title: '‮evil‬ مرحبا 你好' },
  'json-breakers': { ...valid, title: '"}],{"userId":99,"title":"injected' },
  'path-traversal': { ...valid, title: '../../etc/passwd%00%2e%2e%2f' },
  'missing-userId': { title: valid.title, body: valid.body },
  'missing-title': { userId: 1, body: valid.body },
  'missing-body': { userId: 1, title: valid.title },
  'empty-object': {},
  'userId-string': { ...valid, userId: 'not-a-number' },
  'userId-negative': { ...valid, userId: -1 },
  'title-null': { ...valid, title: null },
  'title-object': { ...valid, title: { nested: ['x'] } },
  'extra-fields': { ...valid, isAdmin: true, __proto__x: 'x' },
};

class PostsApi {
  constructor(request) {
    this.request = request;
  }

  payload(name) {
    if (!(name in PAYLOADS)) throw new Error(`Unknown payload "${name}"`);
    return PAYLOADS[name];
  }

  create(payload) {
    return this.request.post('/posts', { data: payload });
  }

  createRaw(body, contentType) {
    return this.request.post('/posts', { data: body, headers: { 'content-type': contentType } });
  }
}

module.exports = { PostsApi, PAYLOADS };
