const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.cjs/,
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  // usa o Chrome do sistema (channel 'chrome') — não depende do download do Chromium do Playwright.
  use: { baseURL: 'http://localhost:8799', headless: true, channel: 'chrome' },
  webServer: {
    command: 'node static-server.cjs 8799',
    port: 8799,
    reuseExistingServer: true,
    timeout: 20000
  }
});
