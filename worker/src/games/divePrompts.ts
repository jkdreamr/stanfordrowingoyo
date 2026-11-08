import { DIVE_PROMPTS_PER_DAY } from '../../../shared/games/dive';
import { DIVE_PROMPTS } from './dive/prompts';

export { DIVE_PROMPTS } from './dive/prompts';

function permutation() {
  const result = [...DIVE_PROMPTS];
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
export function diveSelectionFor(date: string) {
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
export function divePromptsFor(date: string): string[] {
  return diveSelectionFor(date).map((prompt) => prompt.text);
}
