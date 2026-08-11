import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? 'html' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // Both halves of the stack. The browser only ever talks to :5173; Vite proxies
  // /api through to the API, exactly as Caddy will in production.
  webServer: [
    {
      command: 'pnpm --filter @fitmybike/api start',
      url: 'http://localhost:3000/api/health',
      cwd: repoRoot,
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @fitmybike/web dev',
      url: 'http://localhost:5173',
      cwd: repoRoot,
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
  ],
});
