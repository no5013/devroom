const { defineConfig } = require('@playwright/test');
const path = require('path');

const SCREENSHOTS_DIR = path.resolve(__dirname, '../03-test/us-01-join-session/screenshots');

module.exports = defineConfig({
  testDir: './tests/e2e',
  outputDir: path.resolve(__dirname, '../03-test/us-01-join-session/artifacts'),
  reporter: [
    ['html', {
      outputFolder: path.resolve(__dirname, '../03-test/us-01-join-session/report'),
      open: 'never',
    }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'on',
    headless: true,
  },
  webServer: {
    command: `node ${path.resolve(__dirname, '../devroom/src/index.js')}`,
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 10000,
  },
});

module.exports.SCREENSHOTS_DIR = SCREENSHOTS_DIR;
