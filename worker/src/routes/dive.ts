import { today } from '../../../shared/dates';
import {
  DIVE_PROMPTS_PER_DAY,
  DIVE_PROMPT_MS,
  DIVE_GRACE_MS,
  DIVE_MAX_WRONG_GUESSES,
  DIVE_GUESS_INTERVAL_MS,
  diveVerdict,
  normalizeAnswer,
} from '../../../shared/games/dive';
import type {
  DiveDay,
  DiveAttemptExport,
  DiveGuessResponse,
  DivePending,
} from '../../../shared/types';
import type { Context } from '../context';
import { refreshUser, requireStaff } from '../auth/guards';
import { audit } from '../db/audit';
import { diveAnswers, diveReveal, diveResult } from '../db/dive';
import type { Row } from '../db/row';
import { oyoGameAccess, requireGameAccess, requireGameFinished } from '../games/access';
import { divePromptsFor, diveSelectionFor } from '../games/divePrompts';
import { answerSet } from '../games/dive/sets';
import { matchAnswer, suggestAnswer, type AnswerSet, type DiveMatch } from '../games/dive/matcher';
import { HttpError, json, readJson } from '../http';
import * as v from '../validate';

function checkedDate(ctx: Context, value: unknown) {
  const date = v.date(value);
  if (date > today(ctx.now)) v.invalid('Date cannot be in the future.');
  return date;
}
const miss: DiveMatch = { canonical: null, tier: 'miss', points: 0 };
function attempt(ctx: Context, date: string, userId: string, index: number) {
  return ctx.storage.sql
    .exec<Row<DiveAttemptExport>>(
      'SELECT * FROM dive_attempts WHERE date=? AND user_id=? AND prompt_index=?',
      date,
      userId,
      index,
    )
    .toArray()[0];
}
function expired(ctx: Context, row: DiveAttemptExport) {
  return ctx.now.getTime() > Date.parse(row.started_at) + DIVE_PROMPT_MS + DIVE_GRACE_MS;
}
function pending(ctx: Context, row: DiveAttemptExport): DivePending {
  return {
    prompt_index: row.prompt_index,
    deadline_ms_remaining: Math.max(
      0,
      Date.parse(row.started_at) + DIVE_PROMPT_MS - ctx.now.getTime(),
    ),
    suggestion:
      row.suggestion_status === 'pending' && !expired(ctx, row) ? row.suggestion_canonical : null,
    attempts_left: Math.max(0, DIVE_MAX_WRONG_GUESSES - row.wrong_count),
  };
}
function active(ctx: Context, index: number) {
  const user = refreshUser(ctx),
    date = today(ctx.now);
  requireGameAccess(ctx, user, date);
  const existing = ctx.storage.sql
    .exec<{ prompt_index: number }>(
      'SELECT prompt_index FROM dive_answers WHERE date=? AND user_id=?',
      date,
      user.id,
    )
    .toArray();
  if (existing.some((row) => row.prompt_index === index))
    throw new HttpError(409, 'ALREADY_ANSWERED', 'Already answered this prompt.');
  if (existing.length !== index)
    throw new HttpError(409, 'OUT_OF_ORDER', 'Answer the next prompt.');
  return { user, date };
}
function checkedIndex(body: Record<string, unknown>) {
  return v.int(body.prompt_index, 'Prompt Index', 0, DIVE_PROMPTS_PER_DAY - 1);
}
function checkedAnswer(body: Record<string, unknown>) {
  if (typeof body.answer !== 'string') v.invalid('Answer must be a string.');
  if (/\p{Cc}/u.test(body.answer)) v.invalid('Answer cannot contain control characters.');
  return v.string(body.answer, 'Answer', 0, 40, true);
}
async function day(ctx: Context, date: string): Promise<DiveDay> {
  const user = refreshUser(ctx);
  const access = oyoGameAccess(ctx.storage, user, date);
  const stored = diveAnswers(ctx.storage, date, user.id);
  const selection = diveSelectionFor(date);
  const answers = await Promise.all(
    stored.map(async (answer) => {
      const set = await answerSet(selection[answer.prompt_index].id);
      return { ...answer, gem: set.gem, notable: set.notable };
    }),
  );
  const complete = answers.length === DIVE_PROMPTS_PER_DAY;
  const staff = user.role !== 'rower';
  const past = date < today(ctx.now);
  const result = diveResult(ctx.storage, date, user.id);
  return {
    date,
    access,
    prompts: access.unlocked || past ? divePromptsFor(date) : [],
    answers,
    pending:
      !past && !complete && access.unlocked
        ? (() => {
            const row = attempt(ctx, date, user.id, answers.length);
            return row ? pending(ctx, row) : null;
          })()
        : null,
    complete,
    score: result?.score ?? 0,
    verdict: diveVerdict(result?.score ?? 0),
    result,
    reveal:
      complete || user.role === 'admin' ? diveReveal(ctx.storage, date, user.id, staff) : null,
  };
}
export async function current(ctx: Context) {
  return json(await day(ctx, today(ctx.now)));
}
export async function past(ctx: Context) {
  const user = refreshUser(ctx);
  const date = checkedDate(ctx, ctx.params.date);
  requireGameFinished(ctx, user, 'dive', date);
  return json(await day(ctx, date));
}

