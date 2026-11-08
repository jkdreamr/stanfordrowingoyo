import { today } from '../../../shared/dates';
import { DIVE_PROMPTS_PER_DAY, diveVerdict, normalizeAnswer } from '../../../shared/games/dive';
import type { DiveDay } from '../../../shared/types';
import type { Context } from '../context';
import { refreshUser, requireStaff } from '../auth/guards';
import { audit } from '../db/audit';
import { diveAnswers, diveReveal, diveResult } from '../db/dive';
import { oyoGameAccess, requireGameAccess } from '../games/access';
import { divePromptsFor, diveSelectionFor } from '../games/divePrompts';
import { answerSet } from '../games/dive/sets';
import { matchAnswer } from '../games/dive/matcher';
import { HttpError, json, readJson } from '../http';
import * as v from '../validate';

function checkedDate(ctx: Context, value: unknown) {
  const date = v.date(value);
  if (date > today(ctx.now)) v.invalid('Date cannot be in the future.');
  return date;
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
    complete,
    score: result?.score ?? 0,
    verdict: diveVerdict(result?.score ?? 0),
    result,
    reveal: complete || past ? diveReveal(ctx.storage, date, user.id, staff) : null,
  };
}
export async function current(ctx: Context) {
  return json(await day(ctx, today(ctx.now)));
}
export async function past(ctx: Context) {
  const date = checkedDate(ctx, ctx.params.date);
  const result = await day(ctx, date);
  if (date === today(ctx.now) && !result.complete && ctx.user!.role === 'rower')
    throw new HttpError(403, 'PLAY_FIRST', 'Finish today’s Dive to see answers.');
  if (ctx.user!.role !== 'rower') result.reveal = diveReveal(ctx.storage, date, ctx.user!.id, true);
  return json(result);
}
export async function answer(ctx: Context) {
  refreshUser(ctx);
  const body = await readJson(ctx.request);
  const index = v.int(body.prompt_index, 'Prompt Index', 0, DIVE_PROMPTS_PER_DAY - 1);
  if (typeof body.answer !== 'string') v.invalid('Answer must be a string.');
  if (/\p{Cc}/u.test(body.answer)) v.invalid('Answer cannot contain control characters.');
  const value = v.string(body.answer, 'Answer', 0, 40, true);
  const date = today(ctx.now);
  requireGameAccess(ctx, refreshUser(ctx), date);
  const set = await answerSet(diveSelectionFor(date)[index].id);
  const matched = matchAnswer(value, set);
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
      user.id,
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
      user.id,
      matched.points,
      JSON.stringify({ answered: existing.length + 1 }),
      now,
      now,
    );
    return {
      ...diveAnswers(ctx.storage, date, user.id)[index],
      gem: set.gem,
      notable: set.notable,
    };
  });
  return json(result, 201);
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
