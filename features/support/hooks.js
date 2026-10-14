const fs = require('fs');
const path = require('path');
const { BeforeAll, AfterAll, Before, BeforeStep, After, Status } = require('@cucumber/cucumber');
const { chromium, request } = require('playwright');
const config = require('../../config/env');
const { startServer } = require('../../src/api/server');
const { startLiveView } = require('./liveview');

const SHOTS_DIR = path.join('reports', 'screenshots');
let browser;
let apiServer;
let live;
let currentPage = null;
const LIVE = process.env.LIVE_VIEW === 'true';

BeforeAll(async () => {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  if (LIVE) {
    live = startLiveView(Number(process.env.LIVE_VIEW_PORT || 3200), () => currentPage);
    const wait = Number(process.env.LIVE_VIEW_WAIT_MS || 20000);
    live.setStatus(`Viewer connected - tests start in ${wait / 1000}s`, 'Open/refresh this page, then watch.');
    await new Promise((r) => setTimeout(r, wait));
  }
  if (config.startApiServer) {
    const port = new URL(config.apiBaseUrl).port || 80;
    apiServer = await startServer(port);
  }
});

AfterAll(async () => {
  if (live) await live.close();
  if (browser) await browser.close();
  if (apiServer) await new Promise((resolve) => apiServer.close(resolve));
});

Before({ tags: '@ui' }, async function () {
  browser ??= await chromium.launch({ headless: config.headless, slowMo: config.slowMo });
  this.context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  this.context.setDefaultTimeout(config.timeout);
  this.page = await this.context.newPage();
  currentPage = this.page;
});

BeforeStep(async function ({ pickleStep, pickle }) {
  if (live && this.page) {
    live.setStatus(pickle.name, `${pickleStep.type === 'Outcome' ? 'Then' : pickleStep.type === 'Action' ? 'When' : 'Given'} ${pickleStep.text}`);
    await new Promise((r) => setTimeout(r, 700)); // let the viewer show each step
  }
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
    if (live) await new Promise((r) => setTimeout(r, 2500)); // hold the final state on screen
    currentPage = null;
    await this.context.close();
  }
  if (this.api) await this.api.dispose();
});
