import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { addDays } from '../../shared/dates';
import { diveSelectionFor } from '../../worker/src/games/divePrompts';
import type { DivePrompt } from '../../worker/src/games/dive/prompts';
import { DIVE_SCHEDULE, DIVE_SCHEDULE_CUTOVER } from '../../worker/src/games/dive/schedule';
import { answerSet } from '../../worker/src/games/dive/sets';

const manifest = JSON.parse(
  readFileSync(new URL('./legacy-manifest.json', import.meta.url), 'utf8'),
) as {
  reference: string;
  epoch: string;
  files: Record<string, string>;
  days: string[][];
  prompts: Record<string, { metadata: DivePrompt; answersSha256: string }>;
};
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

it('keeps the independently frozen legacy files and complete 66-day reference unchanged', () => {
  expect(manifest.reference).toBe('d9f96cfed310ad709dd8cb89084c1eedfacf3118');
  expect(manifest.epoch).toBe('2026-01-01');
  expect(Object.keys(manifest.files)).toHaveLength(331);
  expect(manifest.days).toHaveLength(66);
  expect(manifest.days.every((day) => day.length === 5)).toBe(true);
  expect(new Set(manifest.days.flat()).size).toBe(330);
  expect(Object.keys(manifest.prompts).sort()).toEqual([...manifest.days.flat()].sort());
  for (const [path, hash] of Object.entries(manifest.files))
    expect(sha256(readFileSync(new URL('../../' + path, import.meta.url))), path).toBe(hash);
});

it('preserves order, metadata and loaded answers for every supported pre-cutover date', async () => {
  expect(DIVE_SCHEDULE_CUTOVER).toBe('2026-11-23');
  const hashes = new Map(
    await Promise.all(
      Object.keys(manifest.prompts).map(
        async (id) => [id, sha256(JSON.stringify(await answerSet(id)))] as const,
      ),
    ),
  );
  for (let offset = -66; addDays(manifest.epoch, offset) < '2026-11-23'; offset++) {
    const date = addDays(manifest.epoch, offset);
    const expected = manifest.days[((offset % 66) + 66) % 66];
    const actual = diveSelectionFor(date);
    expect(
      actual.map((p) => p.id),
      date,
    ).toEqual(expected);
    for (const prompt of actual) {
      expect(prompt, date).toEqual(manifest.prompts[prompt.id].metadata);
      expect(hashes.get(prompt.id), date + '/' + prompt.id).toBe(
        manifest.prompts[prompt.id].answersSha256,
      );
    }
  }
  expect(diveSelectionFor('2026-11-22').map((p) => p.id)).toEqual(manifest.days[325 % 66]);
  expect(diveSelectionFor('2026-11-23').map((p) => p.id)).toEqual(DIVE_SCHEDULE[0]);
  expect(diveSelectionFor('2026-11-24').map((p) => p.id)).toEqual(DIVE_SCHEDULE[1]);
});
