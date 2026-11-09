import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { clueErrors, dictionary, frozenHash, validateContent, type Content } from './content';

const FROZEN_THROUGH = '2026-11-15';
const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');
const fixture = JSON.parse(await read('./fixtures/sample.json')) as Content;
const words = dictionary(await read('./fixtures/words.txt'));
let real: Content | undefined;
try {
  real = JSON.parse(await read('./puzzles.json')) as Content;
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

async function validate(source: Content, words: Set<string>, real: boolean) {
  const label = real ? 'Real bank' : 'Fixture';
  const result = validateContent(source, words, real);
  console.log(
    `${label}: ${source.puzzles.length} puzzles; ${result.pluralWarnings} plural-agreement warnings`,
  );
  expect(result.errors, result.errors.join('\n')).toEqual([]);
}
it('preserves the frozen scheduled content', async () => {
  const frozen = JSON.parse(await read('./frozen.json')) as { through: string; sha256: string };
  expect(frozen.through).toBe(FROZEN_THROUGH);
  expect(frozen.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(frozenHash(real ?? fixture, FROZEN_THROUGH)).toBe(frozen.sha256);
});
it('validates fixture content', () => validate(fixture, words, false));
it.skipIf(!real)('validates real yearly content', async () => {
  await validate(real!, dictionary(await read('./words.txt')), true);
});
it.each([null, [], {}, { start: '2026-11-16', puzzles: [] }])(
  'rejects empty content %j',
  (source) => {
    expect(validateContent(source, words).errors.length).toBeGreaterThan(0);
  },
);

it.each([
  [
    'start',
    (source: Content) => {
      source.start = '2026-11-17';
    },
    'Expected start',
  ],
  [
    'shape',
    (source: Content) => {
      source.puzzles[0].grid[0] = 'abc';
    },
    'grid must be',
  ],
  [
    'symmetry',
    (source: Content) => {
      source.puzzles[0].grid[0] = 'AAAAA';
    },
    'rotationally symmetric',
  ],
  [
    'short runs',
    (source: Content) => {
      source.puzzles[0].grid = ['AAAAA', 'AA#AA', 'AAAAA', 'AA#AA', 'AAAAA'];
    },
    'shorter than 3',
  ],
  [
    'connectivity',
    (source: Content) => {
      source.puzzles[0].grid = ['AAA##', 'AAA##', '#####', '##AAA', '##AAA'];
    },
    'fully connected',
  ],
  [
    'numbering',
    (source: Content) => {
      source.puzzles[0].across['99'] = 'Extra clue';
    },
    'clue keys',
  ],
  [
    'duplicate grids',
    (source: Content) => {
      source.puzzles.push(structuredClone(source.puzzles[0]));
    },
    'identical grid',
  ],
] as const)('rejects invalid %s', (_name, mutate, message) => {
  const source = structuredClone(fixture);
  mutate(source);
  expect(validateContent(source, words).errors.join('\n')).toContain(message);
});
it('requires a full real bank and its dictionary entries', () => {
  expect(validateContent(fixture, words, true).errors).toContain(
    'Real bank must contain at least 365 puzzles',
  );
  expect(validateContent(fixture, new Set()).errors.join('\n')).toContain(
    'missing from dictionary',
  );
  expect(() => dictionary('UPPER\n')).toThrow('lowercase');
  expect(() => dictionary('')).toThrow('one lowercase word');
  expect(() => dictionary('valid\n\nword\n')).toThrow('one lowercase word');
  expect(dictionary('valid\r\nword\r\n')).toEqual(new Set(['VALID', 'WORD']));
});
it.each([
  [' bad clue', 'HEART', 'trimmed'],
  ['A', 'HEART', '3–80'],
  ['A'.repeat(81), 'HEART', '3–80'],
  ['lowercase clue', 'HEART', 'opening'],
  ['Some clue.', 'HEART', 'period'],
  ['Two  spaces', 'HEART', 'double spaces'],
  ['A “quoted” clue', 'HEART', 'straight quotes'],
  ['A person’s item', 'HEART', 'straight quotes'],
  ['Fill __ here', 'HEART', 'exactly ___'],
  ['Fill ____ here', 'HEART', 'exactly ___'],
  ['A h-e-a-r-t example', 'HEART', 'contains its answer'],
  ['Love hearts', 'HEART', 'contains its answer'],
  ['A craft example', 'CRAFTS', 'answer stem'],
  ['Where one plant grows', 'PLANTED', 'answer stem'],
  ['Many shape options', 'SHAPES', 'answer stem'],
  ['To begin a paint job', 'PAINTING', 'answer stem'],
] as const)('rejects clue %s', (clue, answer, error) =>
  expect(clueErrors(clue, answer).join(';')).toContain(error),
);
it.each([
  'A normal clue',
  '3 of a kind',
  '"Quoted" example',
  "'Quoted' example",
  '___ example',
  'Items, etc.',
  'In the U.S.',
])('accepts clue %s', (clue) => expect(clueErrors(clue, 'HEART')).toEqual([]));
it('enforces duplicate entries and prefix relationships within a grid', () => {
  const source = structuredClone(fixture);
  source.puzzles[0].grid = ['#ABC#', 'ACDEF', 'BEFGH', 'CGHIJ', '#KLM#'];
  expect(validateContent(source, words).errors.join('\n')).toContain('duplicate entry ABC');
  source.puzzles[0].grid = ['#ABC#', 'XBCDE', 'YCFGH', 'ZDGHI', '#EJK#'];
  expect(validateContent(source, words).errors.join('\n')).toContain('prefix-related entries');
});
it('enforces reuse caps, a rolling 14-day window and per-answer clue uniqueness', () => {
  const source = structuredClone(fixture);
  source.puzzles = Array.from({ length: 16 }, () => structuredClone(fixture.puzzles[0]));
  const errors = validateContent(source, words).errors.join('\n');
  expect(errors).toContain('repeats within 14 consecutive days');
  expect(errors).toContain('repeats exact clue text');
  expect(errors).toContain('limit 5');
  expect(errors).toContain('limit 3');
  source.puzzles.forEach((puzzle) => {
    puzzle.grid = ['ABCD#', 'EFGHI', 'JKLMN', 'OPQRS', '#TUVW'];
  });
  expect(validateContent(source, words).errors.join('\n')).toContain('limit 4');
});
it('allows an answer again on day 15, but not day 14', () => {
  const source = structuredClone(fixture);
  source.puzzles = [
    structuredClone(fixture.puzzles[0]),
    ...Array.from({ length: 13 }, () => structuredClone(fixture.puzzles[1])),
    structuredClone(fixture.puzzles[0]),
  ];
  expect(validateContent(source, words).errors.join('\n')).not.toContain('ACE repeats within 14');
  source.puzzles.splice(1, 1);
  expect(validateContent(source, words).errors.join('\n')).toContain('ACE repeats within 14');
});
it('reports plural heuristics without failing validation', () => {
  const source = structuredClone(fixture);
  source.puzzles[0].down['1'] = 'Protective shield';
  const result = validateContent(source, words);
  expect(result.errors).toEqual([]);
  expect(result.pluralWarnings).toBe(1);
});
it('hashes an inclusive played prefix, permits future edits, and rejects frozen edits', () => {
  expect(frozenHash(fixture, FROZEN_THROUGH)).toBe(createHash('sha256').update('[]').digest('hex'));
  const hash = frozenHash(fixture, '2026-11-16');
  const source = structuredClone(fixture);
  source.puzzles[1].across['1'] = 'Changed future clue';
  expect(frozenHash(source, '2026-11-16')).toBe(hash);
  source.puzzles[0].across['1'] = 'Changed frozen clue';
  expect(frozenHash(source, '2026-11-16')).not.toBe(hash);
  expect(() => frozenHash(source, '2026-02-30')).toThrow('Invalid frozen');
});
