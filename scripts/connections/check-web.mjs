import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import console from 'node:console';

const markers = [
  'connectionsPuzzles',
  'connectionsExpansionA',
  'connectionsExpansionB',
  'connectionsExpansionC',
  'contentSchedule',
];
for (const file of [
  'connectionsPuzzles',
  'connectionsExpansionA',
  'connectionsExpansionB',
  'connectionsExpansionC',
]) {
  const source = await readFile(
    new URL(`../../worker/src/games/${file}.ts`, import.meta.url),
    'utf8',
  );
  const groups = [...source.matchAll(/^\s*(['"])(.*?: .*?)\1,?$/gm)].map((match) =>
    match[2].replace(/\\(['"])/g, '$1'),
  );
  assert(groups.length >= 4, `Could not identify private groups in ${file}`);
  markers.push(...groups);
}
const schedule = await readFile(
  new URL('../../worker/src/games/contentSchedule.ts', import.meta.url),
  'utf8',
);
const replay = schedule.match(/REPLAY_DATE = '([^']+)'/)?.[1];
assert(replay, 'Could not identify private replay date');
markers.push(replay, 'content-v2:new', 'content-v2:fresh', 'content-v2:used');
const assets = new URL('../../web/dist/assets/', import.meta.url);
const names = (await readdir(assets)).filter((name) => /\.(js|css|map)$/.test(name));
assert(names.length, 'Build the web assets first');
for (const name of names) {
  const source = await readFile(new URL(name, assets), 'utf8');
  for (const marker of markers)
    assert(
      !source.includes(marker),
      `Private Connections/schedule marker ${marker} leaked into ${name}`,
    );
}
async function checkSources(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) await checkSources(file);
    else if (/\.[jt]sx?$/.test(entry.name) && !entry.name.includes('.test.')) {
      const source = await readFile(file, 'utf8');
      assert(
        !/(?:from|import\()[^\n]*worker\//.test(source),
        `Private Worker import in ${file.pathname}`,
      );
    }
  }
}
await checkSources(new URL('../../web/src/', import.meta.url));
console.log(
  `PASS: ${names.length} built web assets exclude Connections banks, private groups and replay schedule.`,
);
