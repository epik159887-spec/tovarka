import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true,
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ??
        (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
      args: ['--no-sandbox'],
    },
    screenshot: 'only-on-failure',
  },
});
