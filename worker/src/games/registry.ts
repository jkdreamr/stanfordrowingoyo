import type { GameScoreDirection } from '../../../shared/types';
import type { Context } from '../context';
import { DIVE_ENABLED } from './features';
import { PINPOINT_ENABLED } from './features';

export interface ServerGame {
  id: string;
  direction: GameScoreDirection;
  score?: (payload: unknown, ctx: Context, date: string) => { score: number; payload: unknown };
}
export const GAMES: Record<string, ServerGame> = {
  ...(PINPOINT_ENABLED ? { pinpoint: { id: 'pinpoint', direction: 'higher' as const } } : {}),
  ...(DIVE_ENABLED ? { dive: { id: 'dive', direction: 'higher' as const } } : {}),
  wordguess: { id: 'wordguess', direction: 'higher' },
  perception: { id: 'perception', direction: 'higher' },
  connections: { id: 'connections', direction: 'higher' },
};
