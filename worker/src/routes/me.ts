import { today, weekStart } from '../../../shared/dates';
import type { Context } from '../context';
import { refreshUser, requireUser } from '../auth/guards';
import { byId, toUser } from '../db/users';
import { attempt, clearAttempts } from '../db/rateLimit';
import { effectiveTarget, setTarget } from '../db/targets';
import { rosterByName } from '../db/roster';
import { deleteUnreferencedImages } from '../db/images';
import { HttpError, json, noContent, readJson } from '../http';
import * as v from '../validate';
export function get(ctx: Context) {
  return json(toUser(requireUser(ctx)));
}
export async function patch(ctx: Context) {
  const body = await readJson(ctx.request);
  const user = refreshUser(ctx);
  const fields: Record<string, string | number | null> = {};
  if (body.name !== undefined) fields.name = v.string(body.name, 'Name', 1, 80, true);
  if (body.bio !== undefined) fields.bio = v.string(body.bio, 'Bio', 0, 500);
  if (body.group_key !== undefined)
    fields.group_key = v.enumeration(body.group_key, ['frosh', 'normal', 'u23'], 'Group');
  if (body.side !== undefined)
    fields.side = v.nullable(body.side, (value) =>
      v.enumeration(value, ['port', 'starboard', 'both', 'cox'], 'Side'),
    );
  if (body.class_year !== undefined)
    fields.class_year = v.nullable(body.class_year, (value) =>
      v.int(value, 'Class year', 1950, 2100),
    );
  for (const key of ['best6k_split_s', 'best2k_split_s'])
    if (body[key] !== undefined)
      fields[key] = v.nullable(
        body[key],
        (value) => Math.round(v.number(value, 'Split', 60, 300) * 10) / 10,
      );
  if (body.avatar_image_id !== undefined) {
    const id = v.nullable(body.avatar_image_id, (value) => v.string(value, 'Avatar image', 1, 200));
    if (
      id &&
      !ctx.storage.sql
        .exec('SELECT id FROM images WHERE id = ? AND owner_id = ?', id, user.id)
        .toArray()[0]
    )
      v.invalid('Avatar image must be owned by you.');
    fields.avatar_image_id = id;
  }
  ctx.storage.transactionSync(() => {
    if (fields.name !== undefined) {
      const linked = ctx.storage.sql
        .exec<{ id: string }>('SELECT id FROM roster WHERE claimed_by_user_id = ?', user.id)
        .toArray()[0];
      if (linked) {
        const duplicate = rosterByName(ctx.storage, fields.name as string);
        if (duplicate && duplicate.id !== linked.id)
          throw new HttpError(409, 'CONFLICT', 'This name is already on the roster.');
        ctx.storage.sql.exec('UPDATE roster SET name = ? WHERE id = ?', fields.name, linked.id);
      }
    }
    for (const [key, value] of Object.entries(fields))
      ctx.storage.sql.exec(`UPDATE users SET ${key} = ? WHERE id = ?`, value, user.id);
    ctx.storage.sql.exec(
      'UPDATE users SET updated_at = ? WHERE id = ?',
      ctx.now.toISOString(),
      user.id,
    );
    if (body.avatar_image_id !== undefined && user.avatar_image_id)
      deleteUnreferencedImages(ctx.storage, [user.avatar_image_id]);
  });
  return json(toUser(byId(ctx.storage, user.id)));
}
export function passwordChallenge(ctx: Context) {
  const user = refreshUser(ctx, true);
  attempt(ctx, user.email);
  return json({
    user_id: user.id,
    password_hash: user.password_hash,
    password_salt: user.password_salt,
  });
}
export async function password(ctx: Context) {
  const body = await readJson(ctx.request);
  const user = {
    id: body.user_id,
    password_hash: body.password_hash,
    password_salt: body.password_salt,
  };
  const hash = v.string(body.new_password_hash, 'Password hash', 1, 200);
  const salt = v.string(body.new_password_salt, 'Password salt', 1, 200);
  ctx.storage.transactionSync(() => {
    const latest = refreshUser(ctx, true);
    if (
      latest.id !== user.id ||
      latest.password_hash !== user.password_hash ||
      latest.password_salt !== user.password_salt
    )
      throw new HttpError(409, 'CREDENTIALS_CHANGED', 'Credentials changed. Please try again.');
    ctx.storage.sql.exec(
      'UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0, updated_at = ? WHERE id = ?',
      hash,
      salt,
      ctx.now.toISOString(),
      latest.id,
    );
    ctx.storage.sql.exec(
      'DELETE FROM sessions WHERE user_id = ? AND token_hash != ?',
      latest.id,
      ctx.tokenHash!,
    );
    clearAttempts(ctx, latest.email);
  });
  return noContent();
}
export function target(ctx: Context) {
  return json(effectiveTarget(ctx.storage, requireUser(ctx), weekStart(today(ctx.now))));
}
export async function putTarget(ctx: Context) {
  const body = await readJson(ctx.request);
  const user = refreshUser(ctx);
  return json(
    setTarget(
      ctx.storage,
      user.id,
      weekStart(today(ctx.now)),
      v.int(body.target_m, 'Target', 1000, 1000000),
    ),
  );
}
