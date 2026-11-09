import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { URL } from 'node:url';
import { normalizeAnswer } from '../../shared/games/dive.ts';
import { evaluateCorpus, exactHit } from './recall.mjs';

const set = { buckets: { 4: '\ncafe\t0\n', 5: '\nsmith\t0\n', 7: '\nsea cat\t0\n' } };
const batch = JSON.parse(readFileSync(new URL('./recall/batch-1-selected.json', import.meta.url)));
const batchTwo = JSON.parse(
  readFileSync(new URL('./recall/batch-2-selected.json', import.meta.url)),
);
const batchThree = JSON.parse(
  readFileSync(new URL('./recall/batch-3-selected.json', import.meta.url)),
);

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
  const result = await evaluateCorpus({
    corpus: batchTwo,
    schedule: [ids],
    prompts: ids.map((id) => ({ id, constrained: true })),
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
