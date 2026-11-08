export const DIVE_TIERS = {
  surface: { label: 'Surface', points: 10, emoji: '🫧' },
  tooclever: { label: 'Too Clever', points: 15, emoji: '🤡' },
  school: { label: 'Midwater', points: 30, emoji: '🐟' },
  rare: { label: 'Rare', points: 60, emoji: '🦑' },
  deep: { label: 'Deep Cut', points: 85, emoji: '🐙' },
  gem: { label: 'Pearl', points: 100, emoji: '🦪' },
  miss: { label: 'Miss', points: 0, emoji: '⬛' },
} as const;
export type DiveTier = keyof typeof DIVE_TIERS;

export function diveVerdict(score: number): string {
  if (score === 0) return 'High And Dry';
  if (score < 150) return 'Toe Dipper';
  if (score < 300) return 'Getting Wet';
  if (score < 450) return 'Open Water';
  if (score < 600) return 'Deep Diver';
  if (score < 700) return 'Abyss Explorer';
  return 'Pearl Collector';
}

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
