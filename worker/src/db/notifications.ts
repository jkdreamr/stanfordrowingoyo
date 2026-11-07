import type { Notification } from '../../../shared/types';
import type { Row } from './row';
import { toPublicUser, type UserRow } from './users';
export function notify(
  storage: DurableObjectStorage,
  recipient: string,
  actor: string,
  kind: Notification['kind'],
  entryId: string | null,
  timestamp: string,
) {
  if (
    recipient === actor ||
    !storage.sql.exec('SELECT id FROM users WHERE id = ? AND active = 1', recipient).toArray()
      .length
  )
    return;
  storage.sql.exec(
    'INSERT INTO notifications VALUES (?,?,?,?,?,?,?)',
    crypto.randomUUID(),
    recipient,
    kind,
    actor,
    entryId,
    timestamp,
    null,
  );
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
  const entryIds = [...new Set(rows.flatMap((row) => (row.entry_id ? [row.entry_id] : [])))];
  const actors = storage.sql
    .exec<UserRow>(
      `SELECT * FROM users WHERE id IN (${actorIds.map(() => '?').join(',')})`,
      ...actorIds,
    )
    .toArray();
  const entries = entryIds.length
    ? storage.sql
        .exec<{ id: string; title: string }>(
          `SELECT id,title FROM entries WHERE id IN (${entryIds.map(() => '?').join(',')})`,
          ...entryIds,
        )
        .toArray()
    : [];
  return rows.map((row) => ({
    ...row,
    actor: toPublicUser(actors.find((actor) => actor.id === row.actor_id)!),
    entry_title: entries.find((entry) => entry.id === row.entry_id)?.title ?? null,
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
      `UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND id IN (${ids.map(() => '?').join(',')})`,
      timestamp,
      user,
      ...ids,
    );
}
