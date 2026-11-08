import { today } from '../../../shared/dates';
import { normalizeAnswer } from '../../../shared/games/dive';
import type { DiveDay } from '../../../shared/types';
import type { Context } from '../context';
import { refreshUser, requireStaff } from '../auth/guards';
import { audit } from '../db/audit';
import { diveAnswers, diveReveal, recomputeDive } from '../db/dive';
import { oyoGameAccess, requireGameAccess } from '../games/access';
import { divePromptsFor } from '../games/divePrompts';
import { HttpError, json, readJson } from '../http';
import * as v from '../validate';

function checkedDate(ctx: Context, value: unknown) {
  const date = v.date(value);
  if (date > today(ctx.now)) v.invalid('Date cannot be in the future.');
  return date;
}
function day(ctx: Context, date: string): DiveDay {
  const user = refreshUser(ctx);
  const access = oyoGameAccess(ctx.storage, user, date);
  const answers = diveAnswers(ctx.storage, date, user.id);
  const complete = answers.length === 7;
  const staff = user.role !== 'rower';
  const past = date < today(ctx.now);
  return {
    date,
    access,
    prompts: access.unlocked || past ? divePromptsFor(date) : [],
    answers,
    complete,
    score:
      ctx.storage.sql
        .exec<{ score: number }>(
          "SELECT score FROM game_results WHERE game_id='dive' AND date=? AND user_id=?",
          date,
          user.id,
        )
        .toArray()[0]?.score ?? 0,
    reveal: complete || staff || past ? diveReveal(ctx.storage, date, user.id, staff) : null,
  };
}
export function current(ctx: Context) {
  return json(day(ctx, today(ctx.now)));
}
export function past(ctx: Context) {
  const date = checkedDate(ctx, ctx.params.date);
  const result = day(ctx, date);
  if (date === today(ctx.now) && !result.complete && ctx.user!.role === 'rower')
    throw new HttpError(403, 'PLAY_FIRST', 'Finish today’s Dive to see answers.');
  return json(result);
}
export async function answer(ctx: Context) {
  refreshUser(ctx);
  const body = await readJson(ctx.request);
  const index = v.int(body.prompt_index, 'Prompt Index', 0, 6);
  if (typeof body.answer !== 'string') v.invalid('Answer must be a string.');
  if (/\p{Cc}/u.test(body.answer)) v.invalid('Answer cannot contain control characters.');
  const value = v.string(body.answer, 'Answer', 0, 40, true);
  const result = ctx.storage.transactionSync(() => {
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
    const now = ctx.now.toISOString();
    const normalized = normalizeAnswer(value);
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
      'INSERT INTO dive_answers VALUES (?,?,?,?,?,?,?,?)',
      date,
      user.id,
      index,
      value,
      normalized,
      hidden?.hidden_at ?? null,
      hidden?.hidden_by ?? null,
      now,
    );
    ctx.storage.sql.exec(
      "INSERT INTO game_results VALUES ('dive',?,?,0,'{}',?,?) ON CONFLICT(game_id,date,user_id) DO NOTHING",
      date,
      user.id,
      now,
      now,
    );
    recomputeDive(ctx.storage, date, now);
    return diveAnswers(ctx.storage, date, user.id)[index];
  });
  return json(result, 201);
}
export async function moderate(ctx: Context) {
  refreshUser(ctx);
  requireStaff(ctx);
  const body = await readJson(ctx.request);
  const date = checkedDate(ctx, body.date);
  const index = v.int(body.prompt_index, 'Prompt Index', 0, 6);
  const normalized = v.string(body.normalized, 'Normalized Answer', 1, 120);
  if (!/^[a-z0-9]+(?: [a-z0-9]+)*$/.test(normalized)) v.invalid('Normalized Answer is invalid.');
  const hidden = v.boolean(body.hidden, 'Hidden');
  return json(
    ctx.storage.transactionSync(() => {
      const user = refreshUser(ctx);
      requireStaff(ctx);
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
      recomputeDive(ctx.storage, date, now);
      audit(ctx, hidden ? 'dive.hide' : 'dive.unhide', `${date}:${index}:${normalized}`, before, {
        hidden,
      });
      return diveReveal(ctx.storage, date, user.id, true)[index];
    }),
  );
}
