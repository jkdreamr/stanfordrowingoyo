import type { Context } from '../context';
import type { RateLimit } from '../../../shared/types';
import type { Row } from './row';
import { HttpError } from '../http';
export function attempt(ctx: Context, email: string) {
  const ip = ctx.request.headers.get('CF-Connecting-IP') ?? 'local';
  const row = ctx.storage.sql
    .exec<Row<RateLimit>>('SELECT * FROM rate_limits WHERE email = ? AND ip = ?', email, ip)
    .toArray()[0];
  const remaining = row ? 900000 - (ctx.now.getTime() - Date.parse(row.window_start)) : 0;
  if (remaining > 0 && row.attempts >= 10)
    throw new HttpError(429, 'RATE_LIMITED', 'Too many attempts. Try again later.', {
      'Retry-After': String(Math.ceil(remaining / 1000)),
    });
  ctx.storage.sql.exec(
    'INSERT INTO rate_limits VALUES (?, ?, ?, ?) ON CONFLICT(email,ip) DO UPDATE SET window_start=excluded.window_start,attempts=excluded.attempts',
    email,
    ip,
    remaining > 0 ? row.window_start : ctx.now.toISOString(),
    remaining > 0 ? row.attempts + 1 : 1,
  );
}
export function clearAttempts(ctx: Context, email: string) {
  ctx.storage.sql.exec(
    'DELETE FROM rate_limits WHERE email = ? AND ip = ?',
    email,
    ctx.request.headers.get('CF-Connecting-IP') ?? 'local',
  );
}
