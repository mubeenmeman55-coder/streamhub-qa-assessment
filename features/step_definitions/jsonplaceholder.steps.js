const { When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');
const { PostsApi } = require('../../pages/api/PostsApi');

async function capture(world, response) {
  world.response = response;
  world.text = await response.text();
  try {
    world.body = JSON.parse(world.text);
  } catch {
    world.body = undefined;
  }
  const preview = world.text.length > 300 ? `${world.text.slice(0, 300)}... (${world.text.length} chars)` : world.text;
  world.attach(`POST /posts -> HTTP ${response.status()} ${response.statusText()}\n${preview}`);
}

When('I create a post using the {string} payload', async function (name) {
  this.posts = new PostsApi(this.api);
  this.state.sent = this.posts.payload(name);
  this.state.payloadName = name;
  await capture(this, await this.posts.create(this.state.sent));
});

When('I send a malformed JSON body to create a post', async function () {
  this.posts = new PostsApi(this.api);
  await capture(this, await this.posts.createRaw('{"userId": 1, "title": "broken', 'application/json'));
});

When('I create a post with the content type {string}', async function (contentType) {
  this.posts = new PostsApi(this.api);
  await capture(this, await this.posts.createRaw('userId=1&title=x', contentType));
});

Then('the response body echoes the {string} payload and adds an id', async function (name) {
  expect(this.body).toMatchObject(this.posts.payload(name));
  expect(typeof this.body.id).toBe('number');
});

Then('the API does not fail with a server error', async function () {
  expect(this.response.status(), 'a 5xx means the server failed on this input').toBeLessThan(500);
});

Then(/^the API answers with a controlled status of 201, 400, 413 or 422$/, async function () {
  expect([201, 400, 413, 422]).toContain(this.response.status());
});

Then('a JSON body is returned when the request was accepted', async function () {
  if (this.response.status() !== 201) return;
  expect(this.body, 'accepted requests must return parseable JSON').toBeDefined();
  expect(typeof this.body).toBe('object');
});

Then('an accepted title is echoed back without truncation or corruption', async function () {
  if (this.response.status() !== 201) return; // rejected requests have nothing to echo
  const sent = this.state.sent.title;
  // JSON round-trip is the contract: what we sent must come back identical (NUL bytes etc. included)
  expect(this.body.title).toBe(sent);
  this.attach(`Title length sent/received: ${sent.length}/${this.body.title.length}`);
});

Then('the service answers with status {int} which is a documented deviation', async function (status) {
  this.attach(`Brief expects a 4xx for invalid input; the service actually answered ${this.response.status()}`);
  expect(this.response.status()).toBe(status);
});

// ---------- strict (validating posts API) ----------
Then('the error code is {string}', async function (code) {
  expect(this.body?.error?.code).toBe(code);
  expect(typeof this.body.error.message).toBe('string');
});

Then('the error for field {string} says {string}', async function (field, message) {
  const detail = (this.body.error.details || []).find((d) => d.field === field);
  expect(detail, `an error entry for "${field}"`).toBeDefined();
  expect(detail.message).toBe(message);
});

Then('the response omits the field {string}', async function (field) {
  expect(this.body).not.toHaveProperty(field);
});
