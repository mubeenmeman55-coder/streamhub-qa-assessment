const path = require('path');
const express = require('express');

function startWebApp(port) {
  const app = express();
  app.use(express.static(path.join(__dirname, 'public')));
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
    server.once('error', reject);
  });
}

module.exports = { startWebApp };

if (require.main === module) {
  const config = require('../../config/env');
  const port = new URL(config.webappUrl).port || 80;
  startWebApp(port).then(() => console.log(`EMI calculator app: ${config.webappUrl}`));
}
