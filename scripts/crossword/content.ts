import { createHash } from 'node:crypto';
import { crosswordSlots } from '../../shared/games/crossword';

export interface Content {
  start: string;
  puzzles: { grid: string[]; across: Record<string, string>; down: Record<string, string> }[];
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const letters = (text: string) => text.toUpperCase().replace(/[^A-Z]/g, '');

export function dictionary(text: string): Set<string> {
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  if (!lines.length || lines.some((line) => !/^[a-z]+$/.test(line)))
    throw new Error('Dictionary must contain one lowercase word per line');
  return new Set(lines.map((word) => word.toUpperCase()));
}

export function clueErrors(clue: unknown, answer: string): string[] {
  if (typeof clue !== 'string') return ['clue must be a string'];
  const errors: string[] = [];
  if (clue !== clue.trim() || clue.length < 3 || clue.length > 80)
    errors.push('clue must be trimmed and 3–80 characters');
  if (!/^(?:[A-Z0-9"']|___)/.test(clue)) errors.push('invalid clue opening');
  if (/\.$/.test(clue) && !/(?:etc|[A-Z])\.$/.test(clue)) errors.push('trailing clue period');
  if (/ {2}/.test(clue)) errors.push('double spaces in clue');
  if (/[“”‘’]/.test(clue)) errors.push('clue must use straight quotes');
  if ([...clue.matchAll(/_+/g)].some((match) => match[0] !== '___'))
    errors.push('clue blanks must be exactly ___');
  const normalized = letters(clue);
  if (normalized.includes(answer)) errors.push('clue contains its answer');
  for (const ending of ['S', 'ED', 'ES', 'ING']) {
    if (!answer.endsWith(ending)) continue;
    const stem = answer.slice(0, -ending.length);
    if (stem.length >= 4 && normalized.includes(stem)) {
      errors.push('clue contains its answer stem');
      break;
    }
  }
  return errors;
}

export function validateContent(source: unknown, words: ReadonlySet<string>, real = false) {
  const errors: string[] = [];
  let pluralWarnings = 0;
  if (!record(source) || source.start !== '2026-11-16' || !Array.isArray(source.puzzles))
    return { errors: ['Expected start 2026-11-16 and a puzzles array'], pluralWarnings };
  if (!source.puzzles.length || (real && source.puzzles.length < 365))
    errors.push(real ? 'Real bank must contain at least 365 puzzles' : 'Fixture must not be empty');
  const grids = new Set<string>();
  const uses = new Map<string, { days: number[]; clues: Set<string> }>();
  for (const [day, puzzle] of source.puzzles.entries()) {
    const prefix = `Day ${day + 1}`;
    const fail = (message: string) => errors.push(`${prefix}: ${message}`);
    if (
      !record(puzzle) ||
      !Array.isArray(puzzle.grid) ||
      puzzle.grid.length !== 5 ||
      puzzle.grid.some((row) => typeof row !== 'string' || !/^[A-Z#]{5}$/.test(row))
    ) {
      fail('grid must be 5 rows × 5 of [A-Z#]');
      continue;
    }
    const grid = puzzle.grid.join('');
    if (grids.has(grid)) fail('identical grid reused');
    grids.add(grid);
    const blocks = [...grid].flatMap((letter, i) => (letter === '#' ? [i] : []));
    if (blocks.some((i) => grid[24 - i] !== '#'))
      fail('black squares must be rotationally symmetric');
    const white = [...grid].flatMap((letter, i) => (letter === '#' ? [] : [i]));
    if (!white.length) fail('grid must have white cells');
    const visited = new Set<number>();
    const pending = white.length ? [white[0]] : [];
    while (pending.length) {
      const cell = pending.pop()!;
      if (visited.has(cell)) continue;
      visited.add(cell);
      for (const next of [
        cell - 5,
        cell + 5,
        ...(cell % 5 > 0 ? [cell - 1] : []),
        ...(cell % 5 < 4 ? [cell + 1] : []),
      ])
        if (next >= 0 && next < 25 && grid[next] !== '#' && !visited.has(next)) pending.push(next);
    }
    if (visited.size !== white.length) fail('white cells must be fully connected');
    for (const cell of white) {
      for (const dir of ['across', 'down'] as const) {
        const step = dir === 'across' ? 1 : 5;
        const start =
          dir === 'across'
            ? cell % 5 === 0 || grid[cell - 1] === '#'
            : cell < 5 || grid[cell - 5] === '#';
        if (!start) continue;
        let length = 0;
        for (
          let i = cell;
          i < 25 &&
          grid[i] !== '#' &&
          (dir === 'down' || Math.floor(i / 5) === Math.floor(cell / 5));
          i += step
        )
          length++;
        if (length < 3) fail(`${dir} run at cell ${cell} is shorter than 3`);
      }
    }
    const slots = crosswordSlots(blocks);
    if (
      white.some(
        (cell) =>
          !['across', 'down'].every((dir) =>
            slots.some((slot) => slot.dir === dir && slot.cells.includes(cell)),
          ),
      )
    )
      fail('every white cell must belong to across and down entries');
    for (const dir of ['across', 'down'] as const) {
      const clues = puzzle[dir];
      const expected = slots
        .filter((slot) => slot.dir === dir)
        .map((slot) => String(slot.number))
        .sort();
      if (!record(clues) || JSON.stringify(Object.keys(clues).sort()) !== JSON.stringify(expected))
        fail(`${dir} clue keys do not match numbering`);
    }
    const entries = slots.map((slot) => ({
      slot,
      answer: slot.cells.map((i) => grid[i]).join(''),
    }));
    for (const [index, { slot, answer }] of entries.entries()) {
      const label = `${answer} (${slot.number} ${slot.dir})`;
      if (!words.has(answer)) fail(`${label} missing from dictionary`);
      for (const other of entries.slice(0, index)) {
        if (answer === other.answer) fail(`duplicate entry ${answer}`);
        else if (
          Math.abs(answer.length - other.answer.length) <= 2 &&
          (answer.startsWith(other.answer) || other.answer.startsWith(answer))
        )
          fail(`prefix-related entries ${answer}/${other.answer}`);
      }
      const clues = puzzle[slot.dir];
      const clue = record(clues) ? clues[String(slot.number)] : undefined;
      for (const error of clueErrors(clue, answer)) fail(`${label}: ${error}`);
      if (typeof clue !== 'string') continue;
      if (
        answer.endsWith('S') &&
        !/\b(?:[a-z]{2,}s|men|women|children|people|feet|teeth|mice|geese)\b/i.test(clue)
      )
        pluralWarnings++;
      const use = uses.get(answer) ?? { days: [], clues: new Set<string>() };
      if (use.days.some((previous) => day - previous < 14))
        fail(`${answer} repeats within 14 consecutive days`);
      if (use.clues.has(clue)) fail(`${answer} repeats exact clue text`);
      use.days.push(day);
      use.clues.add(clue);
      uses.set(answer, use);
    }
  }
  for (const [answer, use] of uses) {
    const limit = answer.length === 3 ? 5 : answer.length === 4 ? 4 : 3;
    if (use.days.length > limit)
      errors.push(`${answer} used ${use.days.length} times; limit ${limit}`);
  }
  return { errors, pluralWarnings };
}

export function frozenHash(source: Content, through: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(through) ||
    !Number.isFinite(Date.parse(through)) ||
    new Date(through).toISOString().slice(0, 10) !== through
  )
    throw new Error('Invalid frozen through date');
  const count = Math.max(
    0,
    Math.floor((Date.parse(through) - Date.parse(source.start)) / 86400000) + 1,
  );
  return createHash('sha256')
    .update(JSON.stringify(source.puzzles.slice(0, count)))
    .digest('hex');
}
