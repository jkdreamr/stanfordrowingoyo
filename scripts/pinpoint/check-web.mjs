import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import console from 'node:console';
import { URL } from 'node:url';
import { pinpointPuzzles } from '../../worker/src/games/pinpoint/puzzles.ts';

const dir = new URL('../../web/dist/assets/', import.meta.url);
const names = (await readdir(dir)).filter((name) => /\.(js|css|map)$/.test(name));
assert(names.length, 'Build the web assets first');
const secrets = [...new Set(pinpointPuzzles().flatMap((p) => [p.category, ...p.accepted]))].filter(
  (s) => s.length >= 8,
);
for (const name of names) {
  const source = (await readFile(new URL(name, dir), 'utf8')).toLowerCase();
  for (const secret of secrets)
    assert(!source.includes(secret.toLowerCase()), `Pinpoint answer ${secret} leaked into ${name}`);
}
console.log(
  `PASS: ${names.length} built web assets contain none of ${secrets.length} Worker-only Pinpoint strings.`,
);
