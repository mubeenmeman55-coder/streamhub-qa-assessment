const fs = require('fs');
const path = require('path');
const { BeforeAll, AfterAll, Before, After, Status } = require('@cucumber/cucumber');
const { chromium, request } = require('playwright');
const config = require('../../config/env');
const { startServer } = require('../../src/api/server');

const SHOTS_DIR = path.join('reports', 'screenshots');
let browser;
let apiServer;

BeforeAll(async () => {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  if (config.startApiServer) {
    const port = new URL(config.apiBaseUrl).port || 80;
    apiServer = await startServer(port);
  }
});

AfterAll(async () => {
  if (browser) await browser.close();
  if (apiServer) await new Promise((resolve) => apiServer.close(resolve));
});

Before({ tags: '@ui' }, async function () {
  browser ??= await chromium.launch({ headless: config.headless, slowMo: config.slowMo });
  this.context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  this.context.setDefaultTimeout(config.timeout);
  this.page = await this.context.newPage();
});

Before({ tags: '@api' }, async function () {
  this.api = await request.newContext({ baseURL: config.apiBaseUrl });
});

After(async function (scenario) {
  if (this.page) {
    const name = scenario.pickle.name.replace(/[^a-z0-9]+/gi, '_').slice(0, 80);
    const failed = scenario.result?.status === Status.FAILED;
    // Keep a screenshot for every UI scenario (evidence for the report), flagged when failed
    const file = path.join(SHOTS_DIR, `${failed ? 'FAILED_' : ''}${name}.png`);
    const png = await this.page.screenshot({ path: file, fullPage: false }).catch(() => null);
    if (png) this.attach(png, 'image/png');
    await this.context.close();
  }
  if (this.api) await this.api.dispose();
});
