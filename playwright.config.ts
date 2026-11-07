import { defineConfig, devices } from '@playwright/test';

const mock = process.env.E2E_MOCK === '1';
const baseURL =
  process.env.E2E_BASE_URL ?? (mock ? 'http://localhost:8798' : 'https://localhost:8799');
const target = new URL(baseURL);
if (
  !['http:', 'https:'].includes(target.protocol) ||
  !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
) {
  throw new Error('E2E_BASE_URL must target a local server');
}
if (
  process.env.E2E_IPHONE_ENGINE &&
  !['webkit', 'chromium'].includes(process.env.E2E_IPHONE_ENGINE)
) {
  throw new Error('E2E_IPHONE_ENGINE must be webkit or chromium');
}
// Separate auth-ip rate-limit buckets per project; Cloudflare overwrites this header in production.
const clientIp = (n: number) => ({ extraHTTPHeaders: { 'CF-Connecting-IP': `198.51.100.${n}` } });
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  retries: process.env.CI ? 1 : 0,
  use: { baseURL, ignoreHTTPSErrors: true, trace: 'on-first-retry', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], ...clientIp(1) } },
    {
      name: 'iphone-15',
      use: {
        ...devices['iPhone 15'],
        ...clientIp(2),
        browserName: process.env.E2E_IPHONE_ENGINE === 'chromium' ? 'chromium' : 'webkit',
      },
    },
    { name: 'pixel-7', use: { ...devices['Pixel 7'], ...clientIp(3) } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: mock
          ? 'VITE_MOCK=1 npm run dev -w web -- --port 8798'
          : 'node e2e/reset-state.ts && npm run build -w web && npx wrangler dev --local-protocol https --port 8799 --persist-to .wrangler/e2e-state --var OYO_TEST_CLOCK:1 $(node scripts/generate-vapid-keys.ts --wrangler-args)',
        url: mock ? baseURL : `${baseURL}/api/health`,
        ignoreHTTPSErrors: true,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
