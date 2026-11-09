import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkWorldleWeb } from './check-web.mjs';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'worldle-leak-'));
  await mkdir(join(dir, 'worldle'));
  await writeFile(join(dir, 'app.js'), 'const title = "Worldle";');
  await writeFile(join(dir, 'worldle', '0123456789abcdef.svg'), '<svg><path d="M0 0h1v1z"/></svg>');
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});
it('allows opaque SVG assets without scanning SVG IDs as bundle leaks', async () => {
  expect(await checkWorldleWeb(dir)).toContain('PASS:');
});
it.each(['WORLDLE_SCHEDULE', 'shape', 'schedule'])(
  'rejects %s in built JS, CSS and HTML',
  async (kind) => {
    const ids = JSON.parse(await readFile(new URL('./shape-ids.json', import.meta.url), 'utf8'));
    const data = await readFile(
      new URL('../../worker/src/games/worldle/data.ts', import.meta.url),
      'utf8',
    );
    const secret =
      kind === 'shape'
        ? Object.values(ids)[0]
        : kind === 'schedule'
          ? data.match(/WORLDLE_SCHEDULE\s*=\s*['"]([^'"]+)['"]/)![1]
          : kind;
    await writeFile(
      join(dir, kind === 'shape' ? 'app.css' : kind === 'schedule' ? 'index.html' : 'app.js'),
      String(secret),
    );
    await expect(checkWorldleWeb(dir)).rejects.toThrow('Worldle Worker data leaked');
  },
);
it.each([
  '<text>x</text>',
  '<title>x</title>',
  '<metadata/>',
  '<!-- France -->',
  '<path aria-label="France"/>',
])('rejects SVG names or descriptive markup: %s', async (markup) => {
  await writeFile(join(dir, 'worldle', '0123456789abcdef.svg'), `<svg>${markup}</svg>`);
  await expect(checkWorldleWeb(dir)).rejects.toThrow();
});
it('rejects named SVG files and missing assets', async () => {
  await writeFile(join(dir, 'worldle', 'france.svg'), '<svg/>');
  await expect(checkWorldleWeb(dir)).rejects.toThrow('Invalid Worldle SVG filename');
  await rm(join(dir, 'worldle'), { recursive: true });
  await mkdir(join(dir, 'worldle'));
  await expect(checkWorldleWeb(dir)).rejects.toThrow('Worldle SVG assets missing');
});
