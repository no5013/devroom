const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/us-02-realtime-chat.spec.js'],
  outputDir: path.resolve(__dirname, '../03-test/us-02-realtime-chat/artifacts'),
  reporter: [
    ['html', {
      outputFolder: path.resolve(__dirname, '../03-test/us-02-realtime-chat/report'),
      open: 'never',
    }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3001',
    screenshot: 'on',
    headless: true,
  },
  webServer: {
    command: `PORT=3001 node ${path.resolve(__dirname, '../devroom/src/index.js')}`,
    url: 'http://localhost:3001',
    reuseExistingServer: false,
    timeout: 15000,
  },
});
