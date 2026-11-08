export type DiveTier =
  'Lone Oar' | 'Deep Water' | 'Mid Lake' | 'Shallows' | 'Surface' | 'Missed' | 'Hidden';

export function normalizeAnswer(answer: string): string {
  const words = answer
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replaceAll('&', 'and')
    .replace(/[-_/]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/ +/g, ' ')
    .trim()
    .replace(/^(the|an|a) /, '')
    .split(' ');
  const last = words.at(-1)!;
  if (last.length > 3) {
    if (last.endsWith('ies')) words[words.length - 1] = last.slice(0, -3) + 'y';
    else if (/(ses|xes|zes|ches|shes)$/.test(last)) words[words.length - 1] = last.slice(0, -2);
    else if (last.endsWith('s') && !/(ss|us|is)$/.test(last))
      words[words.length - 1] = last.slice(0, -1);
  }
  return words.join(' ');
}

export function divePoints(
  count: number,
  total: number,
  hidden = false,
): { points: number; tier: DiveTier } {
  if (hidden) return { points: 0, tier: 'Hidden' };
  if (!count || !total) return { points: 0, tier: 'Missed' };
  if (count === 1) return { points: 100, tier: 'Lone Oar' };
  if (count * 10 <= total) return { points: 75, tier: 'Deep Water' };
  if (count * 4 <= total) return { points: 50, tier: 'Mid Lake' };
  if (count * 2 <= total) return { points: 25, tier: 'Shallows' };
  return { points: 10, tier: 'Surface' };
}
