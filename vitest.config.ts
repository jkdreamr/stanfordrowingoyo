import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { exclude: ['worker/**', '**/node_modules/**', 'scripts/dive/recall.test.mjs'] },
});
