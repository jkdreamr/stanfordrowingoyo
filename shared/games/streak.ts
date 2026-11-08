import { addDays } from '../dates';
import type { GamesStreak } from '../types';

export function gamesStreak(dates: string[], today: string): GamesStreak {
  let current = 0;
  let best = 0;
  let run = 0;
  let previous: string | undefined;
  for (const date of dates) {
    run = previous && addDays(previous, 1) === date ? run + 1 : 1;
    best = Math.max(best, run);
    if (date === today || date === addDays(today, -1)) current = run;
    previous = date;
  }
  return { current, best };
}
