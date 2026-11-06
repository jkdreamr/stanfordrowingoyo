import type { Context } from '../context';
import { HttpError, json, noContent, readJson } from '../http';
import * as v from '../validate';
import { constantTimeEqual, hashPassword, sha256, verifyPassword } from '../auth/crypto';
import { byEmail, byId, toUser } from '../db/users';
import { findRoster } from '../db/roster';
import { getSetting } from '../db/settings';
import { attempt, clearAttempts } from '../db/rateLimit';
import { createSession, sessionCookie, sessionToken } from '../db/sessions';
export async function signup(ctx: Context) {
  const body = await readJson(ctx.request);
  const email = v.email(body.email);
  const name = v.string(body.name, 'Name', 1, 80, true);
  const password = v.string(body.password, 'Password', 8, 200);
  if (body.team_code !== undefined) v.string(body.team_code, 'Team code', 0, 200);
  attempt(ctx, email);
  if (byEmail(ctx.storage, email))
    throw new HttpError(409, 'EMAIL_TAKEN', 'This email is already registered.');
  const roster = findRoster(ctx.storage, email);
  if (
    !roster &&
    !constantTimeEqual(
      typeof body.team_code === 'string' ? body.team_code : '',
      getSetting<string>(ctx.storage, 'team_code'),
    )
  )
    throw new HttpError(403, 'INVALID_TEAM_CODE', 'The team code is invalid.');
  const { hash, salt } = await hashPassword(password);
  // Hashing yields; recheck uniqueness before inserting.
  if (byEmail(ctx.storage, email))
    throw new HttpError(409, 'EMAIL_TAKEN', 'This email is already registered.');
  const id = crypto.randomUUID();
  const timestamp = ctx.now.toISOString();
  const role = roster?.role ?? 'rower';
  ctx.storage.sql.exec(
    'INSERT INTO users (id,email,name,password_hash,password_salt,role,group_key,side,class_year,on_leaderboard,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    id,
    email,
    name,
    hash,
    salt,
    role,
    roster?.group_key ?? 'normal',
    roster?.side ?? null,
    roster?.class_year ?? null,
    Number(role === 'rower' || role === 'admin'),
    timestamp,
    timestamp,
  );
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
