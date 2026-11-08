import { performance } from 'node:perf_hooks';
import { pathToFileURL, URL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { Buffer } from 'node:buffer';
import { readFile, readdir, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';

const start = performance.now();
const { DIVE_PROMPTS, loaders, parseAnswerSet, matchAnswer } = await import(
  pathToFileURL(process.argv[2])
);
console.log(`Cold Node bundled data-registry import: ${(performance.now() - start).toFixed(3)} ms`);
const report = JSON.parse(await readFile(new URL('./report.json', import.meta.url), 'utf8'));
const largest = report.reduce((a, b) => (a.size > b.size ? a : b));
const moduleStart = performance.now();
const { default: encoded } = await loaders[largest.id]();
console.log(
  `Lazy largest encoded-module import: ${(performance.now() - moduleStart).toFixed(3)} ms`,
);
const parseStart = performance.now();
const set = parseAnswerSet(encoded);
console.log(
  `Cold largest-set parse: ${(performance.now() - parseStart).toFixed(3)} ms (${largest.id}, ${set.answers.length} answers, ${set.keys.size} keys)`,
);

function bench(input, n) {
  const times = [];
  for (let i = 0; i < n; i++) {
    const start = performance.now();
    matchAnswer(input, set);
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return { mean: times.reduce((a, b) => a + b, 0) / n, p95: times[Math.floor(n * 0.95)] };
}
const exact = set.answers[0].answer;
for (let i = 0; i < 1000; i++) matchAnswer(exact, set);
const exactResult = bench(exact, 10000);
console.log(
  `Largest-set exact match: mean ${exactResult.mean.toFixed(6)} ms, p95 ${exactResult.p95.toFixed(6)} ms (10,000 runs)`,
);

// Sample long common prefixes too, not just unrelated strings that exit DP immediately.
const candidates = Array.from({ length: 37 }, (_, i) => 'z'.repeat(i + 4));
for (const [index, row] of set.answers.entries()) {
  if (index % 31 === 0 && row.answer.length >= 8) candidates.push(row.answer.slice(0, -3) + 'zzz');
}
let worst;
for (const input of candidates) {
  if (matchAnswer(input, set).canonical !== null) continue;
  const result = bench(input, 5);
  if (!worst || result.mean > worst.mean) worst = { input, ...result };
}
assert(worst);
assert.equal(matchAnswer(worst.input, set).canonical, null);
const fuzzyResult = bench(worst.input, 1000);
console.log(
  `Largest-set worst sampled fuzzy miss: mean ${fuzzyResult.mean.toFixed(6)} ms, p95 ${fuzzyResult.p95.toFixed(6)} ms (1,000 runs; ${candidates.length} candidates; input=${JSON.stringify(worst.input)})`,
);
const dir = new URL('../../worker/src/games/dive/data/', import.meta.url);
let bytes = 0;
const all = [];
for (const name of await readdir(dir)) {
  const path = new URL(name, dir);
  bytes += (await stat(path)).size;
  all.push(await readFile(path));
}
console.log(
  `Generated data modules: ${DIVE_PROMPTS.length} files, ${bytes} bytes, concatenated gzip ${gzipSync(Buffer.concat(all)).byteLength} bytes`,
);
