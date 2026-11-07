import type { Notification } from '../../../shared/types';
import type { Row } from './row';
import { toPublicUser, type UserRow } from './users';
const pendingPush = new WeakSet<DurableObjectStorage>();
/** True once per request that queued push deliveries, so the DO can schedule its alarm. */
export function takePendingPush(storage: DurableObjectStorage) {
  return pendingPush.delete(storage);
}
export function notify(
  storage: DurableObjectStorage,
  recipient: string,
  actor: string,
  kind: Notification['kind'],
  entryId: string | null,
  timestamp: string,
  announcementId?: string,
) {
  if (
    recipient === actor ||
    !storage.sql.exec('SELECT id FROM users WHERE id = ? AND active = 1', recipient).toArray()
      .length
  )
    return;
  const id = crypto.randomUUID();
  storage.sql.exec(
    'INSERT INTO notifications VALUES (?,?,?,?,?,?,?)',
    id,
    recipient,
    kind,
    actor,
    entryId ?? announcementId ?? null,
    timestamp,
    null,
  );
  if (
    storage.sql.exec(
      'INSERT INTO push_outbox (notification_id,endpoint,attempts,next_at) SELECT ?,endpoint,0,? FROM push_subscriptions WHERE user_id = ?',
      id,
      Date.now(),
      recipient,
    ).rowsWritten
  )
    pendingPush.add(storage);
}
export function notifications(storage: DurableObjectStorage, user: string): Notification[] {
  const rows = storage.sql
    .exec<Row<Omit<Notification, 'actor' | 'entry_title'>>>(
      "SELECT * FROM notifications WHERE user_id = ? AND (kind != 'report' OR EXISTS (SELECT 1 FROM users WHERE id=notifications.user_id AND active=1 AND role IN ('coxswain','coach','admin'))) ORDER BY created_at DESC,id DESC LIMIT ?",
      user,
      100,
    )
    .toArray();
  if (!rows.length) return [];
  const actorIds = [...new Set(rows.map((row) => row.actor_id))];
  const entryIds = [
    ...new Set(
      rows.flatMap((row) => (row.kind !== 'announcement' && row.entry_id ? [row.entry_id] : [])),
    ),
  ];
  const actors = storage.sql
    .exec<UserRow>(
      'SELECT * FROM users WHERE id IN (SELECT value FROM json_each(?))',
      JSON.stringify(actorIds),
    )
    .toArray();
  const entries = entryIds.length
    ? storage.sql
        .exec<{ id: string; title: string }>(
          'SELECT id,title FROM entries WHERE id IN (SELECT value FROM json_each(?))',
          JSON.stringify(entryIds),
        )
        .toArray()
    : [];
  return rows.map((row) => ({
    ...row,
    ...(row.kind === 'announcement' ? { announcement_id: row.entry_id, entry_id: null } : {}),
    actor: toPublicUser(actors.find((actor) => actor.id === row.actor_id)!),
    entry_title:
      row.kind === 'announcement'
        ? null
        : (entries.find((entry) => entry.id === row.entry_id)?.title ?? null),
  }));
}
export function markRead(
  storage: DurableObjectStorage,
  user: string,
  ids: string[],
  timestamp: string,
) {
  if (!ids.length)
    storage.sql.exec(
      'UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL',
      timestamp,
      user,
    );
  else
    storage.sql.exec(
      'UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND id IN (SELECT value FROM json_each(?))',
      timestamp,
      user,
      JSON.stringify(ids),
    );
}
