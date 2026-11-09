import { expect, it } from 'vitest';
import { normalizeAnswer } from './dive';
import { matchAnswer, suggestAnswer } from '../../worker/src/games/dive/matcher';
import { answerSet } from '../../scripts/dive/assets';
import { DIVE_SCHEDULE } from '../../worker/src/games/dive/schedule';
import { DIVE_PROMPTS } from '../../worker/src/games/dive/prompts';
import { loaders } from '../../worker/src/games/dive/loaders';
import { decodedAnswers, fixtureSet } from '../../scripts/dive/fixtures';

const historical = [
  ['lake', 'Lace', 'Lame'],
  ['Michael Jordan', 'Michael Faraday', 'Albert Einstein'],
  ['Manchester City', 'Manchester', 'Liverpool'],
  ['Kolya', 'Kala', 'Gibson'],
  ['Robert Bolt', 'Robert Donat', 'Tom Hanks'],
  ['Smooth', 'Michael J. Smith', 'Buzz Aldrin'],
  ['Michael Jordan', 'Michael Foreman', 'Buzz Aldrin'],
  ['Robert Wise', 'Robert Wilson', 'Edwin Hubble'],
  ['Michael Jordan', 'Michael Strahan', 'Tom Brady'],
  ['London', 'Linden', 'Berlin'],
  ['Michael Jordan', 'Michael Conlan', 'Muhammad Ali'],
  ['Russia', 'Maria Ressa', 'Malala Yousafzai'],
];

it.each(historical)('does not suggest a different entity for %s (%s)', (input, target, other) => {
  const set = fixtureSet(`${target}|s|\n${other}|g|`);
  expect(suggestAnswer(input, set)).toBeNull();
});

it('keeps phonetic misspellings without replacing a different word ending', () => {
  expect(suggestAnswer('Persian', fixtureSet('Peruvian pelican|g|peruvian'))).toBeNull();
  expect(suggestAnswer('Georgia', fixtureSet('David Lloyd George|g|george'))).toBeNull();
  expect(suggestAnswer('Nefthys', fixtureSet('Nephthys|g|'))?.canonical).toBe('Nephthys');
});

it('audits every scheduled set against sibling answers, common confusions and typo positives', async () => {
  const ids = [...new Set(DIVE_SCHEDULE.flat())];
  expect(ids).toHaveLength(320);
  const sets = new Map(
    await Promise.all(ids.map(async (id) => [id, await answerSet(id)] as const)),
  );
  const prompts = new Map(DIVE_PROMPTS.map((prompt) => [prompt.id, prompt]));
  const rows = new Map([...sets].map(([id, set]) => [id, decodedAnswers(set)]));
  const common = [
    'Michael Jordan',
    'Michael Jackson',
    'Robert Bolt',
    'Robert Wise',
    'Tom Cruise',
    'Liam Neeson',
    'Mahatma Gandhi',
    'Greta Thunberg',
    'Christopher Nolan',
    'David Bowie',
    'Russia',
    'Ressa',
    'Smooth',
    'lake',
    'Kolya',
    'London',
    'Manchester City',
    'Austria',
    'Australia',
    'Monaco',
    'Morocco',
    'Niger',
    'Nigeria',
    'Slovakia',
    'Slovenia',
    'Sydney',
    'Sidney',
    'Scotland',
    'Wales',
    'Greenland',
    'European Union',
    'Atlantis',
    'Wakanda',
    'Yesterday',
    'Thriller',
    'Bohemian Rhapsody',
    'Stairway to Heaven',
    'United States',
    'idk',
    'new',
    'cat',
    'xyz',
    'pizza',
    'banana',
    'blue',
    'potato',
    'I do not remember',
  ];
  let eligible = 0,
    correct = 0,
    wrong = 0,
    negatives = 0,
    falseSuggestions = 0,
    overlaps = 0;
  const failures: string[] = [];
  for (const [id, set] of sets) {
    const siblings = ids.filter(
      (other) => other !== id && prompts.get(other)!.theme === prompts.get(id)!.theme,
    );
    const offset = siblings.findIndex((other) => other > id);
    const foreign = [0, 1, 2].flatMap((step) =>
      rows
        .get(siblings[(Math.max(0, offset) + step) % siblings.length])!
        .slice(0, 16)
        .map((row) => row.answer),
    );
    for (const input of new Set([...common, ...foreign])) {
      if (matchAnswer(input, set).canonical) {
        overlaps++;
        continue;
      }
      negatives++;
      const suggestion = suggestAnswer(input, set);
      if (suggestion) {
        falseSuggestions++;
        failures.push(`${id}: ${input} -> ${suggestion.canonical}`);
      }
    }
    for (const row of rows
      .get(id)!
      .filter((row) => normalizeAnswer(row.answer).length >= 10)
      .filter((_, i) => i % 17 === 0)
      .slice(0, 6)) {
      const chars = [...normalizeAnswer(row.answer)];
      for (const i of [1, chars.length - 3]) [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
      const input = chars.join('');
      if (matchAnswer(input, set).canonical) continue;
      eligible++;
      const suggestion = suggestAnswer(input, set)?.canonical;
      if (suggestion === row.answer) correct++;
      else if (suggestion) {
        wrong++;
        failures.push(`${id}: ${input} -> ${suggestion} (wanted ${row.answer})`);
      }
    }
  }
  console.log(
    `scheduled audit: prompts=${ids.length} positives=${eligible} correct=${correct} wrong=${wrong} catch=${((100 * correct) / eligible).toFixed(2)}% negatives=${negatives} overlaps=${overlaps} false=${falseSuggestions}`,
  );
  console.log(`scheduled audit failures: ${failures.join('; ')}`);
  expect(wrong).toBe(0);
  expect(falseSuggestions).toBe(0);
  expect(correct / eligible).toBeGreaterThanOrEqual(0.75);
}, 30000);

it('measures combined matching and suggestions on the five largest banks', async () => {
  const all = await Promise.all(
    Object.keys(loaders).map(async (id) => ({ id, set: await answerSet(id) })),
  );
  all.sort(
    (a, b) =>
      b.set.answers.length +
      Object.values(b.set.buckets).join('').length -
      a.set.answers.length -
      Object.values(a.set.buckets).join('').length,
  );
  for (const { id, set } of all.slice(0, 5)) {
    const inputs = [
      'a'.repeat(60),
      'abcdefghijklmnopqrstuvwxyz'.repeat(3).slice(0, 60),
      'international university association',
      'national international museum of art',
      ...decodedAnswers(set)
        .slice(0, 8)
        .map((row) => normalizeAnswer(row.answer).slice(0, -3) + 'xyz'),
    ];
    const run = (input: string) => {
      matchAnswer(input, set);
      suggestAnswer(input, set);
    };
    const cold = performance.now();
    run(inputs[0]);
    const first = performance.now() - cold;
    for (let i = 0; i < 200; i++) run(inputs[i % inputs.length]);
    const times: number[] = [];
    for (let i = 0; i < 120; i++) {
      const start = performance.now();
      run(inputs[i % inputs.length]);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    console.log(
      `combined timing ${id}: answers=${set.size} first=${first.toFixed(3)}ms max=${times.at(-1)!.toFixed(3)}ms p95=${times[Math.floor(times.length * 0.95)].toFixed(3)}ms (warm Node wall time, not billed CPU)`,
    );
    expect(times.every(Number.isFinite)).toBe(true);
  }
}, 30000);
