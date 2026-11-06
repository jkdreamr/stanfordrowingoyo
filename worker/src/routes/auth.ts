import type { Context } from '../context';
import { HttpError, json, noContent, readJson } from '../http';
import * as v from '../validate';
import { constantTimeEqual, hashPassword, sha256, verifyPassword } from '../auth/crypto';
import { byEmail, byId, toUser } from '../db/users';
import { findRoster, rosterById } from '../db/roster';
import type { RosterRow } from '../../../shared/types';
import { getSetting } from '../db/settings';
import { attempt, clearAttempts } from '../db/rateLimit';
import { createSession, sessionCookie, sessionToken } from '../db/sessions';
function checkTeamCode(ctx: Context, value: unknown) {
  if (
    !constantTimeEqual(
      typeof value === 'string' ? value : '',
      getSetting<string>(ctx.storage, 'team_code'),
    )
  )
    throw new HttpError(403, 'INVALID_TEAM_CODE', 'The team code is invalid.');
}
export async function roster(ctx: Context) {
  attempt(ctx, 'roster-discovery');
  const body = await readJson(ctx.request);
  checkTeamCode(ctx, body.team_code);
  const choices = ctx.storage.sql
    .exec(
      'SELECT id,name,role FROM roster WHERE claimed_by_user_id IS NULL AND email IS NULL ORDER BY name COLLATE NOCASE,id',
    )
    .toArray();
  clearAttempts(ctx, 'roster-discovery');
  return json(choices);
}
function signupRow(ctx: Context, email: string, body: Record<string, unknown>): RosterRow {
  const bound = findRoster(ctx.storage, email);
  if (bound) {
    if (body.roster_id !== undefined && body.roster_id !== bound.id)
      v.invalid('Roster selection does not match this email.');
    return bound;
  }
  checkTeamCode(ctx, body.team_code);
  const id = v.string(body.roster_id, 'Roster ID', 1, 200);
  const row = rosterById(ctx.storage, id);
  if (!row || row.email !== null) throw new HttpError(404, 'NOT_FOUND', 'Roster row not found.');
  return row;
}
function reusableUser(ctx: Context, email: string) {
  const existing = byEmail(ctx.storage, email);
  if (
    existing &&
    (existing.active ||
      ctx.storage.sql
        .exec('SELECT id FROM roster WHERE claimed_by_user_id = ?', existing.id)
        .toArray().length)
  )
    throw new HttpError(409, 'EMAIL_TAKEN', 'This email is already registered.');
  return existing;
}
export async function signup(ctx: Context) {
  const body = await readJson(ctx.request);
  const email = v.email(body.email);
  const password = v.string(body.password, 'Password', 8, 200);
  attempt(ctx, email);
  reusableUser(ctx, email);
  signupRow(ctx, email, body);
  const { hash, salt } = await hashPassword(password);
  const timestamp = ctx.now.toISOString();
  const id = ctx.storage.transactionSync(() => {
    const existing = reusableUser(ctx, email);
    const row = signupRow(ctx, email, body);
    const group =
      row.role === 'rower'
        ? v.enumeration(
            body.group_key ?? row.group_key ?? 'normal',
            ['frosh', 'normal', 'u23'],
            'Group',
          )
        : (row.group_key ?? 'normal');
    const id = existing?.id ?? crypto.randomUUID();
    const claimed = ctx.storage.sql.exec(
      'UPDATE roster SET claimed_by_user_id = ? WHERE id = ? AND claimed_by_user_id IS NULL',
      id,
      row.id,
    ).rowsWritten;
    if (!claimed)
      throw new HttpError(409, 'ROSTER_CLAIMED', 'This roster row has already been claimed.');
    if (existing) {
      ctx.storage.sql.exec(
        'UPDATE users SET name=?,password_hash=?,password_salt=?,role=?,group_key=?,side=?,class_year=?,on_leaderboard=?,active=1,must_change_password=0,updated_at=? WHERE id=?',
        row.name,
        hash,
        salt,
        row.role,
        group,
        row.side,
        row.class_year,
        Number(row.role === 'rower'),
        timestamp,
        id,
      );
      ctx.storage.sql.exec('DELETE FROM sessions WHERE user_id = ?', id);
    } else
      ctx.storage.sql.exec(
        'INSERT INTO users (id,email,name,password_hash,password_salt,role,group_key,side,class_year,on_leaderboard,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        id,
        email,
        row.name,
        hash,
        salt,
        row.role,
        group,
        row.side,
        row.class_year,
        Number(row.role === 'rower'),
        timestamp,
        timestamp,
      );
    return id;
  });
  clearAttempts(ctx, email);
  await createSession(ctx, id);
  return json(toUser(byId(ctx.storage, id)), 201);
}
export async function login(ctx: Context) {
  const body = await readJson(ctx.request);
  const email = v.email(body.email);
  const password = v.string(body.password, 'Password', 8, 200);
  attempt(ctx, email);
  const user = byEmail(ctx.storage, email);
  const valid = user
    ? await verifyPassword(password, user.password_hash, user.password_salt)
    : (await hashPassword(password, 'AAAAAAAAAAAAAAAAAAAAAA=='), false);
  if (!user || !valid)
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  if (!user.active) throw new HttpError(403, 'ACCOUNT_INACTIVE', 'This account is inactive.');
  clearAttempts(ctx, email);
  await createSession(ctx, user.id);
  return json(toUser(user));
}
export async function logout(ctx: Context) {
  const value = sessionToken(ctx.request);
  if (value) ctx.storage.sql.exec('DELETE FROM sessions WHERE token_hash = ?', await sha256(value));
  ctx.cookie = sessionCookie('', 0);
  return noContent();
}
