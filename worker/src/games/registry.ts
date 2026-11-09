import type { GameScoreDirection } from '../../../shared/types';
import type { Context } from '../context';
import { CROSSWORD_ENABLED, DIVE_ENABLED } from './features';

export interface ServerGame {
  id: string;
  direction: GameScoreDirection;
  score?: (payload: unknown, ctx: Context, date: string) => { score: number; payload: unknown };
}
export const GAMES: Record<string, ServerGame> = {
  ...(CROSSWORD_ENABLED ? { crossword: { id: 'crossword', direction: 'lower' as const } } : {}),
  ...(DIVE_ENABLED ? { dive: { id: 'dive', direction: 'higher' as const } } : {}),
  wordguess: { id: 'wordguess', direction: 'higher' },
  perception: { id: 'perception', direction: 'higher' },
  connections: { id: 'connections', direction: 'higher' },
};
