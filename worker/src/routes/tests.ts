import type { ErgTest } from '../../../shared/types';
import { today } from '../../../shared/dates';
import type { Context } from '../context';
import { refreshUser, requireUser } from '../auth/guards';
import { HttpError, json, noContent, readJson } from '../http';
import * as v from '../validate';
type Row = Omit<ErgTest, 'is_pr'>;
export function tests(storage: DurableObjectStorage, user: string): ErgTest[] {
  const best = new Map<string, number>();
  return storage.sql
    .exec<Row>('SELECT * FROM erg_tests WHERE user_id=? ORDER BY date,created_at,id', user)
    .toArray()
    .map((row) => {
      const is_pr = row.split_s < (best.get(row.kind) ?? Infinity);
      best.set(row.kind, Math.min(row.split_s, best.get(row.kind) ?? Infinity));
      return { ...row, is_pr };
    })
    .reverse();
}
export function recompute(ctx: Context, user: string) {
  ctx.storage.sql.exec(
    "UPDATE users SET best2k_split_s=(SELECT MIN(split_s) FROM erg_tests WHERE user_id=? AND kind='2k'),best6k_split_s=(SELECT MIN(split_s) FROM erg_tests WHERE user_id=? AND kind='6k'),updated_at=? WHERE id=?",
    user,
    user,
    ctx.now.toISOString(),
    user,
  );
}
export function insertTest(ctx: Context, user: string, body: Record<string, unknown>) {
  if (
    ctx.storage.sql
      .exec<{ n: number }>('SELECT COUNT(*) AS n FROM erg_tests WHERE user_id=?', user)
      .one().n >= 200
  )
    v.invalid('At most 200 tests per user.');
  const row = validated(body, undefined, ctx.now);
  const id = crypto.randomUUID();
  ctx.storage.sql.exec(
    'INSERT INTO erg_tests VALUES (?,?,?,?,?,?,?,?)',
    id,
    user,
    row.kind,
    row.date,
    row.time_s,
    row.split_s,
    ctx.now.toISOString(),
    ctx.now.toISOString(),
  );
  recompute(ctx, user);
  return id;
}
function validated(body: Record<string, unknown>, before: Row | undefined, now: Date) {
  const kind = v.enumeration(
    body.kind === undefined ? before?.kind : body.kind,
    ['2k', '6k'],
    'Kind',
  );
  const date = v.date(body.date === undefined ? before?.date : body.date);
  if (date < '2000-01-01' || date > today(now))
    v.invalid('Test date must be between 2000-01-01 and today.');
  const factor = kind === '2k' ? 4 : 12;
  if (body.time_s !== undefined && body.split_s !== undefined)
    v.invalid('Supply exactly one of time_s and split_s.');
  const time =
    body.split_s !== undefined
      ? v.number(body.split_s, 'Split', 60, 300) * factor
      : body.time_s !== undefined
        ? v.number(body.time_s, 'Time', 60 * factor, 300 * factor)
        : before
          ? before.time_s
          : v.invalid('Supply time_s or split_s.');
  const time_s = Math.round(time * 10) / 10;
  v.number(time_s / factor, 'Split', 60, 300);
  return { kind, date, time_s, split_s: Math.round((time_s / factor) * 10) / 10 };
}
export function list(ctx: Context) {
  requireUser(ctx);
  return json(tests(ctx.storage, ctx.params.id));
}
export async function create(ctx: Context) {
  const body = await readJson(ctx.request);
  const user = refreshUser(ctx);
  const id = ctx.storage.transactionSync(() => insertTest(ctx, user.id, body));
  return json(
    tests(ctx.storage, user.id).find((row) => row.id === id),
    201,
  );
}
export async function patch(ctx: Context) {
  const body = await readJson(ctx.request);
  const user = refreshUser(ctx);
  ctx.storage.transactionSync(() => {
    const before = owned(ctx, user.id);
    const row = validated(body, before, ctx.now);
    ctx.storage.sql.exec(
      'UPDATE erg_tests SET kind=?,date=?,time_s=?,split_s=?,updated_at=? WHERE id=?',
      row.kind,
      row.date,
      row.time_s,
      row.split_s,
      ctx.now.toISOString(),
      before.id,
    );
    recompute(ctx, user.id);
  });
  return json(tests(ctx.storage, user.id).find((row) => row.id === ctx.params.id));
}
function owned(ctx: Context, user: string) {
  const row = ctx.storage.sql
    .exec<Row>('SELECT * FROM erg_tests WHERE id=? AND user_id=?', ctx.params.id, user)
    .toArray()[0];
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Test not found.');
  return row;
}
export function remove(ctx: Context) {
  const user = refreshUser(ctx);
  ctx.storage.transactionSync(() => {
    owned(ctx, user.id);
    ctx.storage.sql.exec('DELETE FROM erg_tests WHERE id=?', ctx.params.id);
    recompute(ctx, user.id);
  });
  return noContent();
}
