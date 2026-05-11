import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 120000,
  expect: { timeout: 10000 },
  use: {
    viewport: { width: 390, height: 844 }, // iPhone 14 size (mobile-first)
    screenshot: 'on',
    video: 'on',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chrome',
      use: { browserName: 'chromium' },
    },
  ],
  reporter: [
    ['list'],
    ['html', { outputFolder: './e2e-report' }],
  ],
});
