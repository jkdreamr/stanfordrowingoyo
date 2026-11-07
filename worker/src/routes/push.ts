import type { PushConfig } from '../../../shared/types';
import type { Context } from '../context';
import { refreshUser, requireUser } from '../auth/guards';
import { HttpError, json, noContent, readJson } from '../http';
import { invalid, string } from '../validate';
import { fromBase64url, publicVapidKey } from '../push/webpush';

export const MAX_PUSH_DEVICES = 10;
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/,
];

export function pushEndpoint(value: unknown): string {
  const endpoint = string(value, 'Push endpoint', 1, 1024);
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return invalid('Push endpoint must be a push service URL.');
  }
  if (url.protocol !== 'https:' || url.port || !PUSH_HOSTS.some((host) => host.test(url.hostname)))
    invalid('Push endpoint must be a push service URL.');
  return endpoint;
}

function key(value: unknown, label: string, length: number, prefix?: number) {
  const text = string(value, label, 1, 200);
  let bytes: Uint8Array;
  try {
    bytes = fromBase64url(text);
  } catch {
    return invalid(`${label} must be base64url.`);
  }
  if (bytes.length !== length || (prefix !== undefined && bytes[0] !== prefix))
    invalid(`${label} is invalid.`);
  return text;
}

export async function get(ctx: Context) {
  requireUser(ctx);
  return json({ public_key: await publicVapidKey(ctx.env) } satisfies PushConfig);
}

export async function put(ctx: Context) {
  const body = await readJson(ctx.request);
  const user = refreshUser(ctx);
  const keys = (body.keys ?? {}) as Record<string, unknown>;
  const endpoint = pushEndpoint(body.endpoint);
  const p256dh = key(keys.p256dh, 'Push key', 65, 4);
  const auth = key(keys.auth, 'Push auth secret', 16);
  if (!(await publicVapidKey(ctx.env)))
    throw new HttpError(503, 'PUSH_UNAVAILABLE', 'Push notifications are not configured.');
  const at = ctx.now.toISOString();
  ctx.storage.transactionSync(() => {
    ctx.storage.sql.exec(
      'INSERT INTO push_subscriptions VALUES (?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,updated_at=excluded.updated_at',
      endpoint,
      user.id,
      p256dh,
      auth,
      at,
      at,
    );
    const stale = ctx.storage.sql
      .exec<{ endpoint: string }>(
        'SELECT endpoint FROM push_subscriptions WHERE user_id = ? ORDER BY updated_at DESC,endpoint LIMIT -1 OFFSET ?',
        user.id,
        MAX_PUSH_DEVICES,
      )
      .toArray();
    for (const row of stale) {
      ctx.storage.sql.exec('DELETE FROM push_subscriptions WHERE endpoint = ?', row.endpoint);
      ctx.storage.sql.exec('DELETE FROM push_outbox WHERE endpoint = ?', row.endpoint);
    }
  });
  return noContent();
}

export async function remove(ctx: Context) {
  const body = await readJson(ctx.request);
  const user = refreshUser(ctx);
  const endpoint = string(body.endpoint, 'Push endpoint', 1, 1024);
  ctx.storage.transactionSync(() => {
    if (
      ctx.storage.sql.exec(
        'DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?',
        endpoint,
        user.id,
      ).rowsWritten
    )
      ctx.storage.sql.exec('DELETE FROM push_outbox WHERE endpoint = ?', endpoint);
  });
  return noContent();
}
