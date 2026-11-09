import type { TeamChallenge, TeamChallengeInput } from '../../../shared/types';
import { addDays, today } from '../../../shared/dates';
import { floorPercent } from '../../../shared/math';
import type { Context } from '../context';
import { refreshUser, requireStaff, requireUser } from '../auth/guards';
import { audit } from '../db/audit';
import { HttpError, json, noContent, readJson } from '../http';
import * as v from '../validate';
type Row = Omit<TeamChallenge, 'status' | 'progress_m' | 'percent'>;
const memos = new WeakMap<
  DurableObjectStorage,
  Map<string, { key: string; value: TeamChallenge }>
>();
function status(row: Row, day: string): TeamChallenge['status'] {
  return row.ended_at || row.end_date < day
    ? 'ended'
    : row.start_date > day
      ? 'upcoming'
      : 'active';
}
function present(ctx: Context, row: Row): TeamChallenge {
  const version = ctx.storage.sql
    .exec<{ any_version: number }>('SELECT any_version FROM stats_counters WHERE id=1')
    .one().any_version;
  const day = today(ctx.now);
  const key = JSON.stringify([row, version, day]);
  let memo = memos.get(ctx.storage);
  if (!memo) {
    memo = new Map();
    memos.set(ctx.storage, memo);
  }
  const cached = memo.get(row.id);
  if (cached?.key === key) return cached.value;
  const progress_m = ctx.storage.sql
    .exec<{ n: number }>(
      `SELECT COALESCE(SUM(${row.unit === 'emeters' ? 'equiv_m' : 'distance_m'}),0) AS n FROM entries WHERE date>=? AND date<=?${row.modality ? ' AND modality=?' : ''}`,
      row.start_date,
      row.end_date,
      ...(row.modality ? [row.modality] : []),
    )
    .one().n;
  const value = {
    ...row,
    status: status(row, day),
    progress_m,
    percent: floorPercent((progress_m * 100) / row.goal_m, 1),
  };
  memo.set(row.id, { key, value });
  return value;
}
function rows(ctx: Context) {
  return ctx.storage.sql
    .exec<Row>('SELECT * FROM challenges ORDER BY created_at DESC,id DESC')
    .toArray();
}
function find(ctx: Context) {
  const row = ctx.storage.sql
    .exec<Row>('SELECT * FROM challenges WHERE id=?', ctx.params.id)
    .toArray()[0];
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Challenge not found.');
  return row;
}
function validate(body: Record<string, unknown>): TeamChallengeInput {
  const start_date = v.date(body.start_date),
    end_date = v.date(body.end_date);
  if (end_date < start_date || end_date > addDays(start_date, 366))
    v.invalid('Challenge dates must be ordered and span at most 366 days.');
  return {
    title: v.string(body.title, 'Title', 1, 60, true),
    unit: v.enumeration(body.unit, ['emeters', 'km'], 'Unit'),
    goal_m: v.int(body.goal_m, 'Goal', 1, 1000000000),
    modality: v.nullable(body.modality, (value) =>
      v.enumeration(value, ['erg', 'bike', 'run'], 'Modality'),
    ),
    start_date,
    end_date,
  };
}
export function list(ctx: Context) {
  requireUser(ctx);
  return json(
    rows(ctx)
      .filter((row) => status(row, today(ctx.now)) !== 'ended')
      .sort((a, b) => a.end_date.localeCompare(b.end_date))
      .map((row) => present(ctx, row)),
  );
}
export function adminList(ctx: Context) {
  requireStaff(ctx);
  return json(rows(ctx).map((row) => present(ctx, row)));
}
export async function create(ctx: Context) {
  const body = await readJson(ctx.request);
  refreshUser(ctx);
  const actor = requireStaff(ctx);
  const row: Row = {
    ...validate(body),
    id: crypto.randomUUID(),
    created_by: actor.id,
    created_at: ctx.now.toISOString(),
    updated_at: ctx.now.toISOString(),
    ended_at: null,
  };
  ctx.storage.transactionSync(() => {
    ctx.storage.sql.exec(
      'INSERT INTO challenges VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      row.id,
      row.title,
      row.unit,
      row.goal_m,
      row.modality,
      row.start_date,
      row.end_date,
      row.created_by,
      row.created_at,
      row.updated_at,
      row.ended_at,
    );
    audit(ctx, 'challenge.create', row.id, null, row);
  });
  return json(present(ctx, row), 201);
}
export async function patch(ctx: Context) {
  const body = await readJson(ctx.request);
  refreshUser(ctx);
  requireStaff(ctx);
  const before = find(ctx);
  if (status(before, today(ctx.now)) === 'ended')
    throw new HttpError(409, 'CONFLICT', 'Ended challenges cannot be edited.');
  const row = { ...before, ...validate({ ...before, ...body }), updated_at: ctx.now.toISOString() };
  ctx.storage.transactionSync(() => {
    ctx.storage.sql.exec(
      'UPDATE challenges SET title=?,unit=?,goal_m=?,modality=?,start_date=?,end_date=?,updated_at=? WHERE id=?',
      row.title,
      row.unit,
      row.goal_m,
      row.modality,
      row.start_date,
      row.end_date,
      row.updated_at,
      row.id,
    );
    audit(ctx, 'challenge.update', row.id, before, row);
  });
  return json(present(ctx, row));
}
export function end(ctx: Context) {
  refreshUser(ctx);
  requireStaff(ctx);
  const before = find(ctx);
  const row = {
    ...before,
    ended_at: before.ended_at ?? ctx.now.toISOString(),
    updated_at: before.ended_at ? before.updated_at : ctx.now.toISOString(),
  };
  ctx.storage.transactionSync(() => {
    ctx.storage.sql.exec(
      'UPDATE challenges SET ended_at=?,updated_at=? WHERE id=?',
      row.ended_at,
      row.updated_at,
      row.id,
    );
    audit(ctx, 'challenge.end', row.id, before, row);
  });
  return json(present(ctx, row));
}
export function remove(ctx: Context) {
  refreshUser(ctx);
  requireStaff(ctx);
  const before = find(ctx);
  ctx.storage.transactionSync(() => {
    ctx.storage.sql.exec('DELETE FROM challenges WHERE id=?', before.id);
    audit(ctx, 'challenge.delete', before.id, before, null);
  });
  memos.get(ctx.storage)?.delete(before.id);
  return noContent();
}
