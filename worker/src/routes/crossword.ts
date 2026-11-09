import { today } from '../../../shared/dates';
import {
  CHECK_PENALTY,
  MAX_SECONDS,
  REVEAL_PENALTY,
  type CrosswordResult,
} from '../../../shared/games/crossword';
import type { CrosswordDay } from '../../../shared/types';
import { refreshUser } from '../auth/guards';
import type { Context } from '../context';
import { finish, progress, saveProgress, storedResult } from '../db/gameProgress';
import { oyoGameAccess, requireGameAccess } from '../games/access';
import { crosswordFor, loadCrossword, type CrosswordPuzzle } from '../games/crossword/puzzles';
import { CROSSWORD_DATA } from '../games/crossword/data';
import { HttpError, json, readJson } from '../http';
import * as v from '../validate';

interface State {
  started_at: string | null;
  cells: string[];
  wrong: number[];
  revealed: number[];
  checks: number;
  reveals: number;
  penalty: number;
  incorrect: boolean;
}
const initial = (): State => ({
  started_at: null,
  cells: Array<string>(25).fill(''),
  wrong: [],
  revealed: [],
  checks: 0,
  reveals: 0,
  penalty: 0,
  incorrect: false,
});
function elapsed(ctx: Context, state: State) {
  return state.started_at
    ? Math.min(
        MAX_SECONDS,
        Math.max(0, Math.round((ctx.now.getTime() - Date.parse(state.started_at)) / 1000)),
      )
    : 0;
}
function view(ctx: Context, puzzle: CrosswordPuzzle | null): CrosswordDay {
  const user = refreshUser(ctx),
    date = today(ctx.now);
  const access = oyoGameAccess(ctx.storage, user, date);
  const state = progress(ctx, user.id, 'crossword', date, initial());
  const result = storedResult(ctx, user.id, 'crossword', date) as CrosswordResult | null;
  const visible = access.unlocked && Boolean(state.started_at);
  return {
    date,
    access,
    available: Boolean(puzzle),
    available_from: CROSSWORD_DATA.start,
    ...state,
    started: Boolean(state.started_at),
    server_now: ctx.now.toISOString(),
    elapsed: result?.seconds ?? elapsed(ctx, state),
    blocks: access.unlocked ? (puzzle?.blocks ?? []) : [],
    clues: visible ? (puzzle?.clues ?? []).map(({ cells: _cells, ...clue }) => clue) : [],
    cells: visible ? state.cells : initial().cells,
    wrong: visible ? state.wrong : [],
    revealed: visible ? state.revealed : [],
    finished: Boolean(result),
    incorrect: state.incorrect ?? false,
    solution: result && access.unlocked ? result.solution : null,
  };
}
export async function current(ctx: Context) {
  refreshUser(ctx);
  return json(view(ctx, crosswordFor(await loadCrossword(ctx.env), today(ctx.now))));
}
type Action = 'start' | 'progress' | 'check' | 'reveal' | 'finish';
async function write(ctx: Context, action: Action) {
  refreshUser(ctx);
  const body = await readJson(ctx.request);
  const puzzles = await loadCrossword(ctx.env);
  return json(
    ctx.storage.transactionSync(() => {
      const user = refreshUser(ctx),
        date = today(ctx.now);
      if (body.date !== undefined && v.date(body.date) !== date)
        throw new HttpError(409, 'DAY_CHANGED', 'A New Day Has Started. Reload to Play.');
      requireGameAccess(ctx, user, date);
      if (storedResult(ctx, user.id, 'crossword', date))
        throw new HttpError(409, 'ALREADY_PLAYED', 'Already played today.');
      const puzzle = crosswordFor(puzzles, date);
      if (!puzzle) throw new HttpError(409, 'NOT_AVAILABLE', 'No crossword available yet.');
      const state = progress(ctx, user.id, 'crossword', date, initial());
      const allowed =
        action === 'start'
          ? ['date']
          : action === 'check' || action === 'reveal'
            ? ['date', 'cells', 'scope', 'cell', 'dir']
            : ['date', 'cells'];
      if (Object.keys(body).some((key) => !allowed.includes(key))) v.invalid('Unexpected field.');
      if (action === 'start') state.started_at ??= ctx.now.toISOString();
      else {
        if (!state.started_at)
          throw new HttpError(409, 'NOT_STARTED', 'Start the crossword first.');
        if (
          !Array.isArray(body.cells) ||
          body.cells.length !== 25 ||
          body.cells.some((c) => typeof c !== 'string' || !/^[A-Z]?$/.test(c))
        )
          v.invalid('Expected 25 uppercase letters or empty cells.');
        const cells = body.cells as string[];
        if (puzzle.blocks.some((i) => cells[i] !== '')) v.invalid('Black cells must be empty.');
        const changed = cells.map((c, i) => (state.revealed.includes(i) ? state.cells[i] : c));
        if (changed.some((c, i) => c !== state.cells[i])) state.incorrect = false;
        state.wrong = state.wrong.filter((i) => changed[i] === state.cells[i]);
        state.cells = changed;
        if (action === 'check' || action === 'reveal') {
          if (
            !['cell', 'word', 'puzzle'].includes(body.scope as string) ||
            !Number.isInteger(body.cell) ||
            (body.cell as number) < 0 ||
            (body.cell as number) > 24 ||
            puzzle.blocks.includes(body.cell as number) ||
            !['across', 'down'].includes(body.dir as string)
          )
            v.invalid('Invalid help scope.');
          const cell = body.cell as number;
          const slot = puzzle.clues.find((s) => s.dir === body.dir && s.cells.includes(cell));
          if (!slot) v.invalid('No word at that cell.');
          const scope = body.scope as keyof typeof CHECK_PENALTY;
          const indices =
            scope === 'cell'
              ? [cell]
              : scope === 'word'
                ? slot.cells
                : puzzle.solution.flatMap((c, i) => (c ? [i] : []));
          if (action === 'check') {
            state.checks++;
            state.penalty += CHECK_PENALTY[scope];
            state.wrong = [
              ...new Set([
                ...state.wrong.filter((i) => !indices.includes(i)),
                ...indices.filter((i) => state.cells[i] && state.cells[i] !== puzzle.solution[i]),
              ]),
            ].sort((a, b) => a - b);
          } else {
            const newly = indices.filter(
              (i) => state.cells[i] !== puzzle.solution[i] && !state.revealed.includes(i),
            );
            state.reveals += newly.length;
            state.penalty += newly.length * REVEAL_PENALTY;
            for (const i of newly) {
              state.cells[i] = puzzle.solution[i];
              state.revealed.push(i);
            }
            state.revealed.sort((a, b) => a - b);
            state.wrong = state.wrong.filter((i) => !newly.includes(i));
          }
        }
        if (action === 'finish' || action === 'reveal') {
          const correct = state.cells.every((c, i) => c === puzzle.solution[i]);
          state.incorrect =
            action === 'finish' &&
            !correct &&
            state.cells.every((c, i) => puzzle.blocks.includes(i) || c !== '');
          if (correct) {
            const seconds = Math.max(1, elapsed(ctx, state));
            finish(ctx, user.id, 'crossword', date, seconds + state.penalty, {
              seconds,
              penalty: state.penalty,
              checks: state.checks,
              reveals: state.reveals,
              solution: puzzle.solution,
            });
          }
        }
      }
      saveProgress(ctx, user.id, 'crossword', date, state);
      return view(ctx, puzzle);
    }),
  );
}
export const start = (ctx: Context) => write(ctx, 'start');
export const save = (ctx: Context) => write(ctx, 'progress');
export const check = (ctx: Context) => write(ctx, 'check');
export const reveal = (ctx: Context) => write(ctx, 'reveal');
export const complete = (ctx: Context) => write(ctx, 'finish');
