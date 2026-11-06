import type { Context } from '../context';
import { refreshUser, requireUser } from '../auth/guards';
import { visibleEntry } from '../db/entries';
import * as db from '../db/social';
import { byId, toPublicUser } from '../db/users';
import { audit } from '../db/audit';
import { HttpError, json, noContent, readJson } from '../http';
import { string } from '../validate';
export function kudos(ctx: Context) {
  const user = requireUser(ctx);
  const entry = visibleEntry(ctx.storage, ctx.params.id, user.id);
  if (ctx.request.method === 'POST')
    db.addKudos(ctx.storage, entry.id, entry.user_id, user.id, ctx.now.toISOString());
  else db.removeKudos(ctx.storage, entry.id, user.id);
  return noContent();
}
export function comments(ctx: Context) {
  const user = requireUser(ctx);
  const entry = visibleEntry(ctx.storage, ctx.params.id, user.id);
  return json(db.comments(ctx.storage, entry.id));
}
export async function comment(ctx: Context) {
  const body = await readJson(ctx.request);
  const user = refreshUser(ctx);
  const entry = visibleEntry(ctx.storage, ctx.params.id, user.id);
  const comment = {
    id: crypto.randomUUID(),
    entry_id: entry.id,
    user_id: user.id,
    body: string(body.body, 'Comment', 1, 1000, true),
    created_at: ctx.now.toISOString(),
  };
  db.addComment(ctx.storage, comment, entry.user_id);
  return json({ ...comment, author: toPublicUser(byId(ctx.storage, user.id)) }, 201);
}
export function removeComment(ctx: Context) {
  const user = requireUser(ctx);
  const comment = db.findComment(ctx.storage, ctx.params.id);
  if (!comment) throw new HttpError(404, 'NOT_FOUND', 'Comment not found.');
  visibleEntry(ctx.storage, comment.entry_id, user.id);
  if (comment.user_id !== user.id && user.role === 'rower')
    throw new HttpError(403, 'FORBIDDEN', 'Only the author or staff may delete this comment.');
  ctx.storage.transactionSync(() => {
    db.deleteComment(ctx.storage, comment.id);
    if (comment.user_id !== user.id) audit(ctx, 'comment.delete', comment.id, comment, null);
  });
  return noContent();
}
