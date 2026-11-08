import { DIVE_TIERS, normalizeAnswer, type DiveTier } from '../../shared/games/dive';
import type { AnswerSet } from '../../worker/src/games/dive/matcher';

const codes = {
  s: 'surface',
  t: 'tooclever',
  m: 'school',
  r: 'rare',
  d: 'deep',
  g: 'gem',
} as const;
export function fixtureSet(encoded: string): AnswerSet {
  const keys = new Map<string, string>();
  let answers = '';
  const rows = encoded.split('\n').map((line) => {
    const [answer, code, variants] = line.split('|');
    const tier = codes[code as keyof typeof codes];
    if (!answer || !tier || variants === undefined) throw new Error('Invalid fixture row');
    const reference = answers.length.toString(36);
    answers += `${code}\t${answer}\n`;
    for (const value of [answer, ...(variants ? variants.split(';') : [])]) {
      const key = normalizeAnswer(value);
      if (!key || keys.has(key)) throw new Error('Duplicate fixture key');
      keys.set(key, `${key}\t${reference}\n`);
    }
    return { answer, tier, points: DIVE_TIERS[tier].points };
  });
  const gems = rows.filter(({ tier }) => tier === 'gem');
  if (gems.length !== 1) throw new Error('Exactly one Pearl required');
  const buckets: Record<number, string> = {};
  for (const key of [...keys.keys()].sort())
    buckets[key.length] = (buckets[key.length] ?? '\n') + keys.get(key);
  return {
    buckets,
    answers,
    size: rows.length,
    gem: gems[0],
    notable: rows.slice(0, 5),
  };
}

export function decodedAnswers(set: AnswerSet) {
  const rows = new Map<
    string,
    { answer: string; tier: DiveTier; points: number; aliases: string[] }
  >();
  for (const line of Object.values(set.buckets).flatMap((bucket) => bucket.trim().split('\n'))) {
    const [key, reference] = line.split('\t');
    const offset = parseInt(reference, 36);
    const code = set.answers[offset];
    const answer = set.answers.slice(offset + 2, set.answers.indexOf('\n', offset));
    const tier = codes[code as keyof typeof codes];
    let row = rows.get(answer);
    if (!row) {
      row = { answer, tier, points: DIVE_TIERS[tier].points, aliases: [] };
      rows.set(answer, row);
    }
    if (key !== normalizeAnswer(answer)) row.aliases.push(key);
  }
  return [...rows.values()];
}
