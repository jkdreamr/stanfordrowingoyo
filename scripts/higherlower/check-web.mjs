import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import console from 'node:console';
import { URL } from 'node:url';

const bank = await readFile(
  new URL('../../worker/src/games/higherlower/data.ts', import.meta.url),
  'utf8',
);
const signature = bank.match(/HIGHERLOWER_SCHEDULE =\s*['"]([^'"]+)/)?.[1].slice(0, 96);
assert(signature, 'Missing Higher or Lower schedule');
const markers = [
  'higherlower-private-bank-v1',
  'HIGHERLOWER_CATEGORIES',
  'Alaska||1477953',
  'Maryland||25142',
  'New Mexico||314161',
  signature,
];
for (const marker of markers.slice(2, 5)) assert(bank.includes(marker));
const dir = new URL('../../web/dist/assets/', import.meta.url);
const names = (await readdir(dir)).filter((n) => /\.(js|css|map)$/.test(n));
assert(names.length, 'Build the web assets first');
for (const name of names) {
  const source = await readFile(new URL(name, dir), 'utf8');
  for (const marker of markers)
    assert(!source.includes(marker), `Higher or Lower bank leaked into ${name}`);
}
console.log(
  `PASS: ${names.length} built web assets exclude Higher or Lower private data and schedule.`,
);
