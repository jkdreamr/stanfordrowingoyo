import { closeness, dailyRandom } from './daily';

export const RATE_HOLD_ID = 'ratehold';
/** Strokes per piece shown with a cue, then strokes held without one. */
export const CUED_STROKES = 3;
export const HELD_STROKES = 5;
export const STROKES_PER_PIECE = CUED_STROKES + HELD_STROKES;
export const PIECES = 3;
const BASE_RATES = [18, 20, 22, 24];
const STEP = 4;

export function rateHoldRates(date: string): number[] {
  const rand = dailyRandom(RATE_HOLD_ID, date);
  const base = BASE_RATES[Math.floor(rand() * BASE_RATES.length)];
  return Array.from({ length: PIECES }, (_, i) => base + i * STEP);
}

export const intervalMs = (rate: number) => 60_000 / rate;

/** Stroke rate implied by the held strokes of one piece of tap times. */
export function heldRate(taps: number[]): number {
  const first = taps[CUED_STROKES - 1];
  const last = taps[taps.length - 1];
  return (60_000 * HELD_STROKES) / (last - first);
}

export function scorePiece(rate: number, taps: number[]): number {
  const target = intervalMs(rate);
  let sum = 0;
  for (let i = CUED_STROKES; i < STROKES_PER_PIECE; i++)
    sum += closeness(taps[i] - taps[i - 1] - target, target * 0.06);
  return Math.round(sum / HELD_STROKES);
}

export interface RateHoldResult {
  rates: number[];
  held: number[];
  pieces: number[];
  total: number;
}

export function scoreRateHold(date: string, taps: number[][]): RateHoldResult {
  const rates = rateHoldRates(date);
  const pieces = rates.map((r, i) => scorePiece(r, taps[i]));
  return {
    rates,
    held: taps.map((t) => Math.round(heldRate(t) * 10) / 10),
    pieces,
    total: Math.round(pieces.reduce((a, b) => a + b, 0) / PIECES),
  };
}

/** Narrows untrusted taps (ms since each piece began) to a plausible shape, or null. */
export function parseRateHoldTaps(value: unknown): number[][] | null {
  if (!Array.isArray(value) || value.length !== PIECES) return null;
  const out: number[][] = [];
  for (const piece of value) {
    if (!Array.isArray(piece) || piece.length !== STROKES_PER_PIECE) return null;
    let prev = -Infinity;
    for (const t of piece) {
      if (typeof t !== 'number' || !Number.isInteger(t) || t < 0 || t > 120_000) return null;
      if (prev !== -Infinity && (t - prev < 300 || t - prev > 10_000)) return null;
      prev = t;
    }
    out.push([...piece]);
  }
  return out;
}

export function rateHoldShare(date: string, result: RateHoldResult): string {
  const pieces = result.rates.map((r, i) => `${r} @ ${result.held[i].toFixed(1)}`).join(' · ');
  return [`OYO Rate Hold ${date} ${result.total}/100`, pieces].join('\n');
}
