import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { compile, root } from './build.mjs';

it('committed crossword asset and metadata are deterministic and current', async () => {
  const first = await compile();
  const second = await compile();
  expect(first).toEqual(second);
  expect(await readFile(new URL('web/public/games/crossword.dat', root))).toEqual(first.dat);
  expect(await readFile(new URL('worker/src/games/crossword/data.ts', root), 'utf8')).toBe(
    first.ts,
  );
});
