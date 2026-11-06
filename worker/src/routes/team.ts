import type { Context } from '../context';
import { requireUser } from '../auth/guards';
import { byId, toPublicUser, type UserRow } from '../db/users';
import { currentSeason, seasonStats } from '../db/stats';
import { HttpError, json } from '../http';
export function list(ctx: Context) {
  requireUser(ctx);
  return json(
    ctx.storage.sql
      .exec<UserRow>('SELECT * FROM users WHERE active = ? ORDER BY name,id', 1)
      .toArray()
      .map(toPublicUser),
  );
}
export function profile(ctx: Context) {
  const viewer = requireUser(ctx);
  const user = byId(ctx.storage, ctx.params.id);
  if (!user || !user.active) throw new HttpError(404, 'NOT_FOUND', 'User not found.');
  return json({
    user: toPublicUser(user),
    stats: seasonStats(ctx.storage, user, currentSeason(ctx.storage, ctx.now), ctx.now, viewer.id),
  });
}
