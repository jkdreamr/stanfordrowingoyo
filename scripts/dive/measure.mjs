import { performance } from 'node:perf_hooks';
import { pathToFileURL, URL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { Buffer } from 'node:buffer';
import { readFile, readdir, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const { loaders, matchAnswer, decodedAnswers } = await import(pathToFileURL(process.argv[2]));
if (process.argv[3] === '--cold') {
  const [id, input] = process.argv.slice(4);
  const cpu = process.cpuUsage(),
    wall = performance.now();
  const set = (await loaders[id]()).default;
  const result = matchAnswer(input, set);
  const elapsed = performance.now() - wall,
    usage = process.cpuUsage(cpu);
  console.log(
    JSON.stringify({ cpu: (usage.user + usage.system) / 1000, wall: elapsed, ...result }),
  );
} else {
  const report = JSON.parse(await readFile(new URL('./report.json', import.meta.url), 'utf8'));
  const largest = report.reduce((a, b) => (a.size > b.size ? a : b));
  const set = (await loaders[largest.id]()).default;
  const answers = decodedAnswers(set);
  const alias = answers.find((row) => row.aliases.length);
  assert(alias, 'Largest set must provide a real alias benchmark');
  let fuzzy;
  for (const row of answers) {
    const input = row.answer.replace(/.$/, 'z');
    if (input !== row.answer && matchAnswer(input, set).canonical === row.answer) {
      fuzzy = { input, canonical: row.answer };
      break;
    }
  }
  assert(fuzzy);
  const candidates = Array.from({ length: 37 }, (_, i) => 'z'.repeat(i + 4));
  for (const row of answers) {
    if (row.answer.length >= 8) {
      candidates.push(row.answer.slice(0, -3) + 'zzz');
      candidates.push('zz' + row.answer.slice(2, -1) + 'z');
    }
  }
  const misses = [];
  for (const input of candidates) {
    if (matchAnswer(input, set).canonical !== null) continue;
    const start = performance.now();
    for (let i = 0; i < 10; i++) matchAnswer(input, set);
    misses.push({ input, time: performance.now() - start });
  }
  misses.sort((a, b) => b.time - a.time);
  assert(misses.length);
  const scenarios = [
    { label: 'exact', input: set.gem.answer, canonical: set.gem.answer },
    { label: 'alias', input: alias.aliases[0], canonical: alias.answer },
    { label: 'fuzzy hit', ...fuzzy },
    {
      label: 'worst sampled fuzzy miss',
      inputs: misses.slice(0, 10).map((row) => row.input),
      canonical: null,
    },
  ];
  console.log(
    `Largest set: ${largest.id}, ${set.size} answers; no runtime parsing, parsed cache or warm-up in cold children.`,
  );
  for (const scenario of scenarios) {
    const results = [];
    const inputs = scenario.inputs ?? [scenario.input];
    for (let i = 0; i < 20; i++) {
      const input = inputs[i % inputs.length];
      const child = spawnSync(
        process.execPath,
        [new URL(import.meta.url).pathname, process.argv[2], '--cold', largest.id, input],
        { encoding: 'utf8' },
      );
      assert.equal(child.status, 0, child.stderr);
      const result = JSON.parse(child.stdout);
      assert.equal(result.canonical, scenario.canonical);
      results.push(result);
    }
    const cpus = results.map((row) => row.cpu).sort((a, b) => a - b);
    const walls = results.map((row) => row.wall).sort((a, b) => a - b);
    console.log(
      `Cold module import + ${scenario.label}: CPU median=${cpus[10].toFixed(3)}, p95=${cpus[18].toFixed(3)}, max=${cpus[19].toFixed(3)} ms; wall median=${walls[10].toFixed(3)}, p95=${walls[18].toFixed(3)} ms (20 fresh processes)`,
    );
  }
  console.log(
    `Miss search: ${candidates.length} candidates, ${misses.length} verified misses; cold-tested the 10 slowest sampled strings.`,
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
    `Generated data: ${report.length} modules, ${bytes} bytes, concatenated gzip ${gzipSync(Buffer.concat(all)).byteLength} bytes.`,
  );
}
