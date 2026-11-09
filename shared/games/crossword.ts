export const CROSSWORD_ID = 'crossword';
export const SIZE = 5;
export type CrosswordDirection = 'across' | 'down';
export type CrosswordScope = 'cell' | 'word' | 'puzzle';
export const CHECK_PENALTY = { cell: 5, word: 10, puzzle: 20 } as const;
export const REVEAL_PENALTY = 15;
export const MAX_SECONDS = 3599;
export interface CrosswordSlot {
  number: number;
  row: number;
  col: number;
  dir: CrosswordDirection;
  length: number;
  cells: number[];
}
export function crosswordSlots(blocks: readonly number[]): CrosswordSlot[] {
  const black = new Set(blocks);
  const slots: CrosswordSlot[] = [];
  let number = 0;
  for (let cell = 0; cell < SIZE * SIZE; cell++) {
    if (black.has(cell)) continue;
    const row = Math.floor(cell / SIZE),
      col = cell % SIZE;
    const starts: Omit<CrosswordSlot, 'number'>[] = [];
    for (const dir of ['across', 'down'] as const) {
      if (dir === 'across' ? col > 0 && !black.has(cell - 1) : row > 0 && !black.has(cell - SIZE))
        continue;
      const cells: number[] = [];
      for (
        let i = cell;
        i < SIZE * SIZE && !black.has(i) && (dir === 'down' || Math.floor(i / SIZE) === row);
        i += dir === 'across' ? 1 : SIZE
      )
        cells.push(i);
      if (cells.length >= 3) starts.push({ row, col, dir, length: cells.length, cells });
    }
    if (starts.length) {
      number++;
      for (const start of starts) slots.push({ number, ...start });
    }
  }
  return slots;
}
export function formatCrosswordTime(seconds: number): string {
  const value = Math.max(0, Math.round(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
export interface CrosswordResult {
  seconds: number;
  penalty: number;
  checks: number;
  reveals: number;
  solution: string[];
}
export function crosswordShare(date: string, result: CrosswordResult): string {
  const help = [
    result.checks ? `${result.checks} check${result.checks === 1 ? '' : 's'}` : '',
    result.reveals ? `${result.reveals} reveal${result.reveals === 1 ? '' : 's'}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return `Mini Crossword · ${date}\n${formatCrosswordTime(result.seconds + result.penalty)}\n${help || 'Clean solve'}`;
}
