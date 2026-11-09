export function normalizePinpoint(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’"“”]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(?:(?:types|kinds|sorts) of |things that are |(?:a|an|the) )+/, '')
    .split(' ')
    .filter((word) => !['a', 'an', 'the'].includes(word))
    .map((word) => {
      if (word === 'buses') return 'bus';
      if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
      if (/(?:ches|shes|xes|zes|sses)$/.test(word)) return word.slice(0, -2);
      if (word.length > 3 && word.endsWith('s') && !/(?:ss|us|is)$/.test(word))
        return word.slice(0, -1);
      return word;
    })
    .join(' ');
}

export function typoLimit(answer: string): number {
  return answer.length >= 12 ? 2 : answer.length >= 6 ? 1 : 0;
}

export function distance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  return rows[a.length][b.length];
}

export interface PinpointAnswers {
  accepted: string[];
  reject?: string[];
  typoMask?: number;
}

export const NEAR_MISSES = [
  'words before bell',
  'bell words',
  'cook compounds',
  'words before horse',
  'word after train',
  'bitter compounds',
  'robber',
  'things with kings',
  'words after broke',
  'things with tales',
];

const COMMON_WORDS = new Set(
  'ball bell book cook key king tongue crown clown pocket rocket ring wing light night house horse neck bed board beard brain train spine spin cake care silver sliver tooth teeth tail tale paper water rubber robber handle candle stone store line lime pitch witch drop drip scale stale jack back face fact butter bitter thunder under blade blame fire five break bread word compound before after thing object'.split(
    ' ',
  ),
);

function differentRealWord(guess: string, answer: string): boolean {
  const g = guess.split(' '),
    a = answer.split(' ');
  return (
    g.length === a.length &&
    g.some((word, i) => word !== a[i] && COMMON_WORDS.has(word) && COMMON_WORDS.has(a[i]))
  );
}

export function matchesPinpoint(guess: string, puzzle: PinpointAnswers): boolean {
  const normalized = normalizePinpoint(guess);
  if (!normalized) return false;
  const answers = puzzle.accepted.map(normalizePinpoint);
  if (answers.includes(normalized)) return true;
  if (
    [...NEAR_MISSES, ...(puzzle.reject ?? [])].some(
      (word) => normalizePinpoint(word) === normalized,
    )
  )
    return false;
  return answers.some(
    (answer, index) =>
      (puzzle.typoMask === undefined || (puzzle.typoMask & (1 << index)) !== 0) &&
      !differentRealWord(normalized, answer) &&
      Math.abs(answer.length - normalized.length) <= typoLimit(answer) &&
      distance(normalized, answer) <= typoLimit(answer),
  );
}
