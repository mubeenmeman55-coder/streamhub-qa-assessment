const { setWorldConstructor, World, setDefaultTimeout } = require('@cucumber/cucumber');
const config = require('../../config/env');

setDefaultTimeout(60 * 1000);

class CustomWorld extends World {
  constructor(options) {
    super(options);
    this.config = config;
    this.page = null; // UI scenarios
    this.api = null; // API scenarios (Playwright APIRequestContext)
    this.response = null;
    this.body = null;
    this.state = {}; // scratch space shared between steps of one scenario
  }
}

setWorldConstructor(CustomWorld);
