import type { Context } from '../context';
import { requireUser } from '../auth/guards';
import { markRead, notifications } from '../db/notifications';
import { json, noContent, readJson } from '../http';
import { invalid, string } from '../validate';
export function get(ctx: Context) {
  return json(notifications(ctx.storage, requireUser(ctx).id));
}
export async function read(ctx: Context) {
  const user = requireUser(ctx);
  const body = await readJson(ctx.request);
  if (!Array.isArray(body.ids) || body.ids.length > 200)
    invalid('IDs must be an array of at most 200 notification IDs.');
  const ids = (body.ids as unknown[]).map((id) => string(id, 'Notification ID', 1, 200));
  markRead(ctx.storage, user.id, ids, ctx.now.toISOString());
  return noContent();
}
