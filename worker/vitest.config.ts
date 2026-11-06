import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: '../wrangler.jsonc' },
      miniflare: { compatibilityDate: '2026-08-22', bindings: { OYO_TEST_CLOCK: '1' } },
    }),
  ],
});
