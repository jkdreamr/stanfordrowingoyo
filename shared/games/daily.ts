/** Whole days since 2026-01-01 for a YYYY-MM-DD team date. */
export function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 86400000);
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash of a string to an unsigned 32-bit seed. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic generator shared by the whole team for one game on one date. */
export function dailyRandom(gameId: string, date: string): () => number {
  return mulberry32(hashSeed(gameId + ':' + date));
}

/** 100 at a perfect answer, about 61 at the typical miss and 88 at half of it. */
export function closeness(miss: number, typicalMiss: number): number {
  if (!Number.isFinite(miss)) return 0;
  const r = Math.abs(miss) / typicalMiss;
  return Math.round(100 * Math.exp(-0.494 * r * r));
}

export function isIntIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}
