import { expect, it } from 'vitest';
import { addDays } from '../../../shared/dates';
import { createDiveSelector, diveSelectionFor } from './divePrompts';
import { DIVE_LEGACY_PROMPTS, DIVE_PROMPTS, DIVE_INACTIVE_PROMPTS } from './dive/prompts';
import type { DivePrompt } from './dive/prompts';
import { DIVE_SCHEDULE, DIVE_SCHEDULE_CUTOVER, DIVE_SCHEDULE_STATUS } from './dive/schedule';
import { validateDiveSchedule } from './dive/rotation';
import { answerSet } from './dive/sets';

const bank = DIVE_LEGACY_PROMPTS.slice(0, 320).map((prompt, i): DivePrompt => ({
  ...prompt,
  theme: ['geography', 'science', 'film', 'sports', 'history'][i % 5],
  cluster: i % 5 === 0 ? 'countries' : null,
  constrained: i % 5 < 3,
  size: [12, 80, 200, 250, 250][i % 5],
}));
const schedule = Array.from({ length: 64 }, (_, i) =>
  bank.slice(i * 5, i * 5 + 5).map((prompt) => prompt.id),
);
const cutover = '2027-01-15';
const legacySelection = createDiveSelector(null, []);

it.each([
  ['2025-10-12', ['war-films', 'cities-nl', 'soccer-players', 'djs', 'clothing']],
  ['2026-01-01', ['game-characters', 'cities-cz', 'cities-de', 'cities-pe', 'chickens']],
  ['2026-03-18', ['mammals', 'subjects', 'anime-characters', 'kpop', 'cities-fi']],
  ['2026-11-08', ['reality-tv', 'manga', 'japanese-films', 'tube', 'lakes']],
  ['2026-11-09', ['pasta', 'tolkien', 'cities-be', 'meteorology', 'psychologists']],
  ['2027-01-01', ['k-dramas', 'cities-no', 'landforms', 'dinosaurs', 'italian-food']],
])('preserves pre-change legacy selection for %s, including retired prompts', (date, ids) => {
  expect(legacySelection(date).map((prompt) => prompt.id)).toEqual(ids);
  if (date < DIVE_SCHEDULE_CUTOVER!)
    expect(diveSelectionFor(date).map((prompt) => prompt.id)).toEqual(ids);
  expect(createDiveSelector(cutover, schedule, bank)(date).map((prompt) => prompt.id)).toEqual(ids);
});

it('enables the complete reviewed bank at the configured cutover with every real day valid', () => {
  expect(DIVE_SCHEDULE_CUTOVER).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(DIVE_SCHEDULE_STATUS).toBe('64 days, 320 constrained, 0 broad');
  expect(DIVE_PROMPTS.filter((prompt) => prompt.constrained)).toHaveLength(320);
  validateDiveSchedule(DIVE_SCHEDULE, DIVE_PROMPTS);
  expect(DIVE_SCHEDULE).toHaveLength(64);
  const seen = new Set<string>();
  for (let i = 0; i < DIVE_SCHEDULE.length; i++) {
    const day = diveSelectionFor(addDays(DIVE_SCHEDULE_CUTOVER!, i));
    expect(day.map((p) => p.id)).toEqual(DIVE_SCHEDULE[i]);
    expect(day.filter((p) => p.constrained).length).toBeGreaterThanOrEqual(3);
    expect(new Set(day.map((p) => p.theme)).size).toBe(5);
    const clusters = day.map((p) => p.cluster).filter(Boolean);
    expect(new Set(clusters).size).toBe(clusters.length);
    expect(day.every((p) => p.size <= 24) || day.every((p) => p.size > 120)).toBe(false);
    day.forEach((p) => seen.add(p.id));
  }
  expect(seen.size).toBe(320);
  const retired = DIVE_INACTIVE_PROMPTS.filter((p) => p.constrained);
  expect(retired).toHaveLength(65);
  expect(retired.every((p) => !seen.has(p.id))).toBe(true);
  expect(diveSelectionFor(addDays(DIVE_SCHEDULE_CUTOVER!, 64))).toEqual(
    diveSelectionFor(DIVE_SCHEDULE_CUTOVER!),
  );
  expect([...DIVE_PROMPTS, ...DIVE_INACTIVE_PROMPTS].every((p) => p.theme)).toBe(true);
  for (const id of ['manga', 'anime', 'japanese-films', 'cities-jp', 'anime-characters'])
    expect([...DIVE_PROMPTS, ...DIVE_INACTIVE_PROMPTS].find((p) => p.id === id)?.cluster).toBe(
      'japan',
    );
});

