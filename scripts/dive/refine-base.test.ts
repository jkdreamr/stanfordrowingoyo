import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { normalizeAnswer } from '../../shared/games/dive';
import { answerSet } from './assets';
import { decodedAnswers } from './fixtures';

it('does not reintroduce ambiguous surname keys or displace the canonical Ronaldo', async () => {
  for (const [id, forbidden] of [
    ['masters-champions', ['Wood', 'Woods']],
    ['us-banknote-portraits', ['Washington']],
  ] as const) {
    const set = await answerSet(id);
    for (const guess of forbidden) {
      const key = normalizeAnswer(guess);
      expect(set.buckets[key.length] ?? '').not.toContain('\n' + key + '\t');
    }
  }
  const rows = decodedAnswers(await answerSet('ballon-dor-winners'));
  expect(rows.find((r) => r.answer === 'Ronaldo')).toBeDefined();
  expect(rows.find((r) => r.answer === 'Cristiano Ronaldo')!.aliases).not.toContain('ronaldo');
  for (const [id, names] of [
    ['masters-champions', ['Craig Wood', 'Tiger Woods']],
    ['us-banknote-portraits', ['George Washington', 'Martha Washington']],
  ] as const) {
    const rows = decodedAnswers(await answerSet(id));
    expect(names.every((name) => rows.some((r) => r.answer === name))).toBe(true);
  }
});

it('accepts every frozen refinement alias without changing its canonical identity', async () => {
  const corpus = JSON.parse(
    readFileSync(new URL('./recall/refine-base-selected.json', import.meta.url), 'utf8'),
  ) as Record<string, string[]>;
  const expected = [
    'Avengers: Infinity War',
    'Avengers: Endgame',
    'Spider-Man: Homecoming',
    'Captain America: Brave New World',
  ];
  expect(Object.keys(corpus)).toEqual(['mcu-films']);
  expect(corpus['mcu-films']).toHaveLength(4);
  const rows = decodedAnswers(await answerSet('mcu-films'));
  corpus['mcu-films'].forEach((guess, i) => {
    expect(rows.find((row) => row.aliases.includes(normalizeAnswer(guess)))?.answer).toBe(
      expected[i],
    );
  });
});

it('uses the reviewed Pearl replacements and removes ordinary Too Clever picks', async () => {
  for (const [id, pearl] of Object.entries({
    'chinese-cuisines': 'Anhui',
    'beaufort-winds': 'Light air',
    'best-actor': 'Emil Jannings',
    'best-actress': 'Luise Rainer',
    'best-director': 'Frank Borzage',
    'grammy-album': 'The Button-Down Mind of Bob Newhart',
    'best-original-song': 'The Continental',
    'cloud-genera': 'Cirrocumulus',
  }))
    expect((await answerSet(id)).gem.answer).toBe(pearl);
  for (const id of [
    'nba-75-team',
    'population-100m',
    'test-cricket-teams',
    'turing-award-winners',
    'mission-impossible-films',
    'wizarding-world-films',
  ])
    expect(decodedAnswers(await answerSet(id)).some((r) => r.tier === 'tooclever')).toBe(false);
});
