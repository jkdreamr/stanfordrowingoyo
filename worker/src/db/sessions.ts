import type { Session } from '../../../shared/types';
import type { Row } from './row';
import type { Context } from '../context';
import { sha256, token } from '../auth/crypto';
import { byId, type UserRow } from './users';
import { HttpError } from '../http';
export const DAY = 86400000;
export const sessionCookie = (value: string, age = 5184000) =>
  `oyo_session=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`;
export function sessionToken(request: Request) {
  return request.headers
    .get('Cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('oyo_session='))
    ?.slice(12);
}
export async function prepareSession() {
  const value = token();
  return { value, hash: await sha256(value) };
}
export function createSession(
  ctx: Context,
  userId: string,
  prepared: { value: string; hash: string },
  credentials: Pick<UserRow, 'password_hash' | 'password_salt'>,
) {
  const user = byId(ctx.storage, userId);
  if (!user?.active) throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in.');
  if (
    user.password_hash !== credentials.password_hash ||
    user.password_salt !== credentials.password_salt
  )
    throw new HttpError(409, 'CREDENTIALS_CHANGED', 'Credentials changed. Please try again.');
  ctx.storage.sql.exec(
    'INSERT INTO sessions VALUES (?, ?, ?, ?)',
    prepared.hash,
    userId,
    new Date(ctx.now.getTime() + 60 * DAY).toISOString(),
    ctx.now.toISOString(),
  );
  ctx.cookie = sessionCookie(prepared.value);
}
export function findSession(ctx: Context, hash: string) {
  return ctx.storage.sql
    .exec<Row<Session>>('SELECT * FROM sessions WHERE token_hash = ?', hash)
    .toArray()[0];
}
