import {
  crosswordSlots,
  type CrosswordDirection,
  type CrosswordSlot,
} from '../../../../shared/games/crossword';

export function orderedSlots(blocks: number[]) {
  return crosswordSlots(blocks).sort((a, b) =>
    a.dir === b.dir ? a.number - b.number : a.dir === 'across' ? -1 : 1,
  );
}
export function activeSlot(slots: CrosswordSlot[], cell: number, dir: CrosswordDirection) {
  return slots.find((s) => s.dir === dir && s.cells.includes(cell));
}
export function nextClue(
  slots: CrosswordSlot[],
  current: CrosswordSlot,
  step: number,
  cells?: string[],
  locked: number[] = [],
) {
  const index = slots.indexOf(current);
  for (let n = 1; n <= slots.length; n++) {
    const slot = slots[(index + step * n + slots.length * 2) % slots.length];
    const cell = slot.cells.find((i) => !locked.includes(i) && (!cells || !cells[i]));
    if (cell !== undefined) return { cell, dir: slot.dir };
  }
  return { cell: current.cells[0], dir: current.dir };
}
