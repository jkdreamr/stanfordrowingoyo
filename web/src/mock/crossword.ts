import type { CrosswordDay } from '../../../shared/types';
import {
  CHECK_PENALTY,
  REVEAL_PENALTY,
  crosswordSlots,
  type CrosswordScope,
} from '../../../shared/games/crossword';

const blocks = [0, 1, 2, 3, 4, 5, 9, 10, 14, 15, 19, 20, 21, 22, 23, 24];
const answer = ['CAT', 'ARE', 'TEN'];
const solution = Array.from({ length: 25 }, (_, i) =>
  blocks.includes(i) ? '' : answer[Math.floor(i / 5) - 1][(i % 5) - 1],
);
const slots = crosswordSlots(blocks);
const clues = slots.map((s) => ({
  ...s,
  text:
    (s.dir === 'across'
      ? { 1: 'A Whiskered Pet', 4: 'Plural Form Of “Is”', 5: 'Five Plus Five' }[s.number]
      : { 1: 'A Whiskered Pet', 2: 'Exist, With “You”', 3: 'Number Of Fingers' }[s.number]) ??
    'Mock Clue',
}));
type Access = CrosswordDay['access'];
type Saved = Pick<
  CrosswordDay,
  'started_at' | 'cells' | 'wrong' | 'revealed' | 'checks' | 'reveals' | 'penalty' | 'incorrect'
>;
export function mockCrossword() {
  const progress = new Map<string, Saved>();
  return ({
    user,
    date,
    access,
    action,
    body,
    now,
    finished,
    fail,
    finish,
  }: {
    user: string;
    date: string;
    access: Access;
    action: string;
    body: Record<string, unknown>;
    now: Date;
    finished: boolean;
    fail: (status: number, message: string, code?: string) => never;
    finish: (score: number, payload: unknown) => void;
  }): CrosswordDay => {
    const key = `${user}:${date}`;
    const state = structuredClone(
      progress.get(key) ?? {
        started_at: null,
        cells: Array<string>(25).fill(''),
        wrong: [],
        revealed: [],
        checks: 0,
        reveals: 0,
        penalty: 0,
        incorrect: false,
      },
    );
    let done = finished;
    const seconds = () =>
      state.started_at
        ? Math.min(
            3599,
            Math.max(1, Math.round((now.getTime() - Date.parse(state.started_at)) / 1000)),
          )
        : 0;
    if (action !== 'today') {
      if (body.date !== undefined && body.date !== date)
        fail(409, 'A New Day Has Started. Reload to Play.', 'DAY_CHANGED');
      if (!access.unlocked) fail(403, 'Log A Workout Today To Play.', 'GAME_LOCKED');
      if (done) fail(409, 'Already Played Today.', 'ALREADY_PLAYED');
      if (action === 'start') state.started_at ??= now.toISOString();
      else {
        if (!state.started_at) fail(409, 'Start The Crossword First.', 'NOT_STARTED');
        if (
          !Array.isArray(body.cells) ||
          body.cells.length !== 25 ||
          body.cells.some((c) => typeof c !== 'string' || !/^[A-Z]?$/.test(c))
        )
          fail(400, 'Expected 25 Letters Or Empty Cells.');
        const cells = body.cells as string[];
        if (blocks.some((i) => cells[i])) fail(400, 'Black Cells Must Be Empty.');
        const changed = cells.map((c, i) => (state.revealed.includes(i) ? state.cells[i] : c));
        if (changed.some((c, i) => c !== state.cells[i])) state.incorrect = false;
        state.wrong = state.wrong.filter((i) => changed[i] === state.cells[i]);
        state.cells = changed;
        if (action === 'check' || action === 'reveal') {
          const cell = body.cell as number,
            scope = body.scope as CrosswordScope;
          const slot = slots.find((s) => s.dir === body.dir && s.cells.includes(cell));
          if (!slot || !['cell', 'word', 'puzzle'].includes(scope))
            fail(400, 'Invalid Help Scope.');
          const indices =
            scope === 'cell'
              ? [cell]
              : scope === 'word'
                ? slot!.cells
                : solution.flatMap((c, i) => (c ? [i] : []));
          if (action === 'check') {
            state.checks++;
            state.penalty += CHECK_PENALTY[scope];
            state.wrong = [
              ...new Set([
                ...state.wrong.filter((i) => !indices.includes(i)),
                ...indices.filter((i) => state.cells[i] && state.cells[i] !== solution[i]),
              ]),
            ];
          } else {
            const newly = indices.filter(
              (i) => state.cells[i] !== solution[i] && !state.revealed.includes(i),
            );
            state.penalty += newly.length * REVEAL_PENALTY;
            state.reveals += newly.length;
            for (const i of newly) {
              state.cells[i] = solution[i];
              state.revealed.push(i);
            }
            state.wrong = state.wrong.filter((i) => !newly.includes(i));
          }
        }
        if (action === 'finish' || action === 'reveal') {
          done = state.cells.every((c, i) => c === solution[i]);
          state.incorrect =
            action === 'finish' && !done && state.cells.every((c, i) => blocks.includes(i) || !!c);
          if (done)
            finish(seconds() + state.penalty, {
              seconds: seconds(),
              penalty: state.penalty,
              checks: state.checks,
              reveals: state.reveals,
              solution,
            });
        }
      }
      progress.set(key, state);
    }
    const visible = access.unlocked && !!state.started_at;
    return {
      date,
      access,
      available: true,
      ...state,
      started: !!state.started_at,
      server_now: now.toISOString(),
      elapsed: seconds(),
      blocks: access.unlocked ? blocks : [],
      clues: visible ? clues.map(({ cells: _cells, ...clue }) => clue) : [],
      cells: visible ? state.cells : Array<string>(25).fill(''),
      wrong: visible ? state.wrong : [],
      revealed: visible ? state.revealed : [],
      finished: done,
      solution: done && access.unlocked ? solution : null,
    };
  };
}