it('schedules only the all-years award sets and preserves every retired family in metadata', () => {
  const scheduled = new Set(DIVE_SCHEDULE.flat());
  for (const id of [
    'grammy-album',
    'grammy-record',
    'grammy-song',
    'grammy-new-artist',
    'booker-winners',
    'hugo-novels',
    'newbery-winners',
    'pulitzer-fiction',
    'emmy-drama',
    'emmy-comedy',
    'iba-cocktails',
  ])
    expect(scheduled.has(id)).toBe(true);
  const retiredFamilies = DIVE_INACTIVE_PROMPTS.filter(
    (p) =>
      /-(pre1980|1980-1999|2000-2026|early|middle|recent)$/.test(p.id) ||
      p.id.startsWith('astronaut-group-'),
  );
  expect(retiredFamilies).toHaveLength(33);
  expect(retiredFamilies.every((p) => !scheduled.has(p.id))).toBe(true);
});

it('switches only on the cutover, follows every fixture day and wraps deterministically', () => {
  validateDiveSchedule(schedule, bank);
  const selection = createDiveSelector(cutover, schedule, bank);
  expect(selection(addDays(cutover, -1))).toEqual(legacySelection(addDays(cutover, -1)));
  expect(schedule.length).toBeGreaterThanOrEqual(64);
  const seen = new Set<string>();
  for (let i = 0; i < schedule.length; i++) {
    const day = selection(addDays(cutover, i));
    expect(day.map((prompt) => prompt.id)).toEqual(schedule[i]);
    expect(day.filter((prompt) => prompt.constrained).length).toBeGreaterThanOrEqual(3);
    expect(new Set(day.map((prompt) => prompt.theme)).size).toBe(5);
    const clusters = day.map((prompt) => prompt.cluster).filter(Boolean);
    expect(new Set(clusters).size).toBe(clusters.length);
    expect(day.some((prompt) => prompt.size <= 24)).toBe(true);
    expect(day.some((prompt) => prompt.size > 120)).toBe(true);
    day.forEach((prompt) => seen.add(prompt.id));
  }
  expect(seen.size).toBe(320);
  expect(selection(addDays(cutover, 64))).toEqual(selection(cutover));
  expect(createDiveSelector(null, [], bank)(cutover)).toEqual(legacySelection(cutover));
});

it('keeps every fixture scheduled ID loadable and every scheduled constrained set complete', async () => {
  for (const id of schedule.flat()) expect((await answerSet(id)).size).toBeGreaterThanOrEqual(8);
  for (const id of DIVE_SCHEDULE.flat())
    expect((await answerSet(id)).size).toBeGreaterThanOrEqual(8);
  for (const prompt of DIVE_PROMPTS.filter((p) => p.constrained))
    expect((await answerSet(prompt.id)).size).toBe(prompt.size);
  for (const prompt of DIVE_INACTIVE_PROMPTS.filter((p) => p.constrained))
    expect(() => answerSet(prompt.id)).toThrow('Unknown Dive prompt');
}, 60_000);

it('rejects empty, short, unknown, duplicate, conflicting, incomplete and unbalanced schedules', () => {
  expect(() => createDiveSelector(cutover, [], bank)).toThrow('at least 64');
  expect(() => validateDiveSchedule(schedule.slice(1), bank)).toThrow('at least 64');
  for (const change of [
    (days: string[][]) => days[0].pop(),
    (days: string[][]) => (days[0][0] = 'unknown-id'),
    (days: string[][]) => (days[0][0] = days[1][0]),
  ]) {
    const days = schedule.map((day) => [...day]);
    change(days);
    expect(() => validateDiveSchedule(days, bank)).toThrow();
  }
  for (const change of [
    (rows: DivePrompt[]) => (rows[1].theme = rows[0].theme),
    (rows: DivePrompt[]) => (rows[1].cluster = rows[0].cluster),
    (rows: DivePrompt[]) => (rows[0].constrained = false),
    (rows: DivePrompt[]) => rows.forEach((p) => (p.size = 8)),
    (rows: DivePrompt[]) => rows.forEach((p) => (p.size = 200)),
    (rows: DivePrompt[]) => rows.push({ ...rows[0], id: 'omitted-constrained' }),
  ]) {
    const rows = bank.map((prompt) => ({ ...prompt }));
    change(rows);
    expect(() => validateDiveSchedule(schedule, rows)).toThrow();
  }
});
