const path = require('path');
const dotenv = require('dotenv');

const envName = process.env.TEST_ENV || 'qa';
// Real environment variables win over the file (dotenv never overrides existing ones)
dotenv.config({ path: path.join(__dirname, 'environments', `${envName}.env`), quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name} (TEST_ENV=${envName})`);
  return value;
}

module.exports = {
  envName,
  baseUrl: required('BASE_URL'),
  apiBaseUrl: required('API_BASE_URL'),
  startApiServer: process.env.START_API_SERVER !== 'false',
  blockAds: process.env.BLOCK_ADS !== 'false',
  headless: process.env.HEADLESS !== 'false',
  slowMo: Number(process.env.SLOW_MO || 0),
  timeout: Number(process.env.DEFAULT_TIMEOUT_MS || 15000),
};
