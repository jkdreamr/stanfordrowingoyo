import { rm } from 'node:fs/promises';

await rm(new URL('../.wrangler/e2e-state/', import.meta.url), { recursive: true, force: true });
