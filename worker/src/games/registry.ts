import type { GameScoreDirection } from '../../../shared/types';
import type { Context } from '../context';

export interface ServerGame {
  id: string;
  direction: GameScoreDirection;
  score?: (payload: unknown, ctx: Context, date: string) => { score: number; payload: unknown };
}
export const GAMES: Record<string, ServerGame> = {
  dive: { id: 'dive', direction: 'higher' },
  wordguess: { id: 'wordguess', direction: 'higher' },
  perception: { id: 'perception', direction: 'higher' },
  connections: { id: 'connections', direction: 'higher' },
};
