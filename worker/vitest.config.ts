import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { generateVapidKeys } from '../scripts/generate-vapid-keys.ts';
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync(new URL('../web/dist/games/', import.meta.url), { recursive: true });
copyFileSync(
  new URL('../web/public/games/crossword.dat', import.meta.url),
  new URL('../web/dist/games/crossword.dat', import.meta.url),
);

const vapid = generateVapidKeys();
export default defineConfig({
  test: { fileParallelism: false },
  plugins: [
    cloudflareTest({
      wrangler: { configPath: '../wrangler.jsonc' },
      miniflare: {
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
