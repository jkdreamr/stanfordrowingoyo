import type { Context } from '../context';
import { HttpError } from '../http';
import { byId } from '../db/users';
import { DAY, findSession, sessionCookie, sessionToken } from '../db/sessions';
import { sha256 } from './crypto';
export async function authenticate(ctx: Context) {
  const value = sessionToken(ctx.request);
  if (!value) return;
  const hash = await sha256(value);
  const session = findSession(ctx, hash);
  if (!session) return;
  const user = byId(ctx.storage, session.user_id);
  if (Date.parse(session.expires_at) <= ctx.now.getTime() || !user?.active) {
    ctx.storage.sql.exec('DELETE FROM sessions WHERE token_hash = ?', hash);
    return;
  }
  ctx.user = user;
  ctx.tokenHash = hash;
  if (Date.parse(session.expires_at) - ctx.now.getTime() < 59 * DAY) {
    ctx.storage.sql.exec(
      'UPDATE sessions SET expires_at = ? WHERE token_hash = ?',
      new Date(ctx.now.getTime() + 60 * DAY).toISOString(),
      hash,
    );
    ctx.cookie = sessionCookie(value);
  }
}
export function requireUser(ctx: Context) {
  if (!ctx.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in.');
  return ctx.user;
}
export function requireStaff(ctx: Context) {
  const user = requireUser(ctx);
  if (!['coxswain', 'coach', 'admin'].includes(user.role))
    throw new HttpError(403, 'FORBIDDEN', 'Staff access is required.');
  return user;
}
export function requireAdmin(ctx: Context) {
  const user = requireStaff(ctx);
  if (user.role !== 'admin') throw new HttpError(403, 'FORBIDDEN', 'Admin access is required.');
  return user;
}
