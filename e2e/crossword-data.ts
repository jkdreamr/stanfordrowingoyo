import { readFile } from 'node:fs/promises';
import { addDays } from '../shared/dates';
import { crosswordSlots } from '../shared/games/crossword';

export async function crosswordData(project: string) {
  const projects = ['desktop-chrome', 'iphone-15', 'pixel-7'];
  const projectIndex = projects.indexOf(project);
  if (projectIndex < 0) throw new Error(`Unknown crossword project: ${project}`);
  let text: string;
  try {
    text = await readFile(new URL('../scripts/crossword/puzzles.json', import.meta.url), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    text = await readFile(
      new URL('../scripts/crossword/fixtures/sample.json', import.meta.url),
      'utf8',
    );
  }
  const source = JSON.parse(text) as { start: string; puzzles: { grid: string[] }[] };
  const offset = 28 + projectIndex * 7;
  const date = addDays(source.start, offset);
  const grid = source.puzzles[offset % source.puzzles.length].grid;
  const solution = [...grid.join('')].map((letter) => (letter === '#' ? '' : letter));
  const blocks = solution.flatMap((letter, i) => (letter ? [] : [i]));
  return { date, grid, solution, slots: crosswordSlots(blocks) };
}
