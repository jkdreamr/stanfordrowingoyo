export const CHICKEN_ID = 'chicken-crossing';
export const CHICKEN_HOP_TIME = 0.16;
export const CHICKEN_MAX_SCORE = 100_000;

export interface ChickenStats {
  rows: number;
  coins: number;
  hops: number;
  death: 'car' | 'train' | 'water' | 'drift' | 'hawk' | 'quit';
  duration_ms: number;
}

export function validateChickenRun(
  score: number,
  stats: unknown,
  elapsedMs: number,
): ChickenStats | null {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return null;
  const s = stats as ChickenStats;
  if (
    Object.keys(s).length !== 5 ||
    Object.keys(s).some((k) => !['rows', 'coins', 'hops', 'death', 'duration_ms'].includes(k)) ||
    ![score, s.rows, s.coins, s.hops, s.duration_ms].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    ) ||
    !['car', 'train', 'water', 'drift', 'hawk', 'quit'].includes(s.death) ||
    !Number.isFinite(elapsedMs) ||
    elapsedMs < 0 ||
    score !== s.rows + 3 * s.coins ||
    s.coins > s.rows ||
    s.rows > s.hops ||
    score > CHICKEN_MAX_SCORE ||
    s.duration_ms > elapsedMs + 1000 ||
    s.hops > Math.floor((Math.min(elapsedMs, s.duration_ms) + 1000) / (CHICKEN_HOP_TIME * 1000)) + 2
  )
    return null;
  return s;
}
