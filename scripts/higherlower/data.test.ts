import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { addDays } from '../../shared/dates';
import {
  formatHigherLowerValue,
  formatHigherLowerScore,
  higherLowerShare,
} from '../../shared/games/higherlower';
import { higherLowerPuzzle } from '../../worker/src/games/higherlower';
import { HIGHERLOWER_SCHEDULE } from '../../worker/src/games/higherlower/data';
import { constructChain } from '../../worker/src/games/higherlower/chain';
import { extend, render, validateFacts, validateSchedule, validChain } from './generate.mjs';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');
describe('Higher or Lower frozen data', () => {
  it('validates all facts, every emitted chain and balanced categories', async () => {
    const { categories } = JSON.parse(await read('./facts.json'));
    const schedule = JSON.parse(await read('./schedule.json'));
    validateFacts(categories);
    validateSchedule(categories, schedule);
    expect(schedule.length).toBeGreaterThanOrEqual(380);
    expect(HIGHERLOWER_SCHEDULE.length).toBe(schedule.length * 6);
    const counts = new Map<string, number>();
    for (let i = 0; i < schedule.length; i++) {
      const date = addDays('2026-11-02', i),
        { category, chain } = higherLowerPuzzle(date);
      expect(validChain(chain)).toBe(true);
      expect(chain).toHaveLength(21);
      expect(new Set(chain.map((f) => f.name)).size).toBe(21);
      const directions = chain.slice(1).map((f, j) => f.value > chain[j].value);
      const ratios = chain
        .slice(1)
        .map((f, j) => Math.max(f.value, chain[j].value) / Math.min(f.value, chain[j].value));
      expect(ratios.every((r) => r >= 1.1 && r <= 3)).toBe(true);
      expect(ratios.filter((r) => r <= 1.4).length).toBeGreaterThanOrEqual(14);
      expect(directions.filter(Boolean).length).toBeGreaterThanOrEqual(7);
      expect(directions.filter(Boolean).length).toBeLessThanOrEqual(13);
      for (let j = 0; j <= directions.length - 5; j++)
        expect(new Set(directions.slice(j, j + 5)).size).toBe(2);
      expect(chain.map((f) => f.name)).toEqual(schedule[i].facts);
      expect(category.id).toBe(schedule[i].category);
      const original = categories.find((c) => c.id === category.id);
      expect(category.question).toBe(original.question);
      expect(category.asOfLabel).toBe(original.asOfLabel);
      expect(category.higherLabel).toBe(original.higherLabel);
      expect(category.lowerLabel).toBe(original.lowerLabel);
      if (i > 0 && /^(country|state)-/.test(category.id))
        expect(/^(country|state)-/.test(schedule[i - 1].category)).toBe(false);
      counts.set(category.id, (counts.get(category.id) ?? 0) + 1);
    }
    expect(Math.max(...counts.values()) - Math.min(...counts.values())).toBeLessThanOrEqual(1);
    expect(higherLowerPuzzle('2026-11-01')).toEqual(higherLowerPuzzle(schedule.at(-1).date));
    expect(higherLowerPuzzle(addDays('2026-11-02', schedule.length))).toEqual(
      higherLowerPuzzle('2026-11-02'),
    );
  });
  it('regenerates identical output, preserves existing days on extension and rejects invalid inputs', async () => {
    const { categories } = JSON.parse(await read('./facts.json'));
    const schedule = JSON.parse(await read('./schedule.json'));
    expect(render(categories, schedule)).toBe(
      await read('../../worker/src/games/higherlower/data.ts'),
    );
    expect(extend(categories, schedule, 2).slice(0, schedule.length)).toEqual(schedule);
    expect(extend(categories, [], 2)).toEqual(extend(categories, [], 2));
    const dated = structuredClone(categories);
    dated[0].facts[0].asOf = 2019;
    dated[0].facts[1].asOf = null;
    const encoded = render(dated, schedule);
    expect(encoded).toContain(
      `${dated[0].facts[0].value}|${Number(dated[0].facts[0].surprise ?? 0)}|2019`,
    );
    expect(encoded).toContain(
      `${dated[0].facts[1].value}|${Number(dated[0].facts[1].surprise ?? 0)}|~`,
    );
    expect(() => validateFacts([])).toThrow();
    const bad = structuredClone(categories);
    bad[0].facts[0].value = 0;
    expect(() => validateFacts(bad)).toThrow();
    const duplicate = structuredClone(schedule);
    duplicate[1] = { ...duplicate[0], date: duplicate[1].date };
    expect(() => validateSchedule(categories, duplicate)).toThrow();
    const reordered = structuredClone(categories);
    reordered[0].facts.reverse();
    expect(() => validateSchedule(reordered, schedule)).toThrow('Frozen chain changed');
    const appended = structuredClone(categories);
    appended[0].facts.push({ name: 'New fact', value: 12345 });
    expect(() => validateSchedule(appended, schedule)).not.toThrow();
    expect(constructChain([], 1)).toEqual([]);
    expect(
      constructChain(
        Array.from({ length: 21 }, () => ({ value: 1 })),
        1,
      ),
    ).toEqual([]);
    expect(validChain([])).toBe(false);
  });
});
it('formats units, scores and spoiler-free shares', () => {
  expect(formatHigherLowerValue(8849, 'm')).toBe('8,849.0 m');
  expect(formatHigherLowerValue(39500000, 'people')).toBe('39.50 million people');
  expect(formatHigherLowerValue(247500000, 'people')).toBe('247.50 million people');
  expect(formatHigherLowerValue(143830000, 'people')).toBe('143.83 million people');
  expect(formatHigherLowerValue(1000000000, 'usd')).toBe('$1.00 billion');
  expect(formatHigherLowerValue(576851, 'people')).toBe('576,851 people');
  expect(formatHigherLowerValue(2920000000, 'usd')).toBe('$2.92 billion');
  expect(formatHigherLowerValue(27720000000000, 'usd')).toBe('$27.72 trillion');
  expect(formatHigherLowerValue(0.534, 'g/cm3')).toBe('0.53 g/cm³');
  expect(formatHigherLowerValue(6, 'g/cm3')).toBe('6.00 g/cm³');
  expect(formatHigherLowerValue(1997, 'year')).toBe('1997');
  expect(formatHigherLowerValue(7299, 's')).toBe('2:01:39');
  expect(formatHigherLowerValue(68000, 'seats')).toBe('68,000 seats');
  expect(formatHigherLowerValue(110531300, 'passengers')).toBe('110.53 million passengers');
  expect(formatHigherLowerValue(38387, 'points')).toBe('38,387 points');
  expect(formatHigherLowerValue(89, 'kcal')).toBe('89 kcal / 100 g');
  expect(formatHigherLowerValue(22.16, 'km')).toBe('22 km');
  expect(formatHigherLowerValue(123, 'km2')).toBe('123.0 km²');
  expect(formatHigherLowerScore(7)).toBe('7 / 20');
  expect(higherLowerShare('2026-11-16', 1, [true, false])).toBe(
    'OYO Higher or Lower 2026-11-16\n\n1 / 20\n🟩🟥',
  );
  expect(higherLowerShare('2026-11-16', 0, [])).toBe('OYO Higher or Lower 2026-11-16\n\n0 / 20\n');
});
it('constructs the full 380-day schedule with trivial average CPU cost', async () => {
  const { categories } = JSON.parse(await read('./facts.json'));
  const schedule = JSON.parse(await read('./schedule.json'));
  const inputs = schedule.map((day) => ({
    day,
    facts: categories.find((c) => c.id === day.category).facts.slice(0, day.poolSize),
  }));
  const start = performance.now();
  const chains = inputs.map(({ day, facts }) => constructChain(facts, day.seed));
  const elapsed = performance.now() - start;
  console.log(
    `Higher or Lower: ${chains.length} chains, ${((elapsed * 1000) / chains.length).toFixed(2)} µs/chain (Node wall clock)`,
  );
  expect(chains.every((chain) => chain.length === 21)).toBe(true);
  expect(elapsed / chains.length).toBeLessThan(1);
});
it('renders every eligible comparison distinctly', async () => {
  const { categories } = JSON.parse(await read('./facts.json'));
  for (const category of categories) {
    for (const a of category.facts)
      for (const b of category.facts) {
        if (Math.max(a.value, b.value) / Math.min(a.value, b.value) >= 1.1) {
          expect(formatHigherLowerValue(a.value, category.unit)).not.toBe(
            formatHigherLowerValue(b.value, category.unit),
          );
        }
      }
  }
});
