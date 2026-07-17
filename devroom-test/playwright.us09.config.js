const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/us-09-vote-in-chat.spec.js'],
  outputDir: path.resolve(__dirname, '../03-test/us-09-vote-in-chat/artifacts'),
  reporter: [
    ['html', {
      outputFolder: path.resolve(__dirname, '../03-test/us-09-vote-in-chat/report'),
      open: 'never',
    }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3008',
    screenshot: 'on',
    headless: true,
  },
  webServer: {
    command: `PORT=3008 node ${path.resolve(__dirname, '../devroom/src/index.js')}`,
    url: 'http://localhost:3008',
    reuseExistingServer: false,
    timeout: 15000,
  },
});
