import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import console from 'node:console';

const dir = new URL('../../dist/worker/', import.meta.url);
const files = (await readdir(dir, { recursive: true })).filter((name) => /\.m?js$/.test(name));
assert(files.length, 'Build the Worker dry-run output first');
for (const file of files) {
  const body = (await readFile(new URL(file, dir), 'utf8')).toLowerCase();
  for (const pearl of ['Nyckelharpa', 'Casu marzu', 'Rotokas', 'Gamboge', 'Parasaurolophus'])
    assert(
      !body.includes(pearl.toLowerCase()),
      `Dive answer ${pearl} leaked into Worker bundle ${file}`,
    );
}
console.log(`PASS: ${files.length} Worker bundle files exclude Dive Pearl strings.`);
