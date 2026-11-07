import type { Context } from '../context';
import type { RateLimit } from '../../../shared/types';
import type { Row } from './row';
import { HttpError } from '../http';
export const AUTH_EMAIL_LIMIT = 10;
export const AUTH_IP_LIMIT = 150;
export const TEAM_CODE_FAILURE_LIMIT = 20;
const ipAddress = (ctx: Context) => ctx.request.headers.get('CF-Connecting-IP') ?? 'local';
function check(ctx: Context, email: string, ip: string, limit: number) {
  const row = ctx.storage.sql
    .exec<Row<RateLimit>>('SELECT * FROM rate_limits WHERE email = ? AND ip = ?', email, ip)
    .toArray()[0];
  const remaining = row ? 900000 - (ctx.now.getTime() - Date.parse(row.window_start)) : 0;
  if (remaining > 0 && row.attempts >= limit)
    throw new HttpError(429, 'RATE_LIMITED', 'Too many attempts. Try again later.', {
      'Retry-After': String(Math.ceil(remaining / 1000)),
    });
  return { row, remaining };
}
function consume(ctx: Context, email: string, ip: string, limit: number) {
  const { row, remaining } = check(ctx, email, ip, limit);
  ctx.storage.sql.exec(
    'INSERT INTO rate_limits VALUES (?, ?, ?, ?) ON CONFLICT(email,ip) DO UPDATE SET window_start=excluded.window_start,attempts=excluded.attempts',
    email,
    ip,
    remaining > 0 ? row.window_start : ctx.now.toISOString(),
    remaining > 0 ? row.attempts + 1 : 1,
  );
}
export function attempt(ctx: Context, email: string) {
  ctx.storage.transactionSync(() => {
    consume(ctx, 'auth-email:' + email, '', AUTH_EMAIL_LIMIT);
    consume(ctx, 'auth-ip', ipAddress(ctx), AUTH_IP_LIMIT);
  });
}
export function clearAttempts(ctx: Context, email: string) {
  ctx.storage.sql.exec(
    'DELETE FROM rate_limits WHERE email = ? AND ip = ?',
    'auth-email:' + email,
    '',
  );
}
export function checkTeamCodeFailures(ctx: Context) {
  check(ctx, 'team-code-failures', ipAddress(ctx), TEAM_CODE_FAILURE_LIMIT);
}
export function recordTeamCodeFailure(ctx: Context) {
  consume(ctx, 'team-code-failures', ipAddress(ctx), TEAM_CODE_FAILURE_LIMIT);
}
