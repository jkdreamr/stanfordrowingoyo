import { DIVE_TIERS, normalizeAnswer, type DiveTier } from '../../../../shared/games/dive';
import type { DiveNotableAnswer } from '../../../../shared/types';

export interface AnswerSet {
  answers: string;
  buckets: Record<number, string>;
  gem: DiveNotableAnswer;
  notable: DiveNotableAnswer[];
  size: number;
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
type Workspace = [Uint16Array, Uint16Array];

/** Banded Levenshtein with prefix/suffix trimming and a submit-local reusable workspace. */
export function boundedDistance(
  a: string,
  b: string,
  limit: number,
  workspace?: Workspace,
): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let start = 0,
    aEnd = a.length,
    bEnd = b.length;
  while (start < aEnd && start < bEnd && a.charCodeAt(start) === b.charCodeAt(start)) start++;
  while (aEnd > start && bEnd > start && a.charCodeAt(aEnd - 1) === b.charCodeAt(bEnd - 1)) {
    aEnd--;
    bEnd--;
  }
  const al = aEnd - start,
    bl = bEnd - start;
  if (!al || !bl) return Math.max(al, bl);
  let [previous, current] = workspace ?? [new Uint16Array(bl + 1), new Uint16Array(bl + 1)];
  for (let j = 0; j <= bl; j++) previous[j] = j;
  for (let i = 1; i <= al; i++) {
    const low = Math.max(1, i - limit),
      high = Math.min(bl, i + limit);
    current[0] = i;
    if (low > 1) current[low - 1] = limit + 1;
    current[high + 1] = limit + 1;
    let minimum = i;
    const character = a.charCodeAt(start + i - 1);
    for (let j = low; j <= high; j++) {
      const insertion = current[j - 1] + 1,
        deletion = previous[j] + 1;
      const substitution = previous[j - 1] + Number(character !== b.charCodeAt(start + j - 1));
      const next = insertion < deletion ? insertion : deletion;
      current[j] = next < substitution ? next : substitution;
      if (current[j] < minimum) minimum = current[j];
    }
    if (minimum > limit) return limit + 1;
    [previous, current] = [current, previous];
  }
  return previous[bl];
}

function decode(set: AnswerSet, data: string, separator: number): DiveMatch {
  const offset = parseInt(data.slice(separator + 1, data.indexOf('\n', separator)), 36);
  const tier = codes[set.answers[offset] as keyof typeof codes];
  const start = offset + 2;
  return {
    canonical: set.answers.slice(start, set.answers.indexOf('\n', start)),
    tier,
    points: DIVE_TIERS[tier].points,
  };
}

export function matchAnswer(input: string, set: AnswerSet): DiveMatch {
  const key = normalizeAnswer(input);
  const miss: DiveMatch = { canonical: null, tier: 'miss', points: 0 };
  if (!key || stopwords.has(key)) return miss;
  const exactBucket = set.buckets[key.length];
  const exact = exactBucket?.indexOf('\n' + key + '\t') ?? -1;
  if (exact !== -1) return decode(set, exactBucket, exact + key.length + 1);
  if (key.length < 4) return miss;
  const limit = key.length < 8 ? 1 : 2;
  const counts = new Uint16Array(128);
  const letters: number[] = [];
  for (let i = 0; i < key.length; i++) {
    const code = key.charCodeAt(i);
    if (!counts[code]) letters.push(code);
    counts[code]++;
  }
  letters.sort((a, b) => counts[b] - counts[a]);
  const characters = letters.map((code) => String.fromCharCode(code));
  const workspace: Workspace = [new Uint16Array(key.length + 4), new Uint16Array(key.length + 4)];
  let distance = limit + 1,
    best = miss,
    ambiguous = false;
  for (let length = key.length - limit; length <= key.length + limit; length++) {
    const bucket = set.buckets[length];
    if (!bucket) continue;
    let position = 1;
    while (position < bucket.length) {
      const separator = bucket.indexOf('\t', position);
      const end = bucket.indexOf('\n', separator);
      const candidateKey = bucket.slice(position, separator);
      let missing = 0;
      for (let i = 0; i < letters.length; i++) {
        let needed = counts[letters[i]],
          offset = -1;
        while (needed && (offset = candidateKey.indexOf(characters[i], offset + 1)) !== -1)
          needed--;
        missing += needed;
        if (missing > limit) break;
      }
      if (missing > limit) {
        position = end + 1;
        continue;
      }
      const next = boundedDistance(key, candidateKey, Math.min(limit, distance), workspace);
      if (next <= limit && next <= distance) {
        const candidate = decode(set, bucket, separator);
        if (next < distance) {
          distance = next;
          best = candidate;
          ambiguous = false;
        } else if (candidate.canonical !== best.canonical) ambiguous = true;
      }
      position = end + 1;
    }
  }
  return best.canonical !== null && !ambiguous ? best : miss;
}
