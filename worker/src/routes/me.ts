import { today, weekStart } from '../../../shared/dates';
import type { Context } from '../context';
import { refreshUser, requireUser } from '../auth/guards';
import { byId, toUser, type UserRow } from '../db/users';
import { prepareSession } from '../db/sessions';
import { sha256 } from '../auth/crypto';
import { attempt, clearAttempts } from '../db/rateLimit';
import { effectiveTarget, setTarget } from '../db/targets';
import { rosterByName } from '../db/roster';
import { deleteUnreferencedImages } from '../db/images';
import { HttpError, json, noContent, readJson } from '../http';
import * as v from '../validate';
import { insertTest } from './tests';
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
      v.nullable(body[key], (value) => Math.round(v.number(value, 'Split', 60, 300) * 10) / 10);
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
    for (const [key, kind] of [
      ['best2k_split_s', '2k'],
      ['best6k_split_s', '6k'],
    ])
      if (body[key] !== undefined && body[key] !== null)
        insertTest(ctx, user.id, { kind, date: today(ctx.now), split_s: body[key] });
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
    session_hash: ctx.tokenHash!,
  });
}
function checkCredentials(ctx: Context, body: Record<string, unknown>) {
  const user = refreshUser(ctx, true);
  if (
    user.id !== body.user_id ||
    user.password_hash !== body.password_hash ||
    user.password_salt !== body.password_salt ||
    ctx.tokenHash !== body.session_hash
  )
    throw new HttpError(409, 'CREDENTIALS_CHANGED', 'Credentials changed. Please try again.');
  return user;
}
async function grantHash(value: unknown) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value) ? sha256(value) : undefined;
}
function checkGrant(ctx: Context, user: UserRow, hash: string | undefined) {
  if (user.must_change_password) return;
  const grant = hash
    ? ctx.storage.sql
        .exec<{
          session_hash: string;
          user_id: string;
          credential_hash: string;
          credential_salt: string;
          expires_at: string;
        }>('SELECT * FROM reauth_grants WHERE token_hash=?', hash)
        .toArray()[0]
    : undefined;
  if (
    !grant ||
    grant.session_hash !== ctx.tokenHash ||
    grant.user_id !== user.id ||
    grant.credential_hash !== user.password_hash ||
    grant.credential_salt !== user.password_salt ||
    Date.parse(grant.expires_at) <= ctx.now.getTime()
  )
    throw new HttpError(
      401,
      'REAUTH_REQUIRED',
      'Verify your current password again before changing it.',
    );
}
export async function passwordVerified(ctx: Context) {
  const body = await readJson(ctx.request);
  const prepared = await prepareSession();
  return ctx.storage.transactionSync(() => {
    const user = checkCredentials(ctx, body);
    const expires_at = new Date(ctx.now.getTime() + 5 * 60 * 1000).toISOString();
    ctx.storage.sql.exec('DELETE FROM reauth_grants WHERE expires_at<=?', ctx.now.toISOString());
    ctx.storage.sql.exec(
      'INSERT INTO reauth_grants VALUES (?,?,?,?,?,?)',
      prepared.hash,
      ctx.tokenHash!,
      user.id,
      user.password_hash,
      user.password_salt,
      expires_at,
    );
    return json({ reauth_token: prepared.value, expires_at });
  });
}
export async function passwordPrecheck(ctx: Context) {
  const body = await readJson(ctx.request);
  const hash = await grantHash(body.reauth_token);
  const user = refreshUser(ctx, true);
  attempt(ctx, user.email);
  checkGrant(ctx, user, hash);
  return json({
    user_id: user.id,
    password_hash: user.password_hash,
    password_salt: user.password_salt,
    session_hash: ctx.tokenHash!,
  });
}
export async function password(ctx: Context) {
  const body = await readJson(ctx.request);
  const hash = v.string(body.new_password_hash, 'Password hash', 1, 200);
  const salt = v.string(body.new_password_salt, 'Password salt', 1, 200);
  const reauthHash = await grantHash(body.reauth_token);
  ctx.storage.transactionSync(() => {
    const latest = checkCredentials(ctx, body);
    checkGrant(ctx, latest, reauthHash);
    ctx.storage.sql.exec(
      'UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0, updated_at = ? WHERE id = ?',
      hash,
      salt,
      ctx.now.toISOString(),
      latest.id,
    );
    ctx.storage.sql.exec('DELETE FROM reauth_grants WHERE user_id=?', latest.id);
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
