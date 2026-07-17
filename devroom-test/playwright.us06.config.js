const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/us-06-live-poll-results.spec.js'],
  outputDir: path.resolve(__dirname, '../03-test/us-06-live-poll-results/artifacts'),
  reporter: [
    ['html', {
      outputFolder: path.resolve(__dirname, '../03-test/us-06-live-poll-results/report'),
      open: 'never',
    }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3005',
    screenshot: 'on',
    headless: true,
  },
  webServer: {
    command: `PORT=3005 node ${path.resolve(__dirname, '../devroom/src/index.js')}`,
    url: 'http://localhost:3005',
    reuseExistingServer: false,
    timeout: 15000,
  },
});
