import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { format, resolveConfig } from 'prettier';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function exactHit(guess, set, normalize) {
  const key = normalize(guess);
  return key.length > 0 && (set.buckets[key.length] ?? '').includes(`\n${key}\t`);
}

function aggregate(rows) {
  const hits = rows.reduce((sum, row) => sum + row.hits, 0);
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  return {
    prompts: rows.length,
    hits,
    total,
    invalid: rows.reduce((sum, row) => sum + row.invalid.length, 0),
    rate: total ? hits / total : null,
  };
}

export async function evaluateCorpus({ corpus, schedule, prompts, loadSet, normalize }) {
  const catalog = new Map(prompts.map((prompt) => [prompt.id, prompt]));
  const ids = [...new Set(schedule.flat())].sort();
  const rows = [];
  for (const id of ids) {
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Invalid prompt id: ${id}`);
    const guesses = corpus[id];
    if (guesses !== undefined && !Array.isArray(guesses))
      throw new Error(`${id}: guesses must be an array`);
    const seen = new Set();
    const valid = [];
    const invalid = [];
    for (const entry of guesses ?? []) {
      const guess = typeof entry === 'string' ? entry : entry?.guess;
      if (typeof guess !== 'string' || !guess.trim() || seen.has(guess))
        throw new Error(`${id}: empty, malformed or duplicate guess`);
      seen.add(guess);
      if (typeof entry === 'object' && Object.hasOwn(entry, 'invalid')) {
        if (typeof entry.invalid !== 'string' || !entry.invalid.trim())
          throw new Error(`${id}: invalid guesses require a reason`);
        invalid.push(entry);
      } else valid.push(guess);
    }
    const set = await loadSet(id);
    const misses = valid.filter((guess) => !set || !exactHit(guess, set, normalize));
    const total = valid.length;
    rows.push({
      id,
      text: catalog.get(id)?.text ?? null,
      constrained: catalog.get(id)?.constrained ?? null,
      missingCorpus: guesses === undefined,
      missingData: set === null,
      hits: total - misses.length,
      total,
      rate: total ? (total - misses.length) / total : null,
      invalid,
      misses,
    });
  }
  return {
    overall: aggregate(rows),
    constrained: aggregate(rows.filter((row) => row.constrained === true)),
    broad: aggregate(rows.filter((row) => row.constrained === false)),
    missingCorpus: rows.filter((row) => row.missingCorpus).map((row) => row.id),
    missingData: rows.filter((row) => row.missingData).map((row) => row.id),
    missingMetadata: rows.filter((row) => row.constrained === null).map((row) => row.id),
    unscheduledCorpus: Object.keys(corpus)
      .filter((id) => !ids.includes(id))
      .sort(),
    prompts: rows,
  };
}

const percent = (rate) => (rate === null ? 'n/a' : `${(rate * 100).toFixed(2)}%`);
const sortedJSON = (value) =>
  JSON.stringify(
    value,
    (_, entry) =>
      entry && typeof entry === 'object' && !Array.isArray(entry)
        ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)))
        : entry,
    2,
  ) + '\n';

export function combineCorpora(corpora) {
  const merged = {};
  for (const corpus of corpora)
    for (const [id, guesses] of Object.entries(corpus)) {
      if (Object.hasOwn(merged, id)) throw new Error(`Duplicate corpus prompt: ${id}`);
      merged[id] = guesses;
    }
  return merged;
}

export async function main(args = process.argv.slice(2)) {
  let ref;
  let customCorpus = false;
  let corpusPath = join(repo, 'scripts/dive/recall/corpus.json');
  let reportPath = join(repo, 'scripts/dive/recall/report.json');
  for (let i = 0; i < args.length; i++) {
    if (!['--ref', '--corpus', '--report'].includes(args[i]) || !args[i + 1])
      throw new Error(
        'Usage: node scripts/dive/recall.mjs [--ref REF] [--corpus PATH] [--report PATH]',
      );
    const flag = args[i];
    const value = args[++i];
    if (flag === '--ref') ref = value;
    if (flag === '--corpus') {
      corpusPath = resolve(value);
      customCorpus = true;
    }
    if (flag === '--report') reportPath = resolve(value);
  }
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  let snapshot;
  try {
    let root = repo;
    const commit = git('rev-parse', '--verify', `${ref ?? 'HEAD'}^{commit}`);
    if (ref) {
      snapshot = await mkdtemp(join(tmpdir(), 'dive-recall-'));
      const archive = execFileSync(
        'git',
        [
          'archive',
          commit,
          'worker/src/games/dive/data',
          'worker/src/games/dive/schedule.ts',
          'worker/src/games/dive/prompts.ts',
          'shared/games/dive.ts',
        ],
        { cwd: repo, maxBuffer: 64 * 1024 * 1024 },
      );
      execFileSync('tar', ['-xf', '-', '-C', snapshot], { input: archive });
      root = snapshot;
    }
    const moduleAt = (path) => import(pathToFileURL(join(root, path)).href);
    const [{ DIVE_SCHEDULE }, { DIVE_PROMPTS }, { normalizeAnswer }] = await Promise.all([
      moduleAt('worker/src/games/dive/schedule.ts'),
      moduleAt('worker/src/games/dive/prompts.ts'),
      moduleAt('shared/games/dive.ts'),
    ]);
    let corpusText = await readFile(corpusPath, 'utf8');
    let corpus = JSON.parse(corpusText);
    if (!customCorpus) {
      for (const file of [
        'batch-1-selected.json',
        'batch-2-selected.json',
        'batch-3-selected.json',
        'batch-4-selected.json',
        'supplemental-selected.json',
      ]) {
        const additions = JSON.parse(
          await readFile(join(repo, 'scripts/dive/recall', file), 'utf8'),
        );
        corpus = combineCorpora([corpus, additions]);
      }
      corpusText = JSON.stringify(corpus);
    }
    const result = await evaluateCorpus({
      corpus,
      schedule: DIVE_SCHEDULE,
      prompts: DIVE_PROMPTS,
      normalize: normalizeAnswer,
      loadSet: async (id) => {
        const path = `worker/src/games/dive/data/${id}.ts`;
        return existsSync(join(root, path)) ? (await moduleAt(path)).default : null;
      },
    });
    const report = {
      source: {
        ref: ref ?? null,
        commit,
        workingTree: !ref,
        corpusSha256: createHash('sha256').update(corpusText).digest('hex'),
      },
      ...result,
    };
    await writeFile(
      reportPath,
      await format(sortedJSON(report), {
        ...(await resolveConfig(join(repo, 'scripts/dive/recall/report.json'))),
        parser: 'json',
      }),
    );
    for (const row of result.prompts) {
      console.log(
        `${row.id}: ${row.hits}/${row.total} ${percent(row.rate)}${row.missingData ? ' MISSING DATA' : ''}`,
      );
      if (row.misses.length) console.log(`  misses: ${row.misses.join('; ')}`);
    }
    console.log(`\nSource: ${ref ?? 'working tree'} (${commit})`);
    console.log(
      `Corpus: ${Object.keys(corpus).length} prompts, ${Object.values(corpus).reduce((n, g) => n + g.length, 0)} guesses, ${result.overall.invalid} reviewed-invalid scheduled guesses`,
    );
    for (const subset of ['overall', 'constrained', 'broad']) {
      const row = result[subset];
      console.log(
        `${subset}: ${row.hits}/${row.total} ${percent(row.rate)} (${row.prompts} prompts)`,
      );
    }
    console.log(`Missing corpus: ${result.missingCorpus.join(', ') || 'none'}`);
    console.log(`Missing data: ${result.missingData.join(', ') || 'none'}`);
    console.log(`Missing metadata: ${result.missingMetadata.join(', ') || 'none'}`);
    console.log(`Unscheduled corpus: ${result.unscheduledCorpus.join(', ') || 'none'}`);
    console.log('\n25 worst prompts (rate, then id; n/a last):');
    console.log('| Prompt | Hits/total | Rate | Example misses |');
    console.log('| --- | ---: | ---: | --- |');
    for (const row of [...result.prompts]
      .sort((a, b) => (a.rate ?? 2) - (b.rate ?? 2) || a.id.localeCompare(b.id))
      .slice(0, 25))
      console.log(
        `| ${row.id} | ${row.hits}/${row.total} | ${percent(row.rate)} | ${row.misses.slice(0, 4).join('; ')} |`,
      );
    console.log(`Report: ${reportPath}`);
    return report;
  } finally {
    if (snapshot) await rm(snapshot, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
