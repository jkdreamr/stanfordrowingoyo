import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import console from 'node:console';
import { URL } from 'node:url';

const assets = new URL('../../web/dist/assets/', import.meta.url);
const names = (await readdir(assets)).filter((name) => /\.(js|map)$/.test(name));
assert(names.length, 'Build the web assets first');
for (const name of names) {
  const source = await readFile(new URL(name, assets), 'utf8');
  assert(
    !source.includes('Invalid Deal schedule date'),
    'Private Deal generator leaked into ' + name,
  );
}
async function checkSources(dir, web) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) await checkSources(file, web);
    else if (/\.[cm]?[jt]sx?$/.test(entry.name) && !entry.name.includes('.test.')) {
      const source = await readFile(file, 'utf8');
      assert(
        !/scripts\/deal\/solver/.test(source),
        'Offline Deal solver referenced by ' + file.pathname,
      );
      if (web)
        assert(
          !/worker\/src\/games\/deal|\b(?:dealRound|dealCandidate|dealProfile|DEAL_SCHEDULE(?:_START)?)\b|games\/deal\/schedule/.test(
            source,
          ),
          'Private Deal generation referenced by ' + file.pathname,
        );
    }
  }
}
await checkSources(new URL('../../web/src/', import.meta.url), true);
await checkSources(new URL('../../worker/src/', import.meta.url), false);
console.log(
  'PASS: Deal private generator excluded from ' +
    names.length +
    ' built web assets and web sources; offline solver excluded from Worker sources.',
);
