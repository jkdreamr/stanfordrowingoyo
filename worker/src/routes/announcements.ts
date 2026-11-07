import type { Context } from '../context';
import { refreshUser, requireStaff, requireUser } from '../auth/guards';
import { announcements, saveAnnouncement } from '../db/announcements';
import { notify } from '../db/notifications';
import { audit } from '../db/audit';
import { HttpError, json, noContent, readJson } from '../http';
import * as v from '../validate';
export function get(ctx: Context) {
  requireUser(ctx);
  if (ctx.params.id) {
    const row = announcements(ctx.storage, ctx.params.id)[0];
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Announcement not found.');
    return json(row);
  }
  return json(announcements(ctx.storage));
}
export async function create(ctx: Context) {
  const body = await readJson(ctx.request);
  refreshUser(ctx);
  const actor = requireStaff(ctx);
  const row = {
    id: crypto.randomUUID(),
    author_id: actor.id,
    title: v.string(body.title, 'Title', 1, 120, true),
    body: v.string(body.body, 'Body', 1, 5000),
    pinned: v.boolean(body.pinned, 'Pinned'),
    created_at: ctx.now.toISOString(),
  };
  ctx.storage.transactionSync(() => {
    saveAnnouncement(ctx.storage, row);
    for (const user of ctx.storage.sql
      .exec<{ id: string }>('SELECT id FROM users WHERE active = ?', 1)
      .toArray())
      notify(ctx.storage, user.id, actor.id, 'announcement', null, row.created_at, row.id);
    audit(ctx, 'announcement.create', row.id, null, row);
  });
  return json(
    announcements(ctx.storage).find((item) => item.id === row.id),
    201,
  );
}
export async function patch(ctx: Context) {
  const body = await readJson(ctx.request);
  refreshUser(ctx);
  requireStaff(ctx);
  const before = announcements(ctx.storage).find((row) => row.id === ctx.params.id);
  if (!before) throw new HttpError(404, 'NOT_FOUND', 'Announcement not found.');
  const row = {
    ...before,
    title: body.title === undefined ? before.title : v.string(body.title, 'Title', 1, 120, true),
    body: body.body === undefined ? before.body : v.string(body.body, 'Body', 1, 5000),
    pinned: body.pinned === undefined ? before.pinned : v.boolean(body.pinned, 'Pinned'),
  };
  ctx.storage.transactionSync(() => {
    saveAnnouncement(ctx.storage, row, true);
    audit(ctx, 'announcement.update', row.id, before, row);
  });
  return json(row);
}
export function remove(ctx: Context) {
  requireStaff(ctx);
  const before = announcements(ctx.storage).find((row) => row.id === ctx.params.id);
  if (!before) throw new HttpError(404, 'NOT_FOUND', 'Announcement not found.');
  ctx.storage.transactionSync(() => {
    ctx.storage.sql.exec('DELETE FROM announcements WHERE id = ?', before.id);
    audit(ctx, 'announcement.delete', before.id, before, null);
  });
  return noContent();
}
