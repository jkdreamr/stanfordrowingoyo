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

function phonetic(key: string): string {
  return key
    .replace(/ph/g, 'f')
    .replace(/[cq]/g, 'k')
    .replace(/[aeiouy]/g, 'a')
    .replace(/(.)\1+/g, '$1');
}

/** Optimal-string-alignment distance: adjacent transpositions count as one edit. */
function transpositionDistance(
  a: string,
  b: string,
  limit: number,
  workspace: Uint16Array[],
): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let [older, previous, current] = workspace;
  older.fill(limit + 1);
  previous.fill(limit + 1);
  for (let j = 0; j <= Math.min(b.length, limit); j++) previous[j] = j;
  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    const low = Math.max(1, i - limit),
      high = Math.min(b.length, i + limit);
    if (low > 1) current[low - 1] = limit + 1;
    current[high + 1] = limit + 1;
    let minimum = limit + 1;
    for (let j = low; j <= high; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + Number(a[i - 1] !== b[j - 1]),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        current[j] = Math.min(current[j], older[j - 2] + 1);
      minimum = Math.min(minimum, current[j]);
    }
    if (minimum > limit) return limit + 1;
    [older, previous, current] = [previous, current, older];
  }
  return previous[b.length];
}

function tokenSimilarity(a: string[], b: string[], workspace: Uint16Array[]): number {
  const used = new Set<number>();
  let shared = 0;
  for (const token of a) {
    let best = 0,
      index = -1;
    for (let i = 0; i < b.length; i++) {
      if (used.has(i)) continue;
      const length = Math.max(token.length, b[i].length);
      if (Math.abs(token.length - b[i].length) > Math.floor(length * 0.28)) continue;
      const distance = transpositionDistance(token, b[i], Math.floor(length * 0.28), workspace);
      if (distance > Math.floor(length * 0.28)) continue;
      const weight = Math.min(token.length, b[i].length) - distance;
      if (weight > best) {
        best = weight;
        index = i;
      }
    }
    if (index !== -1) {
      used.add(index);
      shared += best;
    }
  }
  return shared / Math.max(a.join('').length, b.join('').length);
}

function alignedTokens(a: string[], b: string[], workspace: Uint16Array[]): boolean {
  let start = 0;
  const used = new Set<number>();
  for (const token of a) {
    let best = Infinity,
      index = -1;
    for (let i = start; i < b.length; i++) {
      const limit = Math.max(2, Math.floor(Math.max(token.length, b[i].length) * 0.4));
      const distance = transpositionDistance(token, b[i], limit, workspace);
      if (distance <= limit && distance < best) {
        best = distance;
        index = i;
      }
    }
    if (index === -1) return false;
    used.add(index);
    start = index + 1;
  }
  return a.length !== 1 || b.every((token, index) => used.has(index) || token.length <= 3);
}

/** Advisory only; callers consult this after a miss, never award its points automatically. */
export function suggestAnswer(input: string, set: AnswerSet): DiveMatch | null {
  const key = normalizeAnswer(input);
  if (key.length < 5 || key.length > 80 || stopwords.has(key)) return null;
  const counts = new Uint8Array(128);
  const remaining = new Uint8Array(128);
  const workspace = [new Uint16Array(136), new Uint16Array(136), new Uint16Array(136)];
  for (const character of key) counts[character.charCodeAt(0)]++;
  const tokens = key.split(' ');
  const sound = phonetic(key);
  const scores = new Map<string, { score: number; match: DiveMatch }>();
  for (const [size, bucket] of Object.entries(set.buckets)) {
    const length = Number(size);
    const longest = Math.max(length, key.length);
    if (Math.min(length, key.length) < longest * 0.6) continue;
    let position = 1;
    while (position < bucket.length) {
      const separator = bucket.indexOf('\t', position);
      const end = bucket.indexOf('\n', separator);
      const candidate = bucket.slice(position, separator);
      position = end + 1;
      const other = candidate.split(' ');
      if (
        tokens.length === 1 &&
        other.length === 1 &&
        Math.min(length, key.length) < longest * (key.length < 8 ? 0.85 : 0.75)
      )
        continue;
      remaining.set(counts);
      let shared = 0;
      for (const character of candidate) {
        const code = character.charCodeAt(0);
        if (remaining[code]) {
          remaining[code]--;
          shared++;
        }
      }
      if (shared / longest < 0.6) continue;
      if ((tokens.length > 1 || other.length > 1) && !alignedTokens(tokens, other, workspace))
        continue;
      let score = 0;
      const shortWord =
        tokens.length === 1 && other.length === 1 && Math.min(length, key.length) < 8;
      const limit = Math.min(5, Math.floor(longest * (shortWord ? 0.24 : 0.28)));
      if (Math.abs(length - key.length) <= limit && longest - shared <= limit) {
        const distance = transpositionDistance(key, candidate, limit, workspace);
        if (distance <= limit) score = 1 - distance / longest;
      }
      if (
        Math.max(key.length, length) >= 7 &&
        key.length >= 6 &&
        length >= 6 &&
        key.at(-1) === candidate.at(-1) &&
        sound.length >= 4 &&
        sound === phonetic(candidate) &&
        transpositionDistance(key, candidate, Math.floor(longest * 0.4), workspace) <=
          Math.floor(longest * 0.4)
      )
        score = Math.max(score, 0.8);
      if (key.includes(' ') || candidate.includes(' ')) {
        if ((tokens.length > 1 && other.length > 1) || Math.min(key.length, length) >= 6)
          score = Math.max(score, tokenSimilarity(tokens, other, workspace) - 0.04);
      }
      if (score < 0.65) continue;
      const match = decode(set, bucket, separator);
      const canonical = match.canonical!;
      if (tokens.length === 1 && key.length < 6 && normalizeAnswer(canonical).includes(' '))
        continue;
      if (score > (scores.get(canonical)?.score ?? 0)) scores.set(canonical, { score, match });
    }
  }
  const ranked = [...scores.values()].sort(
    (a, b) => b.score - a.score || (a.match.canonical! < b.match.canonical! ? -1 : 1),
  );
  if (!ranked.length || (ranked[1] && ranked[0].score - ranked[1].score <= 0.035)) return null;
  return ranked[0].match;
}
