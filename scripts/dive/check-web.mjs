import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import console from 'node:console';

const dir = new URL('../../web/dist/assets/', import.meta.url);
const names = (await readdir(dir)).filter((name) => /\.(js|css|map)$/.test(name));
assert(names.length, 'Build the web assets first');
const gems = ['Nyckelharpa', 'Casu marzu', 'Rotokas', 'Gamboge', 'Parasaurolophus'];
for (const name of names) {
  const source = await readFile(new URL(name, dir), 'utf8');
  for (const gem of gems)
    assert(
      !source.toLowerCase().includes(gem.toLowerCase()),
      `Worker answer ${gem} leaked into ${name}`,
    );
}
console.log(
  `PASS: ${names.length} built web assets contain none of ${gems.length} Worker-only Pearl strings (${gems.join(', ')}).`,
);
