const { createApp } = require('./app');

function startServer(port) {
  return new Promise((resolve, reject) => {
    const server = createApp().listen(port, () => resolve(server));
    server.once('error', reject);
  });
}

module.exports = { startServer };

if (require.main === module) {
  const config = require('../../config/env');
  const port = new URL(config.apiBaseUrl).port || 80;
  startServer(port).then(() => console.log(`Mock API listening on ${config.apiBaseUrl}`));
}
