import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { generateVapidKeys } from '../scripts/generate-vapid-keys.ts';

const vapid = generateVapidKeys();
export default defineConfig({
  define: { __OYO_DIVE_TEST__: 'true' },
  test: { fileParallelism: false },
  plugins: [
    cloudflareTest({
      wrangler: { configPath: '../wrangler.jsonc' },
      miniflare: {
        assets: { directory: './private-assets' },
        bindings: {
          OYO_TEST_CLOCK: '1',
          TEAM_CODE: 'koo26',
          PASSWORD_PEPPER: 'test-only-password-pepper',
          VAPID_PUBLIC_KEY: vapid.publicKey,
          VAPID_PRIVATE_KEY: vapid.privateKey,
          VAPID_SUBJECT: 'mailto:oyo-test@example.com',
        },
      },
    }),
  ],
});
