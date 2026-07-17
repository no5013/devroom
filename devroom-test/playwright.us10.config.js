const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/us-10-close-poll-via-chat.spec.js'],
  outputDir: path.resolve(__dirname, '../03-test/us-10-close-poll-via-chat/artifacts'),
  reporter: [
    ['html', {
      outputFolder: path.resolve(__dirname, '../03-test/us-10-close-poll-via-chat/report'),
      open: 'never',
    }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3009',
    screenshot: 'on',
    headless: true,
  },
  webServer: {
    command: `PORT=3009 node ${path.resolve(__dirname, '../devroom/src/index.js')}`,
    url: 'http://localhost:3009',
    reuseExistingServer: false,
    timeout: 15000,
  },
});
