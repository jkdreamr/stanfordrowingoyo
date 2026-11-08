import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ResolvedConfig } from 'vite';
import { afterEach, expect, it } from 'vitest';
import { pwaPlugin } from './pwaPlugin';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'oyo-pwa-'));
  directories.push(root);
  const dist = join(root, 'dist');
  mkdirSync(dist);
  const plugin = pwaPlugin();
  const configure = plugin.configResolved;
  if (typeof configure !== 'function') throw new Error('Missing configuration hook');
  configure.call({} as never, { root, build: { outDir: 'dist' } } as ResolvedConfig);
  const close = plugin.closeBundle;
  const build = typeof close === 'function' ? close : close?.handler;
  if (!build) throw new Error('Missing bundle hook');
  return {
    dist,
    build: async () => {
      await build.call({} as never);
      return readFileSync(join(dist, 'sw.js'), 'utf8');
    },
  };
}

it('precaches nested font assets and changes cache versions when their bytes change', async () => {
  const { dist, build } = fixture();
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'index.html'), '<html></html>');
  const font = join(dist, 'assets', 'inter-latin.woff2');
  writeFileSync(font, 'font-v1');
  writeFileSync(join(dist, 'assets', 'unlisted.map'), '{}');
  const first = await build();
  expect(first).toContain('const ASSETS=["/assets/inter-latin.woff2","/index.html"]');
  writeFileSync(font, 'font-v2');
  const second = await build();
  expect(first.match(/const CACHE='([^']+)'/)?.[1]).not.toBe(
    second.match(/const CACHE='([^']+)'/)?.[1],
  );
});

it('supports an empty output directory without caching the worker itself', async () => {
  const { build } = fixture();
  expect(await build()).toContain('const ASSETS=[]');
  expect(await build()).toContain('const ASSETS=[]');
});

it('surfaces a missing build output rather than generating an incomplete cache', async () => {
  const { dist, build } = fixture();
  rmSync(dist, { recursive: true });
  await expect(build()).rejects.toThrow('ENOENT');
});
