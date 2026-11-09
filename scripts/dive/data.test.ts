import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { addDays } from '../../shared/dates';
import { DIVE_PROMPTS_PER_DAY, DIVE_TIERS, normalizeAnswer } from '../../shared/games/dive';
import { DIVE_PROMPTS, createDiveSelector } from '../../worker/src/games/divePrompts';
import { boundedDistance, matchAnswer } from '../../worker/src/games/dive/matcher';
import { fixtureSet as parseAnswerSet, decodedAnswers } from './fixtures';
import { loaders } from '../../worker/src/games/dive/loaders';
import { DIVE_INACTIVE_PROMPTS, DIVE_LEGACY_PROMPTS } from '../../worker/src/games/dive/prompts';
import { answerSet } from '../../worker/src/games/dive/sets';
import { DIVE_SCHEDULE } from '../../worker/src/games/dive/schedule';

const runtimeIds = new Set([...DIVE_LEGACY_PROMPTS.map((p) => p.id), ...DIVE_SCHEDULE.flat()]);

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
    active: boolean;
    constrained: boolean;
    size: number;
    gem: string;
    too_clever: string[];
  }[];
  const all = [...DIVE_PROMPTS, ...DIVE_INACTIVE_PROMPTS];
  expect(DIVE_PROMPTS.length).toBeGreaterThanOrEqual(320);
  expect(new Set(all.map(({ text }) => normalizeAnswer(text))).size).toBe(all.length);
  expect(new Set(all.map(({ id }) => id)).size).toBe(all.length);
  expect(all.some(({ text }) => /rowing|stanford|teammate|krillion/i.test(text))).toBe(false);
  expect(report.filter((row) => row.active).map((row) => row.id)).toEqual(
    DIVE_PROMPTS.map(({ id }) => id),
  );
  for (const prompt of all.filter((prompt) => runtimeIds.has(prompt.id))) {
    const set = await answerSet(prompt.id);
    expect(Object.keys(set).sort()).toEqual(['answers', 'buckets', 'gem', 'notable', 'size']);
    const answers = decodedAnswers(set);
    const stats = report.find((row) => row.id === prompt.id)!;
    expect(answers.length, prompt.id).toBe(stats.size);
    if (stats.active)
      expect(stats.size, prompt.id).toBeGreaterThanOrEqual(stats.constrained ? 8 : 200);
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
}, 60_000);
it('anchors obvious answers at Surface, and accepts real aliases and typos on the generated data', async () => {
  for (const [id, answer] of [
    ['animals', 'dog'],
    ['animals', 'cat'],
    ['fruits', 'apple'],
  ]) {
    expect(matchAnswer(answer, await answerSet(id))).toMatchObject({ tier: 'surface', points: 10 });
  }
  expect(matchAnswer('USA', await answerSet('countries-vowel')).canonical).toBe('United States');
  expect(matchAnswer('Nyckelharp', await answerSet('instruments')).canonical).toBe('Nyckelharpa');
  expect(matchAnswer('rambutan', await answerSet('gaseous-elements')).canonical).toBeNull();
  expect(matchAnswer('fish', await answerSet('dinosaurs')).canonical).toBeNull();
  expect((await answerSet('iau-constellations')).size).toBe(88);
});
it('selects deterministic legacy days with no repeats in any floor(N/day)-day window', () => {
  const legacySelection = createDiveSelector(null, []);
  const window = Math.floor(DIVE_LEGACY_PROMPTS.length / DIVE_PROMPTS_PER_DAY);
  // Product promise: no prompt returns within 60 team days.
  expect(window).toBeGreaterThanOrEqual(60);
  expect(window).toBeGreaterThanOrEqual(64);
  const active = new Set(DIVE_LEGACY_PROMPTS.map(({ id }) => id));
  for (const start of ['2026-01-01', '2025-10-12', '2026-07-03']) {
    for (let offset = 0; offset < DIVE_LEGACY_PROMPTS.length; offset++) {
      const date = addDays(start, offset);
      expect(legacySelection(date)).toEqual(legacySelection(date));
      expect(legacySelection(date).every(({ id }) => active.has(id))).toBe(true);
      const selected = Array.from({ length: window }, (_, i) =>
        legacySelection(addDays(date, i)).map(({ id }) => id),
      ).flat();
      expect(new Set(selected).size).toBe(window * DIVE_PROMPTS_PER_DAY);
    }
  }
});
it('ships every runtime constrained canonical and alias, without broad-set caps', async () => {
  const document = JSON.parse(
    readFileSync(new URL('./constrained.json', import.meta.url), 'utf8'),
  ) as {
    bases: Record<string, { answers: { name: string; aliases?: string[] }[] }>;
    prompts: {
      id: string;
      derive?: string;
      answers?: { name: string; aliases?: string[] }[];
      expect: number[];
      pearl: string;
    }[];
  };
  for (const prompt of document.prompts) {
    if (!runtimeIds.has(prompt.id)) {
      expect(() => answerSet(prompt.id)).toThrow('Unknown Dive prompt');
      continue;
    }
    const set = await answerSet(prompt.id);
    expect(set.size, prompt.id).toBeGreaterThanOrEqual(prompt.expect[0]);
    expect(set.size, prompt.id).toBeLessThanOrEqual(prompt.expect[1]);
    expect(set.gem.answer).toBe(prompt.pearl);
    if (prompt.answers)
      for (const row of prompt.answers)
        for (const value of [row.name, ...(row.aliases ?? [])])
          expect(matchAnswer(value, set).canonical, `${prompt.id}/${value}`).toBe(row.name);
  }
  for (const [id, value, canonical] of [
    ['best-actor', 'Hanks', 'Tom Hanks'],
    ['best-director', 'Bong', 'Bong Joon-ho'],
    ['nba-teams', 'Raptors', 'Toronto Raptors'],
    ['best-picture', 'Return of the King', 'The Return of the King'],
    ['countries-with-z', 'Czechia', 'Czech Republic'],
    ['countries-no-a', 'Great Britain', 'United Kingdom'],
    ['pokemon-gen1', 'Nidoran F', 'Nidoran female'],
    ['pokemon-fire', 'Arceus', 'Arceus'],
    ['olympian-gods', 'Hades', 'Hades'],
    ['nba-mvp', 'Lew Alcindor', 'Kareem Abdul-Jabbar'],
    ['best-visual-effects', 'Aliens', 'Alien / Aliens'],
  ])
    expect(matchAnswer(value, await answerSet(id)).canonical, `${id}/${value}`).toBe(canonical);
  expect(matchAnswer('Davis', await answerSet('best-supporting-actress')).canonical).toBeNull();
  expect(matchAnswer('Nidoran', await answerSet('pokemon-gen1')).canonical).toBeNull();
  expect(matchAnswer('Pulp Fiction', await answerSet('best-picture')).canonical).toBeNull();
});
it('uses immutable module data without a parsed cache or eviction penalty, and rejects unknown prompt IDs', async () => {
  const first = await answerSet('animals');
  expect(await answerSet('animals')).toBe(first);
  for (const { id } of DIVE_PROMPTS.slice(1, 10)) await answerSet(id);
  expect(await answerSet('animals')).toBe(first);
  expect(() => answerSet('__proto__')).toThrow('Unknown Dive prompt');
  expect(Object.keys(loaders).sort()).toEqual([...runtimeIds].sort());
  expect(
    readdirSync(new URL('../../worker/src/games/dive/data/', import.meta.url))
      .map((name) => name.replace(/\.ts$/, ''))
      .sort(),
  ).toEqual([...runtimeIds].sort());
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
