const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/us-05-participant-answer-poll.spec.js'],
  outputDir: path.resolve(__dirname, '../03-test/us-05-participant-answer-poll/artifacts'),
  reporter: [
    ['html', {
      outputFolder: path.resolve(__dirname, '../03-test/us-05-participant-answer-poll/report'),
      open: 'never',
    }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3004',
    screenshot: 'on',
    headless: true,
  },
  webServer: {
    command: `PORT=3004 node ${path.resolve(__dirname, '../devroom/src/index.js')}`,
    url: 'http://localhost:3004',
    reuseExistingServer: false,
    timeout: 15000,
  },
});
