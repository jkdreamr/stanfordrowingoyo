import type { Context } from '../context';
import { refreshUser, requireUser } from '../auth/guards';
import { visibleEntry } from '../db/entries';
import * as db from '../db/social';
import { byId, toPublicUser } from '../db/users';
import { audit } from '../db/audit';
import { HttpError, json, noContent, readJson } from '../http';
import { string } from '../validate';
import { recipients, mentioned } from '../db/recipients';
export function kudosUsers(ctx: Context) {
  const user = requireUser(ctx);
  return json(db.kudosUsers(ctx.storage, ctx.params.id, user.id));
}
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
    edited_at: null,
  };
  const mentions = recipients(
    ctx.storage,
    body.mention_ids === undefined ? [] : body.mention_ids,
    user.id,
  ).filter((user) => mentioned(comment.body, user.name));
  db.addComment(
    ctx.storage,
    comment,
    entry.user_id,
    mentions.map((user) => user.id),
  );
  return json({ ...comment, mentions, author: toPublicUser(byId(ctx.storage, user.id)) }, 201);
}
export async function patchComment(ctx: Context) {
  const body = await readJson(ctx.request);
  const user = refreshUser(ctx);
  const comment = db.findComment(ctx.storage, ctx.params.id);
  if (!comment) throw new HttpError(404, 'NOT_FOUND', 'Comment not found.');
  visibleEntry(ctx.storage, comment.entry_id, user.id);
  if (comment.user_id !== user.id)
    throw new HttpError(403, 'FORBIDDEN', 'Only the author may edit this comment.');
  const text = string(body.body, 'Comment', 1, 1000, true);
  const previous = ctx.storage.sql
    .exec<{ user_id: string }>(
      'SELECT m.user_id FROM comment_mentions m JOIN users u ON u.id=m.user_id WHERE m.comment_id=? AND u.active=1',
      comment.id,
    )
    .toArray()
    .map((row) => row.user_id);
  const mentions = recipients(
    ctx.storage,
    body.mention_ids === undefined ? previous : body.mention_ids,
    user.id,
  ).filter((user) => mentioned(text, user.name));
  db.editComment(
    ctx.storage,
    comment,
    text,
    mentions.map((user) => user.id),
    ctx.now.toISOString(),
  );
  return json({ ...db.findComment(ctx.storage, comment.id), mentions, author: toPublicUser(user) });
}
export function removeComment(ctx: Context) {
  const user = requireUser(ctx);
  const comment = db.findComment(ctx.storage, ctx.params.id);
  if (!comment) throw new HttpError(404, 'NOT_FOUND', 'Comment not found.');
  visibleEntry(ctx.storage, comment.entry_id, user.id);
  if (comment.user_id !== user.id && user.role === 'rower')
    throw new HttpError(403, 'FORBIDDEN', 'Only the author or staff may delete this comment.');
  ctx.storage.transactionSync(() => {
    db.deleteComment(ctx.storage, comment.id, user.id, ctx.now.toISOString());
    if (comment.user_id !== user.id) audit(ctx, 'comment.delete', comment.id, comment, null);
  });
  return noContent();
}
