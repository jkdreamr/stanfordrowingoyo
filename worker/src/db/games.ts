import type { GameResult } from '../../../shared/types';

export type ResultRow = Omit<GameResult, 'payload'> & { payload_json: string };
export function toGameResult({ payload_json, ...row }: ResultRow): GameResult {
  return { ...row, payload: JSON.parse(payload_json) };
}
