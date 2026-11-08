import { DIVE_PROMPTS_PER_DAY } from '../../../shared/games/dive';
import { DIVE_PROMPTS, DIVE_INACTIVE_PROMPTS, DIVE_LEGACY_PROMPTS } from './dive/prompts';
import type { DivePrompt } from './dive/prompts';
import { DIVE_SCHEDULE, DIVE_SCHEDULE_CUTOVER } from './dive/schedule';
import { validateDiveSchedule } from './dive/rotation';

export { DIVE_PROMPTS } from './dive/prompts';

function permutation() {
  const result = [...DIVE_LEGACY_PROMPTS];
  let state = 0x6f796f;
  function random() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
const ordered = permutation();
function legacySelectionFor(date: string) {
  const day = Math.floor(
    (Date.parse(`${date}T12:00:00Z`) - Date.parse('2026-01-01T12:00:00Z')) / 86400000,
  );
  return Array.from(
    { length: DIVE_PROMPTS_PER_DAY },
    (_, i) =>
      ordered[
        (((day * DIVE_PROMPTS_PER_DAY + i) % ordered.length) + ordered.length) % ordered.length
      ],
  );
}
export function createDiveSelector(
  cutover: string | null,
  schedule: readonly (readonly string[])[],
  prompts: readonly DivePrompt[] = [...DIVE_PROMPTS, ...DIVE_INACTIVE_PROMPTS],
) {
  const bank = new Map(prompts.map((prompt) => [prompt.id, prompt]));
  if (cutover !== null) validateDiveSchedule(schedule, prompts);
  return (date: string): DivePrompt[] => {
    if (cutover === null || date < cutover) return legacySelectionFor(date);
    const offset = Math.floor(
      (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${cutover}T12:00:00Z`)) / 86400000,
    );
    return schedule[offset % schedule.length].map((id) => bank.get(id)!);
  };
}
export const diveSelectionFor = createDiveSelector(DIVE_SCHEDULE_CUTOVER, DIVE_SCHEDULE);
export function divePromptsFor(date: string): string[] {
  return diveSelectionFor(date).map((prompt) => prompt.text);
}
