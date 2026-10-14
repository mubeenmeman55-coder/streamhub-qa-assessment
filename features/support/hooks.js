const fs = require('fs');
const path = require('path');
const { BeforeAll, AfterAll, Before, BeforeStep, AfterStep, After, Status } = require('@cucumber/cucumber');
const { chromium, request } = require('playwright');
const config = require('../../config/env');
const { startServer } = require('../../src/api/server');
const { startWebApp } = require('../../src/webapp/server');
const { startLiveView } = require('./liveview');

const SHOTS_DIR = path.join('reports', 'screenshots');
let browser;
let apiServer;
let webServer;

// A server that is already listening on the port (e.g. started by hand for demos) is reused instead of failing
const startOrReuse = (start, port, name) => start(port).catch((e) => {
  if (e.code === 'EADDRINUSE') return null;
  throw new Error(`Could not start ${name} on port ${port}: ${e.message}`);
});
let live;
const LIVE = process.env.LIVE_VIEW === 'true';

BeforeAll(async () => {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  if (LIVE) {
    live = startLiveView(Number(process.env.LIVE_VIEW_PORT || 3200));
    const wait = Number(process.env.LIVE_VIEW_WAIT_MS || 10000);
    live.message(`Viewer connected - tests start in ${wait / 1000}s`, 'Open or refresh this page, then watch.');
    await new Promise((r) => setTimeout(r, wait));
  }
  if (config.startApiServer) {
    const port = new URL(config.apiBaseUrl).port || 80;
    apiServer = await startOrReuse(startServer, port, 'mock API');
  }
  if (config.startWebApp) {
    webServer = await startOrReuse(startWebApp, new URL(config.webappUrl).port || 80, 'EMI web app');
  }
});

AfterAll(async () => {
  if (live) {
    live.finish();
    await new Promise((r) => setTimeout(r, 8000)); // keep the final result on screen
    await live.close();
  }
  if (browser) await browser.close();
  if (apiServer) await new Promise((resolve) => apiServer.close(resolve));
  if (webServer) await new Promise((resolve) => webServer.close(resolve));
});

Before({ tags: '@ui' }, async function ({ pickle }) {
  browser ??= await chromium.launch({ headless: config.headless, slowMo: config.slowMo });
  this.context = await browser.newContext({ viewport: { width: 1366, height: 900 }, colorScheme: 'light' });
  this.context.setDefaultTimeout(config.timeout);
  this.page = await this.context.newPage();
  if (live) await live.attach(this.page, pickle.name);
});

BeforeStep(async function ({ pickleStep }) {
  if (live && this.page) {
    live.stepStart(pickleStep.text);
    await new Promise((r) => setTimeout(r, 250)); // brief beat so each step is visible
  }
});

AfterStep(async function ({ result }) {
  if (live && this.page) live.stepEnd(result.status === Status.PASSED);
});

Before({ tags: '@api' }, async function () {
  this.api = await request.newContext({ baseURL: config.apiBaseUrl });
});

Before({ tags: '@jsonplaceholder' }, async function () {
  this.api = await request.newContext({ baseURL: config.jsonPlaceholderUrl, timeout: 30000 });
});

After(async function (scenario) {
  if (this.page) {
    const name = scenario.pickle.name.replace(/[^a-z0-9]+/gi, '_').slice(0, 80);
    const failed = scenario.result?.status === Status.FAILED;
    // Keep a screenshot for every UI scenario (evidence for the report), flagged when failed
    const file = path.join(SHOTS_DIR, `${failed ? 'FAILED_' : ''}${name}.png`);
    const png = await this.page.screenshot({ path: file, fullPage: false }).catch(() => null);
    if (png) this.attach(png, 'image/png');
    if (live) {
      await new Promise((r) => setTimeout(r, 1500)); // hold the final state on screen
      await live.detach(failed);
    }
    await this.context.close();
  }
  if (this.api) await this.api.dispose();
});
