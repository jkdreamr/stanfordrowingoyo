import { DIVE_TIERS, normalizeAnswer, type DiveTier } from '../../../../shared/games/dive';
import type { DiveNotableAnswer } from '../../../../shared/types';

export interface CuratedAnswer extends DiveNotableAnswer {
  aliases: string[];
}
export interface AnswerSet {
  answers: CuratedAnswer[];
  keys: Map<string, CuratedAnswer>;
  lengths: Map<number, [string, CuratedAnswer][]>;
  gem: DiveNotableAnswer;
  notable: DiveNotableAnswer[];
}
export interface DiveMatch {
  canonical: string | null;
  tier: DiveTier;
  points: number;
}
const codes = {
  s: 'surface',
  t: 'tooclever',
  m: 'school',
  r: 'rare',
  d: 'deep',
  g: 'gem',
} as const;
const stopwords = new Set([
  'none',
  'idk',
  'unknown',
  'pass',
  'skip',
  'dont know',
  'i dont know',
  'no idea',
  'nothing',
  'na',
]);

function notable({ answer, tier, points }: CuratedAnswer): DiveNotableAnswer {
  return { answer, tier, points };
}

export function parseAnswerSet(encoded: string): AnswerSet {
  const keys = new Map<string, CuratedAnswer>();
  const lengths = new Map<number, [string, CuratedAnswer][]>();
  const answers = encoded.split('\n').map((line): CuratedAnswer => {
    const [answer, code, aliases] = line.split('|');
    const tier = codes[code as keyof typeof codes];
    if (!answer || !tier || aliases === undefined) throw new Error('Invalid Dive data row');
    const row = {
      answer,
      tier,
      points: DIVE_TIERS[tier].points,
      aliases: aliases ? aliases.split(';') : [],
    };
    for (const value of [answer, ...row.aliases]) {
      const key = normalizeAnswer(value);
      if (!key || keys.has(key)) throw new Error(`Duplicate Dive key: ${key}`);
      keys.set(key, row);
      const bucket = lengths.get(key.length) ?? [];
      bucket.push([key, row]);
      lengths.set(key.length, bucket);
    }
    return row;
  });
  const gems = answers.filter((row) => row.tier === 'gem');
  if (gems.length !== 1) throw new Error('Dive sets require exactly one Pearl');
  return {
    answers,
    keys,
    lengths,
    gem: notable(gems[0]),
    notable: [
      ...answers.filter((row) => row.tier === 'surface').slice(0, 3),
      ...answers.filter((row) => row.tier === 'deep').slice(0, 2),
    ].map(notable),
  };
}

/** Banded Levenshtein; values outside the band cannot affect an accepted match. */
export function boundedDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    const start = Math.max(1, i - limit),
      end = Math.min(b.length, i + limit);
    current.fill(limit + 1);
    current[0] = i;
    let minimum = current[0];
    for (let j = start; j <= end; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + Number(a[i - 1] !== b[j - 1]),
      );
      minimum = Math.min(minimum, current[j]);
    }
    if (minimum > limit) return limit + 1;
    [previous, current] = [current, previous];
  }
  return previous[b.length];
}

export function matchAnswer(input: string, set: AnswerSet): DiveMatch {
  const key = normalizeAnswer(input);
  const miss: DiveMatch = { canonical: null, tier: 'miss', points: 0 };
  if (!key || stopwords.has(key)) return miss;
  const exact = set.keys.get(key);
  if (exact) return { canonical: exact.answer, tier: exact.tier, points: exact.points };
  if (key.length < 4) return miss;
  const limit = key.length < 8 ? 1 : 2;
  let distance = limit + 1,
    best: CuratedAnswer | undefined,
    ambiguous = false;
  for (let length = key.length - limit; length <= key.length + limit; length++) {
    for (const [candidate, row] of set.lengths.get(length) ?? []) {
      const next = boundedDistance(key, candidate, Math.min(limit, distance));
      if (next < distance) {
        distance = next;
        best = row;
        ambiguous = false;
      } else if (next === distance && best && best !== row) ambiguous = true;
    }
  }
  return best && distance <= limit && !ambiguous
    ? { canonical: best.answer, tier: best.tier, points: best.points }
    : miss;
}
