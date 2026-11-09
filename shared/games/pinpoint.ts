export const PINPOINT_ID = 'pinpoint';
export const PINPOINT_CLUES = 5;

export function pinpointScore(won: boolean, cluesUsed: number): number {
  return won ? 6 - cluesUsed : 0;
}

export function formatPinpointScore(score: number): string {
  return `${score > 0 ? 6 - score : 'X'} / 5`;
}

export function pinpointShare(date: string, won: boolean, cluesUsed: number): string {
  const squares = Array.from({ length: 5 }, (_, i) =>
    won && i === cluesUsed - 1 ? '🟩' : i < cluesUsed ? '🟥' : '⬜',
  ).join('');
  return `Pinpoint · ${date} · ${won ? cluesUsed : 'X'}/5\n${squares}`;
}
