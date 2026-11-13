const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.cjs/,
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  // 1 retry: um teste que falha por lentidão pontual da máquina (timeout) tenta de novo e passa;
  // uma falha REAL (determinística) reprova as duas vezes e continua bloqueando o push.
  retries: 1,
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
