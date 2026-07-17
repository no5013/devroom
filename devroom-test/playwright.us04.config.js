const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/us-04-instructor-create-poll.spec.js'],
  outputDir: path.resolve(__dirname, '../03-test/us-04-instructor-create-poll/artifacts'),
  reporter: [
    ['html', {
      outputFolder: path.resolve(__dirname, '../03-test/us-04-instructor-create-poll/report'),
      open: 'never',
    }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3003',
    screenshot: 'on',
    headless: true,
  },
  webServer: {
    command: `PORT=3003 node ${path.resolve(__dirname, '../devroom/src/index.js')}`,
    url: 'http://localhost:3003',
    reuseExistingServer: false,
    timeout: 15000,
  },
});
