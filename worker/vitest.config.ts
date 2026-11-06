import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-plugin';
export default defineConfig({
  test: { fileParallelism: false },
  plugins: [
    cloudflareTest({
      wrangler: { configPath: '../wrangler.jsonc' },
      miniflare: { bindings: { OYO_TEST_CLOCK: '1' } },
    }),
  ],
});
