import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import console from 'node:console';
import { URL } from 'node:url';
import { root, sourcePath } from './build.mjs';

const source = JSON.parse(await readFile(await sourcePath(), 'utf8'));
const rows = new Set(source.puzzles.flatMap((p) => p.grid));
async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    files.push(...(entry.isDirectory() ? await walk(path) : [path]));
  }
  return files;
}
const assets = (await walk(new URL('web/dist/', root))).filter((p) =>
  /\.(js|css|map|dat)$/.test(p.pathname),
);
assert(
  assets.some((p) => p.pathname.endsWith('/crossword.dat')),
  'Missing crossword ciphertext',
);
for (const asset of assets) {
  const text = await readFile(asset, 'utf8');
  assert(!text.includes('oyo-crossword-v1'), `Crossword plaintext signature leaked into ${asset}`);
  for (const row of rows) assert(!text.includes(row), `Crossword answer row leaked into ${asset}`);
}
for (const file of await walk(new URL('web/src/', root))) {
  if (!/\.[cm]?[jt]sx?$/.test(file.pathname) || /\.(test|spec)\./.test(file.pathname)) continue;
  const text = await readFile(file, 'utf8');
  assert(
    !/(?:import|export)[\s\S]*?(?:from\s*|import\s*\()["'][^"']*(?:worker\/src\/games\/crossword|puzzles\.json)/.test(
      text,
    ),
    `Private crossword import in ${file}`,
  );
}
console.log(
  `PASS: ${assets.length} built assets exclude crossword answer rows and plaintext; web imports stay public.`,
);
