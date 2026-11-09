import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { URL } from 'node:url';
import { normalizeAnswer } from '../../shared/games/dive.ts';
import { combineCorpora, evaluateCorpus, exactHit } from './recall.mjs';

const set = { buckets: { 4: '\ncafe\t0\n', 5: '\nsmith\t0\n', 7: '\nsea cat\t0\n' } };
const batch = JSON.parse(readFileSync(new URL('./recall/batch-1-selected.json', import.meta.url)));
const batchTwo = JSON.parse(
  readFileSync(new URL('./recall/batch-2-selected.json', import.meta.url)),
);
const batchThree = JSON.parse(
  readFileSync(new URL('./recall/batch-3-selected.json', import.meta.url)),
);
const retiredR5 = new Set([
  'kubrick-films',
  'burton-films',
  'miyazaki-films',
  'wes-anderson-features',
]);

test('Oscar intersections retain frozen guesses and meet exact recall without out-of-scope hits', async () => {
  const bytes = readFileSync(new URL('./recall/refine-R5-raw.json', import.meta.url));
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    'ecc225396a21d6d3dd72d55022faf134fda581913a35dbfa389370fc4ca6bd7e',
  );
  const raw = JSON.parse(bytes);
  const corpus = JSON.parse(
    readFileSync(new URL('./recall/refine-R5-selected.json', import.meta.url)),
  );
  const ids = Object.keys(corpus);
  assert.equal(ids.length, 4);
  for (const [id, guesses] of Object.entries(corpus))
    assert.deepEqual(
      guesses.map((g) => (typeof g === 'string' ? g : g.guess)),
      raw[id],
    );
  const result = await evaluateCorpus({
    corpus,
    schedule: [ids],
    prompts: ids.map((id) => ({ id, constrained: true })),
    loadSet: async (id) => (await import(`../../worker/src/games/dive/data/${id}.ts`)).default,
    normalize: normalizeAnswer,
  });
  assert.deepEqual(result.missingData, []);
  for (const prompt of result.prompts) {
    assert.ok(prompt.total > 0 && prompt.rate >= 0.95, `${prompt.id}: ${prompt.misses.join(', ')}`);
    const set = (await import(`../../worker/src/games/dive/data/${prompt.id}.ts`)).default;
    for (const guess of prompt.invalid)
      assert.equal(
        exactHit(guess.guess, set, normalizeAnswer),
        false,
        `${prompt.id}: ${guess.guess}`,
      );
    assert.equal(exactHit('', set, normalizeAnswer), false);
  }
});

