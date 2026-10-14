const config = require('../config/env');

class BasePage {
  constructor(page) {
    this.page = page;
  }

  async goto(path = '/') {
    await this.page.goto(new URL(path, config.baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  }
}

module.exports = { BasePage };
