import { hashSeed } from '../../../shared/games/daily';
import {
  CHICKEN_ID,
  CHICKEN_MAX_SCORE,
  validateChickenRun,
} from '../../../shared/games/chickenCrossing';
import { ARCADE_CHICKEN_ENABLED } from './features';

export const ARCADE_GAMES: Record<
  string,
  {
    id: string;
    max: number;
    validate: (score: number, stats: unknown, elapsedMs: number) => unknown | null;
  }
> = ARCADE_CHICKEN_ENABLED
  ? {
      [CHICKEN_ID]: { id: CHICKEN_ID, max: CHICKEN_MAX_SCORE, validate: validateChickenRun },
    }
  : {};

export const arcadeSeed = (game: string, date: string) => hashSeed('arcade:' + game + ':' + date);
