import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { addDays } from '../../shared/dates';
import { DIVE_TIERS, normalizeAnswer } from '../../shared/games/dive';
import { DIVE_PROMPTS, diveSelectionFor } from '../../worker/src/games/divePrompts';
import { boundedDistance, matchAnswer } from '../../worker/src/games/dive/matcher';
import { fixtureSet as parseAnswerSet, decodedAnswers } from './fixtures';
import { loaders } from '../../worker/src/games/dive/loaders';
import { answerSet } from '../../worker/src/games/dive/sets';

const fixture = parseAnswerSet(
  'Apple|s|pomme\nOrange|m|sweet orange\nLemon|r|\nLime|d|\nRambutan|g|hairy fruit\nDurian|t|',
);
it.each([
  ['apple', 'Apple', 10],
  ['THE ÁPPLES!', 'Apple', 10],
  ['pomme', 'Apple', 10],
  ['sweet-orange', 'Orange', 30],
  ['rambootan', 'Rambutan', 100],
  ['appl', 'Apple', 10],
  ['oranhe', 'Orange', 30],
  ['hairy frut', 'Rambutan', 100],
  ['durian', 'Durian', 15],
  ['lim', null, 0],
  ['cat', null, 0],
  ['none', null, 0],
  ['idk', null, 0],
  ['', null, 0],
  ['!!!', null, 0],
  ['zzzzzzzz', null, 0],
  ['app', null, 0],
])('matches %j to %j for %i points', (input, canonical, points) => {
  expect(matchAnswer(input, fixture)).toMatchObject({ canonical, points });
});
it('rejects ambiguous best matches, but aliases of one canonical do not create false ties', () => {
  const ambiguous = parseAnswerSet('stone|s|stony\nshone|g|');
  expect(matchAnswer('stane', ambiguous).canonical).toBe('stone');
  expect(matchAnswer('scone', ambiguous)).toEqual({ canonical: null, tier: 'miss', points: 0 });
  expect(matchAnswer('shone', ambiguous).canonical).toBe('shone');
  const aliases = parseAnswerSet('stone|g|stony\nflamingo|s|');
  expect(matchAnswer('stond', aliases).canonical).toBe('stone');
});
it('does not cross-match unrelated answers or bypass length limits and stopwords', () => {
  const guarded = parseAnswerSet('nonce|s|\nidem|g|\nabcdefghij|r|\nabcde|d|');
  expect(matchAnswer('none', guarded).canonical).toBeNull();
  expect(matchAnswer('idk', guarded).canonical).toBeNull();
  expect(matchAnswer('abcdefg', guarded).canonical).toBeNull();
  expect(matchAnswer('abcdxxxxij', guarded).canonical).toBeNull();
  expect(matchAnswer('dog', fixture).canonical).toBeNull();
});
it('preserves typo matches through the character-deficit filter, including repeats and aliases', () => {
  const set = parseAnswerSet(
    'balloon|s|helium balloon\nbaboon|g|\nbanana|r|yellow fruit\ncacao|d|cocoa',
  );
  const entries = decodedAnswers(set).flatMap((row) =>
    [row.answer, ...row.aliases].map((value) => ({
      key: normalizeAnswer(value),
      canonical: row.answer,
    })),
  );
  for (const entry of entries) {
    for (let i = 0; i <= entry.key.length; i++) {
      for (const value of [
        entry.key.slice(0, i) + 'z' + entry.key.slice(i),
        entry.key.slice(0, i) + entry.key.slice(i + 1),
        entry.key.slice(0, i) + 'z' + entry.key.slice(i + 1),
      ]) {
        const key = normalizeAnswer(value),
          limit = key.length < 4 ? 0 : key.length < 8 ? 1 : 2;
        const candidates = entries
          .map((row) => ({ ...row, distance: boundedDistance(key, row.key, limit) }))
          .filter((row) => row.distance <= limit);
        const best = Math.min(...candidates.map((row) => row.distance));
        const winners = new Set(
          candidates.filter((row) => row.distance === best).map((row) => row.canonical),
        );
        expect(matchAnswer(value, set).canonical, value).toBe(
          winners.size === 1 ? [...winners][0] : null,
        );
      }
    }
  }
});
it('decodes UTF-16 canonical offsets without parsing the answer table', () => {
  const set = parseAnswerSet('Café🍐|s|cafe fruit\nRambutan|g|');
  expect(matchAnswer('cafe fruit', set).canonical).toBe('Café🍐');
  expect(matchAnswer('rambutan', set).points).toBe(100);
});
it('rejects malformed sets, normalized key collisions and missing or multiple Pearls', () => {
  for (const encoded of [
    '',
    'Apple|s|',
    'Apple|x|',
    'Apple|g|\nThe apples|s|',
    'Apple|g|pomme\nPear|s|POMME',
    'Apple|g|\nPear|g|',
  ]) {
    expect(() => parseAnswerSet(encoded)).toThrow();
  }
});
it('agrees with full Levenshtein for insertion, deletion, substitution and early-exit boundaries', () => {
  function full(a: string, b: string) {
    let row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const next = [i];
      for (let j = 1; j <= b.length; j++)
        next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + Number(a[i - 1] !== b[j - 1]));
      row = next;
    }
    return row[b.length];
  }
  const words = [
    '',
    'a',
    'b',
    'aa',
    'ab',
    'ba',
    'abb',
    'apple',
    'apples',
    'pomme',
    'rambootan',
    'rambutan',
    'abcdefghij',
    'abxxefghij',
  ];
  for (const a of words)
    for (const b of words)
      for (const limit of [0, 1, 2]) {
        expect(Math.min(boundedDistance(a, b, limit), limit + 1), `${a}/${b}/${limit}`).toBe(
          Math.min(full(a, b), limit + 1),
        );
      }
});
it('validates all generated sets: tiers, single Pearl, globally unique keys/aliases per set and explicit Too Clever picks', async () => {
  const report = JSON.parse(readFileSync(new URL('./report.json', import.meta.url), 'utf8')) as {
    id: string;
    size: number;
    gem: string;
    too_clever: string[];
  }[];
  expect(DIVE_PROMPTS.length).toBeGreaterThanOrEqual(120);
  expect(new Set(DIVE_PROMPTS.map(({ text }) => normalizeAnswer(text))).size).toBe(
    DIVE_PROMPTS.length,
  );
  expect(DIVE_PROMPTS.some(({ text }) => /rowing|stanford|teammate|krillion/i.test(text))).toBe(
    false,
  );
  let large = 0,
    hundreds = 0;
  for (const prompt of DIVE_PROMPTS) {
    const set = await answerSet(prompt.id);
    expect(Object.keys(set).sort()).toEqual(['answers', 'buckets', 'gem', 'notable', 'size']);
    const answers = decodedAnswers(set);
    const stats = report.find((row) => row.id === prompt.id)!;
    expect(answers.length, prompt.id).toBe(stats.size);
    if (stats.size >= 100) large++;
    if (stats.size >= 200) hundreds++;
    expect(answers.filter((row) => row.tier === 'gem')).toHaveLength(1);
    expect(set.gem.answer).toBe(stats.gem);
    expect(
      answers
        .filter((row) => row.tier === 'tooclever')
        .map((row) => normalizeAnswer(row.answer))
        .sort(),
    ).toEqual(stats.too_clever.map(normalizeAnswer).sort());
    const keys = answers.flatMap((row) => [row.answer, ...row.aliases].map(normalizeAnswer));
    expect(new Set(keys).size, prompt.id).toBe(keys.length);
    for (const [length, bucket] of Object.entries(set.buckets)) {
      for (const line of bucket.trim().split('\n')) {
        expect(line.split('\t')[0].length).toBe(Number(length));
      }
    }
    expect(Object.values(set.buckets).flatMap((bucket) => bucket.trim().split('\n'))).toHaveLength(
      keys.length,
    );
    for (const row of answers) {
      expect(DIVE_TIERS[row.tier].points).toBe(row.points);
      expect(row.tier).not.toBe('miss');
      for (const alias of row.aliases) expect(matchAnswer(alias, set).canonical).toBe(row.answer);
    }
    for (const tier of ['surface', 'school', 'rare', 'deep'])
      expect(
        answers.some((row) => row.tier === tier),
        `${prompt.id}/${tier}`,
      ).toBe(true);
    expect(set.notable.length).toBeLessThanOrEqual(5);
  }
  expect(large).toBeGreaterThan(DIVE_PROMPTS.length / 2);
  expect(hundreds).toBeGreaterThan(DIVE_PROMPTS.length / 2);
});
it('anchors obvious answers at Surface, and accepts real aliases and typos on the generated data', async () => {
  for (const [id, answer] of [
    ['animals', 'dog'],
    ['animals', 'cat'],
    ['countries', 'France'],
    ['fruits', 'apple'],
  ]) {
    expect(matchAnswer(answer, await answerSet(id))).toMatchObject({ tier: 'surface', points: 10 });
  }
  expect(matchAnswer('USA', await answerSet('countries')).canonical).toBe('United States');
  expect(matchAnswer('Nyckelharp', await answerSet('instruments')).canonical).toBe('Nyckelharpa');
  expect(matchAnswer('rambutan', await answerSet('elements')).canonical).toBeNull();
  expect(matchAnswer('fish', await answerSet('dinosaurs')).canonical).toBeNull();
  expect((await answerSet('constellations')).size).toBe(88);
});
it('selects deterministic seven-prompt team days with no repeats in any floor(N/7)-day window', () => {
  const window = Math.floor(DIVE_PROMPTS.length / 7);
  for (const start of ['2026-01-01', '2025-10-12', '2026-07-03']) {
    for (let offset = 0; offset < DIVE_PROMPTS.length; offset++) {
      const date = addDays(start, offset);
      expect(diveSelectionFor(date)).toEqual(diveSelectionFor(date));
      const selected = Array.from({ length: window }, (_, i) =>
        diveSelectionFor(addDays(date, i)).map(({ id }) => id),
      ).flat();
      expect(new Set(selected).size).toBe(window * 7);
    }
  }
});
it('uses immutable module data without a parsed cache or eviction penalty, and rejects unknown prompt IDs', async () => {
  const first = await answerSet('animals');
  expect(await answerSet('animals')).toBe(first);
  for (const { id } of DIVE_PROMPTS.slice(1, 10)) await answerSet(id);
  expect(await answerSet('animals')).toBe(first);
  expect(() => answerSet('__proto__')).toThrow('Unknown Dive prompt');
  expect(Object.keys(loaders)).toHaveLength(DIVE_PROMPTS.length);
});
it('keeps production web imports disconnected from Worker answer modules', () => {
  function files(path: string): string[] {
    return readdirSync(path, { withFileTypes: true }).flatMap((item) =>
      item.isDirectory() ? files(resolve(path, item.name)) : [resolve(path, item.name)],
    );
  }
  for (const path of files(resolve('web/src')).filter(
    (path) => /\.[jt]sx?$/.test(path) && !/\.test\./.test(path),
  )) {
    expect(readFileSync(path, 'utf8')).not.toMatch(
      /(?:from|import\()[^\n]*worker\/|games\/dive\/(?:data|loaders|sets|matcher)/,
    );
  }
});
