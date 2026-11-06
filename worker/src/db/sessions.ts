import type { Session } from '../../../shared/types';
import type { Row } from './row';
import type { Context } from '../context';
import { sha256, token } from '../auth/crypto';
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
export async function createSession(ctx: Context, userId: string) {
  const value = token();
  ctx.storage.sql.exec(
    'INSERT INTO sessions VALUES (?, ?, ?, ?)',
    await sha256(value),
    userId,
    new Date(ctx.now.getTime() + 60 * DAY).toISOString(),
    ctx.now.toISOString(),
  );
  ctx.cookie = sessionCookie(value);
}
export function findSession(ctx: Context, hash: string) {
  return ctx.storage.sql
    .exec<Row<Session>>('SELECT * FROM sessions WHERE token_hash = ?', hash)
    .toArray()[0];
}
