import type { GameScoreDirection } from '../../../shared/types';
import type { Context } from '../context';
import { DIVE_AVAILABLE } from './features';

export interface ServerGame {
  id: string;
  direction: GameScoreDirection;
  score?: (payload: unknown, ctx: Context, date: string) => { score: number; payload: unknown };
}
export const GAMES: Record<string, ServerGame> = {
  ...(DIVE_AVAILABLE ? { dive: { id: 'dive', direction: 'higher' as const } } : {}),
  wordguess: { id: 'wordguess', direction: 'higher' },
  perception: { id: 'perception', direction: 'higher' },
  connections: { id: 'connections', direction: 'higher' },
};
