import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import console from 'node:console';

const dir = new URL('../../web/dist/assets/', import.meta.url);
const names = (await readdir(dir)).filter((name) => /\.(js|map)$/.test(name));
assert(names.length, 'Build the web assets first');
for (const name of names) {
  const source = await readFile(new URL(name, dir), 'utf8');
  assert(
    !source.includes('Invalid Perception puzzle date'),
    'Private Perception generator leaked into ' + name,
  );
}
async function checkSources(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) await checkSources(file);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
      const source = await readFile(file, 'utf8');
      assert(
        !/worker\/src\/games\/perception|perceptionPuzzle|scorePerception/.test(source),
        'Private Perception generation referenced by ' + file.pathname,
      );
    }
  }
}
await checkSources(new URL('../../web/src/', import.meta.url));
console.log(
  'PASS: Perception private generator excluded from ' +
    names.length +
    ' built web assets and web source imports.',
);
