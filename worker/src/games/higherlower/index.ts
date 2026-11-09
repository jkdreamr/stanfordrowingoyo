import {
  ROUNDS,
  type HigherLowerChoice,
  type HigherLowerUnit,
} from '../../../../shared/games/higherlower';
import { HIGHERLOWER_CATEGORIES, HIGHERLOWER_SCHEDULE, HIGHERLOWER_START } from './data';
import { constructChain } from './chain';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export interface HigherLowerFact {
  asOf?: number | null;
  name: string;
  detail: string | null;
  value: number;
  surprise?: number;
}
export interface HigherLowerCategory {
  asOfLabel: string | null;
  id: string;
  question: string;
  higherLabel: string;
  lowerLabel: string;
  unit: HigherLowerUnit;
  asOf: number | null;
  facts: HigherLowerFact[];
}
const cache = new Map<number, HigherLowerCategory>();
export function higherLowerPuzzle(date: string) {
  const offset = Math.round(
    (Date.parse(date + 'T12:00:00Z') - Date.parse(HIGHERLOWER_START + 'T12:00:00Z')) / 86400000,
  );
  const days = HIGHERLOWER_SCHEDULE.length / 6;
  const index = ((offset % days) + days) % days;
  const width = 6;
  const encoded = HIGHERLOWER_SCHEDULE.slice(index * width, (index + 1) * width);
  const categoryIndex = alphabet.indexOf(encoded[0]);
  let category = cache.get(categoryIndex);
  if (!category) {
    const [id, question, higherLabel, lowerLabel, unit, asOf, packed, asOfLabel] =
      HIGHERLOWER_CATEGORIES[categoryIndex];
    category = {
      asOfLabel,
      id,
      question,
      higherLabel,
      lowerLabel,
      unit,
      asOf,
      facts: packed.split('~').map((row) => {
        const [name, detail, value, surprise, asOf] = row.split('|');
        return {
          ...(asOf !== undefined ? { asOf: asOf === '' ? null : Number(asOf) } : {}),
          name,
          detail: detail || null,
          value: Number(value),
          surprise: Number(surprise ?? 0),
        };
      }),
    };
    cache.set(categoryIndex, category);
  }
  const n = alphabet.indexOf(encoded[1]) + 1;
  let seed = 0;
  for (const c of encoded.slice(2)) seed = seed * 64 + alphabet.indexOf(c);
  return { category, chain: constructChain(category.facts.slice(0, n), seed) };
}
export function replayHigherLower(
  chain: readonly HigherLowerFact[],
  choices: readonly HigherLowerChoice[],
) {
  const results: boolean[] = [];
  for (const [i, choice] of choices.entries()) {
    if (results.at(-1) === false || i >= ROUNDS) break;
    results.push(choice === (chain[i + 1].value > chain[i].value ? 'higher' : 'lower'));
  }
  const score = results.filter(Boolean).length;
  return {
    results,
    score,
    step: score,
    finished: results.at(-1) === false || score === ROUNDS,
    perfect: score === ROUNDS,
  };
}
