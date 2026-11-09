import {
  formatHigherLowerValue,
  ROUNDS,
  type HigherLowerChoice,
} from '../../../shared/games/higherlower';
import type { GameAccess, HigherLowerDay, HigherLowerItem } from '../../../shared/types';

export const MOCK_HIGHERLOWER = Array.from({ length: 21 }, (_, i) => ({
  name: `Practice Town ${i + 1}`,
  detail: 'Artificial Demo Data',
  value: 1000 + (i % 2 ? 800 : 0) + i * 100,
}));
export function mockHigherLowerDay(
  date: string,
  access: GameAccess,
  choices: HigherLowerChoice[],
): HigherLowerDay {
  const results = choices.map(
    (choice, i) =>
      choice === (MOCK_HIGHERLOWER[i + 1].value > MOCK_HIGHERLOWER[i].value ? 'higher' : 'lower'),
  );
  const score = results.filter(Boolean).length;
  const finished = results.at(-1) === false || results.length === ROUNDS;
  const item = (index: number, known: boolean): HigherLowerItem => ({
    ...MOCK_HIGHERLOWER[index],
    value: known ? MOCK_HIGHERLOWER[index].value : null,
    display: known ? formatHigherLowerValue(MOCK_HIGHERLOWER[index].value, 'people') : null,
  });
  return {
    asOfLabel: access.unlocked ? '2020 Census' : null,
    date,
    access,
    question: access.unlocked ? 'Which practice town has more residents?' : null,
    higherLabel: access.unlocked ? 'More' : null,
    lowerLabel: access.unlocked ? 'Fewer' : null,
    unit: access.unlocked ? 'people' : null,
    asOf: access.unlocked ? 2020 : null,
    step: access.unlocked ? score : 0,
    rounds: 20,
    items: access.unlocked
      ? Array.from({ length: results.length + 1 }, (_, i) => item(i, true))
      : [],
    next: access.unlocked && !finished ? item(score + 1, false) : null,
    results: access.unlocked ? results : [],
    finished: access.unlocked && finished,
    score: access.unlocked ? score : 0,
    perfect: access.unlocked && score === ROUNDS,
  };
}
