import type { GameResult } from '../../../shared/types';
import { dailyAnswer, score } from '../games/wordGuess';

export type ResultRow = Omit<GameResult, 'payload'> & { payload_json: string };
export function toGameResult({ payload_json, ...row }: ResultRow): GameResult {
  const payload = JSON.parse(payload_json);
  if (row.game_id === 'wordguess' && Array.isArray(payload.guesses)) {
    payload.answer = dailyAnswer(row.date);
    payload.marks = payload.guesses.map((word: string) => score(word, payload.answer));
  }
  return { ...row, payload };
}
