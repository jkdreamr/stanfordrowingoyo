import type { IntroStatus } from '../../../shared/types';
import type { Context } from '../context';
import { requireUser } from '../auth/guards';
import { json } from '../http';

export function get(ctx: Context) {
  const user = requireUser(ctx);
  const row = ctx.storage.sql
    .exec<{ completed_at: string }>(
      'SELECT completed_at FROM user_intro WHERE user_id = ?',
      user.id,
    )
    .toArray()[0];
  return json({ completed_at: row?.completed_at ?? null } satisfies IntroStatus);
}

export function complete(ctx: Context) {
  const user = requireUser(ctx);
  ctx.storage.sql.exec(
    'INSERT INTO user_intro (user_id, completed_at) VALUES (?, ?) ON CONFLICT(user_id) DO NOTHING',
    user.id,
    ctx.now.toISOString(),
  );
  return get(ctx);
}
