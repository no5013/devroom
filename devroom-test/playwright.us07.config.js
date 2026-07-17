const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/us-07-poll-chat-command.spec.js'],
  outputDir: path.resolve(__dirname, '../03-test/us-07-poll-chat-command/artifacts'),
  reporter: [
    ['html', {
      outputFolder: path.resolve(__dirname, '../03-test/us-07-poll-chat-command/report'),
      open: 'never',
    }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3006',
    screenshot: 'on',
    headless: true,
  },
  webServer: {
    command: `PORT=3006 node ${path.resolve(__dirname, '../devroom/src/index.js')}`,
    url: 'http://localhost:3006',
    reuseExistingServer: false,
    timeout: 15000,
  },
});