test('active plain-list swaps preserve frozen brainstorms and meet per-prompt exact recall', async () => {
  const audit = JSON.parse(readFileSync(new URL('./recall/batch-5-audit.json', import.meta.url)));
  const corpus = JSON.parse(
    readFileSync(new URL('./recall/batch-5-selected.json', import.meta.url)),
  );
  const raw = {};
  for (const [file, hash] of Object.entries(audit.raw_sha256)) {
    const bytes = readFileSync(new URL(`./recall/${file}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
    Object.assign(raw, JSON.parse(bytes));
  }
  const ids = Object.keys(corpus);
  assert.equal(ids.length, 14);
  for (const [id, guesses] of Object.entries(corpus)) {
    assert.ok(raw[id].length >= 25);
    assert.deepEqual(
      guesses.map((g) => (typeof g === 'string' ? g : g.guess)),
      [...new Set(raw[id])],
    );
  }
  const specs = JSON.parse(readFileSync(new URL('./constrained.json', import.meta.url))).prompts;
  const activeIds = ids.filter((id) => specs.find((p) => p.id === id).active);
  assert.deepEqual(ids.filter((id) => !activeIds.includes(id)).sort(), [
    'borders-austria',
    'borders-zambia',
  ]);
  const result = await evaluateCorpus({
    corpus,
    schedule: [activeIds],
    prompts: activeIds.map((id) => ({ id, constrained: true })),
    normalize: normalizeAnswer,
    loadSet: async (id) => (await import(`../../worker/src/games/dive/data/${id}.ts`)).default,
  });
  assert.deepEqual(
    result.prompts,
    audit.prompts.filter((p) => activeIds.includes(p.id)).map((p) => p.after),
  );
  assert.deepEqual(result.missingData, []);
  for (const prompt of result.prompts) {
    assert.ok(prompt.total > 0 && prompt.rate >= 0.95, `${prompt.id}: ${prompt.misses.join(', ')}`);
    const set = (await import(`../../worker/src/games/dive/data/${prompt.id}.ts`)).default;
    for (const guess of prompt.invalid)
      assert.equal(
        exactHit(guess.guess, set, normalizeAnswer),
        false,
        `${prompt.id}: ${guess.guess}`,
      );
    assert.equal(exactHit('', set, normalizeAnswer), false);
  }
  assert.deepEqual(result.prompts.find((p) => p.id === 'enable-greek-hidden').misses, ['gypsies']);
});

test('batch six preserves frozen guesses and accepts reviewed aliases, not nonmembers', async () => {
  const audit = JSON.parse(readFileSync(new URL('./recall/batch-6-audit.json', import.meta.url)));
  const corpus = JSON.parse(
    readFileSync(new URL('./recall/batch-6-selected.json', import.meta.url)),
  );
  const raw = {};
  for (const [file, hash] of Object.entries(audit.raw_sha256)) {
    const bytes = readFileSync(new URL(`./recall/${file}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
    Object.assign(raw, JSON.parse(bytes));
  }
  assert.equal(
    createHash('sha256')
      .update(readFileSync(new URL('./recall/batch-6-selected.json', import.meta.url)))
      .digest('hex'),
    audit.selected_sha256,
  );
  const ids = Object.keys(corpus);
  assert.deepEqual(ids.sort(), ['both-season-olympics', 'countries-without-usa']);
  for (const [id, guesses] of Object.entries(corpus)) {
    assert.ok(raw[id].length >= 25);
    assert.equal(new Set(raw[id]).size, raw[id].length);
    assert.deepEqual(
      guesses.map((g) => (typeof g === 'string' ? g : g.guess)),
      raw[id],
    );
  }
  const result = await evaluateCorpus({
    corpus,
    schedule: [ids],
    prompts: ids.map((id) => ({ id, constrained: true })),
    normalize: normalizeAnswer,
    loadSet: async (id) => (await import(`../../worker/src/games/dive/data/${id}.ts`)).default,
  });
  assert.deepEqual(result.missingData, []);
  assert.deepEqual(
    result.prompts,
    audit.prompts.map((p) => p.after),
  );
  for (const p of result.prompts) {
    assert.ok(p.total > 0 && p.rate >= 0.95, p.id);
    const set = (await import(`../../worker/src/games/dive/data/${p.id}.ts`)).default;
    assert.equal(exactHit('', set, normalizeAnswer), false);
    for (const guess of p.invalid)
      assert.equal(exactHit(guess.guess, set, normalizeAnswer), false, `${p.id}: ${guess.guess}`);
  }
});

test('composite corpora merge disjoint inputs, allow empty inputs and reject duplicate prompts', () => {
  assert.deepEqual(combineCorpora([{ a: ['A'] }, { b: ['B'] }]), { a: ['A'], b: ['B'] });
  assert.deepEqual(combineCorpora([{}, {}]), {});
  assert.throws(() => combineCorpora([{ a: [] }, { a: [] }]), /Duplicate corpus prompt: a/);
});

test('duplicate-retirement replacement retains frozen guesses and rejects out-of-scope titles', async () => {
  const corpus = JSON.parse(
    readFileSync(new URL('./recall/supplemental-selected.json', import.meta.url)),
  );
  const raw = JSON.parse(readFileSync(new URL('./recall/batch-4-raw.json', import.meta.url)));
  const ids = Object.keys(corpus);
  for (const id of ids)
    assert.deepEqual(
      corpus[id].map((g) => (typeof g === 'string' ? g : g.guess)),
      raw[id],
    );
  const result = await evaluateCorpus({
    corpus,
    schedule: [ids],
    prompts: ids.map((id) => ({ id, constrained: true })),
    normalize: normalizeAnswer,
    loadSet: async (id) => (await import(`../../worker/src/games/dive/data/${id}.ts`)).default,
  });
  for (const p of result.prompts) {
    assert.ok(p.rate >= 0.95);
    const set = (await import(`../../worker/src/games/dive/data/${p.id}.ts`)).default;
    for (const g of p.invalid) assert.equal(exactHit(g.guess, set, normalizeAnswer), false);
  }
});

test('fourth constrained batch preserves frozen guesses and accepts reviewed members', async () => {
  const raw = JSON.parse(readFileSync(new URL('./recall/batch-4-raw.json', import.meta.url)));
  const corpus = JSON.parse(
    readFileSync(new URL('./recall/batch-4-selected.json', import.meta.url)),
  );
  const ids = Object.keys(corpus);
  assert.equal(ids.length, 33);
  assert.deepEqual(raw['soviet-venus-landers'], raw['venus-surface-probes-backup']);
  for (const [id, guesses] of Object.entries(corpus)) {
    assert.ok(guesses.length >= 25);
    assert.deepEqual(
      guesses.map((g) => (typeof g === 'string' ? g : g.guess)),
      raw[id],
    );
  }
  const activeIds = ids.filter((id) => !retiredR5.has(id));
  const result = await evaluateCorpus({
    corpus,
    schedule: [activeIds],
    prompts: activeIds.map((id) => ({ id, constrained: true })),
    loadSet: async (id) => (await import(`../../worker/src/games/dive/data/${id}.ts`)).default,
    normalize: normalizeAnswer,
  });
  const audit = JSON.parse(readFileSync(new URL('./recall/batch-4-audit.json', import.meta.url)));
  assert.deepEqual(
    result.prompts,
    audit.prompts.filter((prompt) => activeIds.includes(prompt.id)).map((prompt) => prompt.after),
  );
  for (const prompt of result.prompts) {
    assert.ok(prompt.total > 0 && prompt.rate >= 0.95, `${prompt.id}: ${prompt.misses.join(', ')}`);
    const set = (await import(`../../worker/src/games/dive/data/${prompt.id}.ts`)).default;
    for (const guess of prompt.invalid)
      assert.equal(
        exactHit(guess.guess, set, normalizeAnswer),
        false,
        `${prompt.id}: ${guess.guess}`,
      );
  }
});

test('third constrained batch preserves raw guesses and accepts valid variants, not reviewed nonmembers', async () => {
  const raw = JSON.parse(readFileSync(new URL('./recall/batch-3-raw.json', import.meta.url)));
  const ids = Object.keys(batchThree);
  assert.equal(ids.length, 29);
  for (const [id, guesses] of Object.entries(batchThree)) {
    assert.ok(guesses.length >= 25);
    assert.deepEqual(
      guesses.map((g) => (typeof g === 'string' ? g : g.guess)),
      raw[id],
    );
  }
  const result = await evaluateCorpus({
    corpus: batchThree,
    schedule: [ids],
    prompts: ids.map((id) => ({ id, constrained: true })),
    loadSet: async (id) => (await import(`../../worker/src/games/dive/data/${id}.ts`)).default,
    normalize: normalizeAnswer,
  });
  assert.deepEqual(result.missingData, []);
  const audit = JSON.parse(readFileSync(new URL('./recall/batch-3-audit.json', import.meta.url)));
  const audited = new Map(audit.prompts.map((prompt) => [prompt.id, prompt.after]));
  for (const prompt of result.prompts) {
    assert.deepEqual(prompt, audited.get(prompt.id));
    assert.ok(prompt.total > 0 && prompt.rate >= 0.95, `${prompt.id}: ${prompt.misses.join(', ')}`);
    const set = (await import(`../../worker/src/games/dive/data/${prompt.id}.ts`)).default;
    for (const guess of batchThree[prompt.id].filter((g) => typeof g !== 'string'))
      assert.equal(
        exactHit(guess.guess, set, normalizeAnswer),
        false,
        `${prompt.id}: ${guess.guess}`,
      );
  }
});

test('second constrained batch retains every brainstorm and meets exact recall per prompt', async () => {
  const ids = Object.keys(batchTwo);
  assert.equal(ids.length, 30);
  for (const guesses of Object.values(batchTwo)) assert.ok(guesses.length >= 25);
  const activeIds = ids.filter((id) => !retiredR5.has(id));
  const result = await evaluateCorpus({
    corpus: batchTwo,
    schedule: [activeIds],
    prompts: activeIds.map((id) => ({ id, constrained: true })),
    loadSet: async (id) => (await import(`../../worker/src/games/dive/data/${id}.ts`)).default,
    normalize: normalizeAnswer,
  });
  assert.deepEqual(result.missingData, []);
  for (const prompt of result.prompts)
    assert.ok(prompt.total > 0 && prompt.rate >= 0.95, `${prompt.id}: ${prompt.misses.join(', ')}`);
});

test('new constrained batch retains its brainstorm and meets exact recall for every prompt', async () => {
  const ids = Object.keys(batch);
  assert.equal(ids.length, 25);
  for (const guesses of Object.values(batch)) assert.ok(guesses.length >= 25);
  const result = await evaluateCorpus({
    corpus: batch,
    schedule: [ids],
    prompts: ids.map((id) => ({ id, constrained: true })),
    loadSet: async (id) => (await import(`../../worker/src/games/dive/data/${id}.ts`)).default,
    normalize: normalizeAnswer,
  });
  assert.deepEqual(result.missingData, []);
  for (const prompt of result.prompts)
    assert.ok(prompt.total > 0 && prompt.rate >= 0.95, `${prompt.id}: ${prompt.misses.join(', ')}`);
});
const evaluate = (corpus, loadSet = async () => set) =>
  evaluateCorpus({
    corpus,
    schedule: [['example']],
    prompts: [{ id: 'example', constrained: true }],
    loadSet,
    normalize: normalizeAnswer,
  });

test('exact normalized canonical and alias keys; no fuzzy or substring hits', () => {
  assert.equal(exactHit('The CAFÉS', set, normalizeAnswer), true);
  assert.equal(exactHit('Sea-cat', set, normalizeAnswer), true);
  for (const guess of ['', 'smit', 'smithe', 'mith', 'a'])
    assert.equal(exactHit(guess, set, normalizeAnswer), false);
});

test('rates count raw variants and exclude reviewed invalid from all denominators', async () => {
  const result = await evaluate({
    example: ['cafe', 'café', 'unknown', { guess: 'Pluto', invalid: 'Not a cafe.' }],
  });
  assert.deepEqual(result.overall, { prompts: 1, hits: 2, total: 3, invalid: 1, rate: 2 / 3 });
  assert.deepEqual(result.constrained, result.overall);
  assert.equal(result.broad.rate, null);
  assert.deepEqual(result.prompts[0].misses, ['unknown']);
});

test('empty corpus and all-invalid sets have n/a recall, not perfect recall', async () => {
  const empty = await evaluate({});
  assert.deepEqual(empty.missingCorpus, ['example']);
  assert.equal(empty.overall.rate, null);
  const invalid = await evaluate({ example: [{ guess: 'wrong', invalid: 'Not a member.' }] });
  assert.equal(invalid.overall.total, 0);
  assert.equal(invalid.overall.rate, null);
});

test('missing modules are reported and valid guesses remain misses', async () => {
  const result = await evaluate({ example: ['cafe'] }, async () => null);
  assert.deepEqual(result.missingData, ['example']);
  assert.equal(result.overall.rate, 0);
  assert.deepEqual(result.prompts[0].misses, ['cafe']);
});

test('errors in existing modules propagate rather than masquerading as missing data', async () => {
  await assert.rejects(
    evaluate({ example: ['cafe'] }, async () => {
      throw new Error('bad module');
    }),
    /bad module/,
  );
});

test('malformed guesses, duplicate strings and unreasoned exclusions fail', async () => {
  for (const guesses of [[''], ['cafe', 'cafe'], [null], [{ guess: 'cafe', invalid: '' }], 'cafe'])
    await assert.rejects(evaluate({ example: guesses }), /example:/);
});

test('evaluated cycle controls coverage and classification, not the corpus', async () => {
  const result = await evaluateCorpus({
    corpus: { example: ['cafe'], extra: ['cafe'] },
    schedule: [['example', 'broad', 'example']],
    prompts: [
      { id: 'example', constrained: true },
      { id: 'broad', constrained: false },
    ],
    loadSet: async () => set,
    normalize: normalizeAnswer,
  });
  assert.equal(result.overall.prompts, 2);
  assert.equal(result.constrained.prompts, 1);
  assert.equal(result.broad.prompts, 1);
  assert.deepEqual(result.unscheduledCorpus, ['extra']);
  assert.deepEqual(result.missingCorpus, ['broad']);
});