function storeAnswer(
  ctx: Context,
  index: number,
  value: string,
  matched: DiveMatch,
  set: AnswerSet,
  userId: string,
  date: string,
) {
  const now = ctx.now.toISOString();
  const normalized = normalizeAnswer(matched.canonical ?? value);
  // A moderated group stays hidden when a later teammate submits the same answer.
  const hidden = ctx.storage.sql
    .exec<{ hidden_at: string; hidden_by: string | null }>(
      'SELECT hidden_at,hidden_by FROM dive_answers WHERE date=? AND prompt_index=? AND normalized=? AND hidden_at IS NOT NULL LIMIT 1',
      date,
      index,
      normalized,
    )
    .toArray()[0];
  ctx.storage.sql.exec(
    'INSERT INTO dive_answers (date,user_id,prompt_index,answer,normalized,canonical,tier,points,hidden_at,hidden_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    date,
    userId,
    index,
    value,
    normalized,
    matched.canonical,
    matched.tier,
    matched.points,
    hidden?.hidden_at ?? null,
    hidden?.hidden_by ?? null,
    now,
  );
  ctx.storage.sql.exec(
    "INSERT INTO game_results VALUES ('dive',?,?,?,?,?,?) ON CONFLICT(game_id,date,user_id) DO UPDATE SET score=game_results.score+excluded.score,payload_json=excluded.payload_json,updated_at=excluded.updated_at",
    date,
    userId,
    matched.points,
    JSON.stringify({ answered: index + 1 }),
    now,
    now,
  );
  return {
    ...diveAnswers(ctx.storage, date, userId)[index],
    gem: set.gem,
    notable: set.notable,
  };
}
export async function start(ctx: Context) {
  refreshUser(ctx);
  const index = checkedIndex(await readJson(ctx.request));
  return json(
    ctx.storage.transactionSync(() => {
      const { user, date } = active(ctx, index);
      ctx.storage.sql.exec(
        'INSERT INTO dive_attempts (date,user_id,prompt_index,started_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING',
        date,
        user.id,
        index,
        ctx.now.toISOString(),
      );
      const state = pending(ctx, attempt(ctx, date, user.id, index)!);
      return { prompt_index: index, deadline_ms_remaining: state.deadline_ms_remaining };
    }),
  );
}
export async function answer(ctx: Context) {
  refreshUser(ctx);
  const body = await readJson(ctx.request),
    index = checkedIndex(body),
    value = checkedAnswer(body);
  const { date } = active(ctx, index);
  const set = await answerSet(diveSelectionFor(date)[index].id);
  const result = ctx.storage.transactionSync(() => {
    const { user, date } = active(ctx, index);
    const row = attempt(ctx, date, user.id, index);
    const timeout = row && expired(ctx, row);
    return storeAnswer(
      ctx,
      index,
      timeout ? '' : value,
      timeout ? miss : matchAnswer(value, set),
      set,
      user.id,
      date,
    );
  });
  return json(result, 201);
}
function wrong(
  ctx: Context,
  index: number,
  row: DiveAttemptExport,
  set: AnswerSet,
): DiveGuessResponse {
  row.wrong_count++;
  ctx.storage.sql.exec(
    'UPDATE dive_attempts SET wrong_count=? WHERE date=? AND user_id=? AND prompt_index=?',
    row.wrong_count,
    row.date,
    row.user_id,
    index,
  );
  if (row.wrong_count >= DIVE_MAX_WRONG_GUESSES)
    return {
      outcome: 'scored',
      answer: storeAnswer(ctx, index, '', miss, set, row.user_id, row.date),
    };
  return { outcome: 'not_an_answer', attempts_left: DIVE_MAX_WRONG_GUESSES - row.wrong_count };
}
export async function guess(ctx: Context) {
  refreshUser(ctx);
  const body = await readJson(ctx.request),
    index = checkedIndex(body),
    value = checkedAnswer(body);
  const { date } = active(ctx, index);
  const set = await answerSet(diveSelectionFor(date)[index].id);
  const result = ctx.storage.transactionSync((): DiveGuessResponse => {
    const { user, date } = active(ctx, index);
    const row = attempt(ctx, date, user.id, index);
    if (!row) throw new HttpError(409, 'NOT_STARTED', 'Start this prompt first.');
    if (expired(ctx, row) || !value)
      return { outcome: 'scored', answer: storeAnswer(ctx, index, '', miss, set, user.id, date) };
    if (
      row.last_guess_at &&
      ctx.now.getTime() - Date.parse(row.last_guess_at) < DIVE_GUESS_INTERVAL_MS
    )
      throw new HttpError(429, 'TOO_FAST', 'Wait 400 ms between guesses.', { 'Retry-After': '1' });
    ctx.storage.sql.exec(
      'UPDATE dive_attempts SET last_guess_at=? WHERE date=? AND user_id=? AND prompt_index=?',
      ctx.now.toISOString(),
      date,
      user.id,
      index,
    );
    if (row.suggestion_status === 'pending') {
      ctx.storage.sql.exec(
        "UPDATE dive_attempts SET suggestion_status='rejected' WHERE date=? AND user_id=? AND prompt_index=?",
        date,
        user.id,
        index,
      );
      row.suggestion_status = 'rejected';
      const rejected = wrong(ctx, index, row, set);
      if (rejected.outcome === 'scored') return rejected;
    }
    const matched = matchAnswer(value, set);
    if (matched.canonical)
      return {
        outcome: 'scored',
        answer: storeAnswer(ctx, index, value, matched, set, user.id, date),
      };
    if (!row.suggestion_status) {
      const candidate = suggestAnswer(value, set);
      if (candidate?.canonical) {
        ctx.storage.sql.exec(
          "UPDATE dive_attempts SET suggestion_canonical=?,suggestion_answer=?,suggestion_status='pending',suggested_at=? WHERE date=? AND user_id=? AND prompt_index=?",
          candidate.canonical,
          value,
          ctx.now.toISOString(),
          date,
          user.id,
          index,
        );
        return { outcome: 'suggestion', ...pending(ctx, row), suggestion: candidate.canonical };
      }
    }
    return wrong(ctx, index, row, set);
  });
  return json(result);
}
export async function suggestion(ctx: Context) {
  refreshUser(ctx);
  const body = await readJson(ctx.request),
    index = checkedIndex(body),
    accept = v.boolean(body.accept, 'Accept');
  const { date } = active(ctx, index);
  const set = await answerSet(diveSelectionFor(date)[index].id);
  return json(
    ctx.storage.transactionSync((): DiveGuessResponse => {
      const { user, date } = active(ctx, index);
      const row = attempt(ctx, date, user.id, index);
      if (row && expired(ctx, row))
        return { outcome: 'scored', answer: storeAnswer(ctx, index, '', miss, set, user.id, date) };
      if (!row || row.suggestion_status !== 'pending' || !row.suggestion_canonical)
        throw new HttpError(409, 'NO_SUGGESTION', 'No pending suggestion.');
      ctx.storage.sql.exec(
        'UPDATE dive_attempts SET suggestion_status=? WHERE date=? AND user_id=? AND prompt_index=?',
        accept ? 'accepted' : 'rejected',
        date,
        user.id,
        index,
      );
      if (!accept) return wrong(ctx, index, row, set);
      const matched = matchAnswer(row.suggestion_canonical, set);
      return {
        outcome: 'scored',
        answer: storeAnswer(ctx, index, row.suggestion_answer!, matched, set, user.id, date),
      };
    }),
  );
}
export async function moderate(ctx: Context) {
  refreshUser(ctx);
  requireStaff(ctx);
  const body = await readJson(ctx.request);
  const date = checkedDate(ctx, body.date);
  const index = v.int(body.prompt_index, 'Prompt Index', 0, DIVE_PROMPTS_PER_DAY - 1);
  const normalized = v.string(body.normalized, 'Normalized Answer', 1, 120);
  if (!/^[a-z0-9]+(?: [a-z0-9]+)*$/.test(normalized)) v.invalid('Normalized Answer is invalid.');
  const hidden = v.boolean(body.hidden, 'Hidden');
  return json(
    ctx.storage.transactionSync(() => {
      const user = refreshUser(ctx);
      requireStaff(ctx);
      requireGameFinished(ctx, user, 'dive', date);
      if (date !== today(ctx.now)) requireGameFinished(ctx, user, 'dive', today(ctx.now));
      requireGameAccess(ctx, user, date);
      const before = ctx.storage.sql
        .exec<{ hidden_at: string | null; hidden_by: string | null }>(
          'SELECT hidden_at,hidden_by FROM dive_answers WHERE date=? AND prompt_index=? AND normalized=?',
          date,
          index,
          normalized,
        )
        .toArray();
      if (!before.length) throw new HttpError(404, 'NOT_FOUND', 'Answer group not found.');
      const now = ctx.now.toISOString();
      ctx.storage.sql.exec(
        'UPDATE dive_answers SET hidden_at=?,hidden_by=? WHERE date=? AND prompt_index=? AND normalized=?',
        hidden ? now : null,
        hidden ? user.id : null,
        date,
        index,
        normalized,
      );
      audit(ctx, hidden ? 'dive.hide' : 'dive.unhide', `${date}:${index}:${normalized}`, before, {
        hidden,
      });
      return diveReveal(ctx.storage, date, user.id, true)[index];
    }),
  );
}
