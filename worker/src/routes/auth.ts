import type { Context } from '../context';
import { HttpError, json, noContent, readJson } from '../http';
import * as v from '../validate';
import { constantTimeEqual, sha256 } from '../auth/crypto';
import { byEmail, byId, toUser } from '../db/users';
import { findRoster, rosterById } from '../db/roster';
import type { RosterRow } from '../../../shared/types';
import { getSetting } from '../db/settings';
import { attempt, clearAttempts, attemptDiscovery, clearDiscovery } from '../db/rateLimit';
import { createSession, prepareSession, sessionCookie, sessionToken } from '../db/sessions';
import { isValidTeamCode } from '../../../shared/teamCode';
function checkTeamCode(ctx: Context, value: unknown) {
  const code = typeof value === 'string' ? value.trim() : '';
  const matches = constantTimeEqual(
    code.toLowerCase(),
    getSetting<string>(ctx.storage, 'team_code').trim().toLowerCase(),
  );
  if (!isValidTeamCode(code) || !matches)
    throw new HttpError(403, 'INVALID_TEAM_CODE', 'The team code is invalid.');
}
export async function roster(ctx: Context) {
  attemptDiscovery(ctx);
  const body = await readJson(ctx.request);
  checkTeamCode(ctx, body.team_code);
  const choices = ctx.storage.sql
    .exec(
      'SELECT id,name,role FROM roster WHERE claimed_by_user_id IS NULL AND email IS NULL ORDER BY name COLLATE NOCASE,id',
    )
    .toArray();
  clearDiscovery(ctx);
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
export async function signupPrecheck(ctx: Context) {
  const body = await readJson(ctx.request);
  const email = v.email(body.email);
  attempt(ctx, email);
  reusableUser(ctx, email);
  signupRow(ctx, email, body);
  return noContent();
}
export async function signup(ctx: Context) {
  const body = await readJson(ctx.request);
  const email = v.email(body.email);
  const hash = v.string(body.password_hash, 'Password hash', 1, 200);
  const salt = v.string(body.password_salt, 'Password salt', 1, 200);
  const prepared = await prepareSession();
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
    clearAttempts(ctx, email);
    createSession(ctx, id, prepared, { password_hash: hash, password_salt: salt });
    return id;
  });
  return json(toUser(byId(ctx.storage, id)), 201);
}
export async function loginChallenge(ctx: Context) {
  const body = await readJson(ctx.request);
  const email = v.email(body.email);
  attempt(ctx, email);
  const user = byEmail(ctx.storage, email);
  return json({
    user_id: user?.id ?? null,
    password_hash: user?.password_hash ?? null,
    password_salt: user?.password_salt ?? null,
  });
}
export async function login(ctx: Context) {
  const body = await readJson(ctx.request);
  const email = v.email(body.email);
  const user = {
    id: body.user_id,
    password_hash: v.string(body.password_hash, 'Password hash', 1, 200),
    password_salt: v.string(body.password_salt, 'Password salt', 1, 200),
  };
  const upgrade =
    body.upgraded_password_hash === undefined
      ? undefined
      : {
          hash: v.string(body.upgraded_password_hash, 'Password hash', 1, 200),
          salt: v.string(body.upgraded_password_salt, 'Password salt', 1, 200),
        };
  const prepared = await prepareSession();
  return ctx.storage.transactionSync(() => {
    const current = byEmail(ctx.storage, email);
    if (!current || !current.active)
      throw new HttpError(403, 'ACCOUNT_INACTIVE', 'This account is inactive.');
    if (current.id !== user.id)
      throw new HttpError(409, 'CREDENTIALS_CHANGED', 'Credentials changed. Please try again.');
    createSession(ctx, current.id, prepared, user);
    if (upgrade)
      ctx.storage.sql.exec(
        'UPDATE users SET password_hash=?,password_salt=?,updated_at=? WHERE id=?',
        upgrade.hash,
        upgrade.salt,
        ctx.now.toISOString(),
        current.id,
      );
    clearAttempts(ctx, email);
    return json(toUser(byId(ctx.storage, current.id)));
  });
}
export async function logout(ctx: Context) {
  const value = sessionToken(ctx.request);
  if (value) ctx.storage.sql.exec('DELETE FROM sessions WHERE token_hash = ?', await sha256(value));
  ctx.cookie = sessionCookie('', 0);
  return noContent();
}
