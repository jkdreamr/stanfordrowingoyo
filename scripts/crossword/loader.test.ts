import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { loadCrossword } from '../../worker/src/games/crossword/puzzles';
import type { Env } from '../../worker/src/index';

it('retries failed fetch/decrypt and decrypts and decodes only once', async () => {
  const data = await readFile(new URL('../../web/public/games/crossword.dat', import.meta.url));
  let fetches = 0;
  let mode = 'missing';
  const bindings = {
    ASSETS: {
      fetch: async () => {
        fetches++;
        if (mode === 'missing') return new Response(null, { status: 404 });
        if (mode === 'corrupt') return new Response(new Uint8Array(data.length));
        return new Response(data);
      },
    },
  } as unknown as Pick<Env, 'ASSETS'>;
  await expect(loadCrossword(bindings)).rejects.toThrow('Crossword asset unavailable');
  mode = 'corrupt';
  await expect(loadCrossword(bindings)).rejects.toThrow();
  mode = 'valid';
  const before = performance.now();
  const promise = loadCrossword(bindings);
  expect(loadCrossword(bindings)).toBe(promise);
  const puzzles = await promise;
  console.log(
    `Crossword cold decrypt/hash/decode: ${(performance.now() - before).toFixed(3)} ms (${puzzles.length} puzzles)`,
  );
  expect(await loadCrossword(bindings)).toBe(puzzles);
  expect(fetches).toBe(3);
  expect(puzzles[0].solution).toHaveLength(25);
});
