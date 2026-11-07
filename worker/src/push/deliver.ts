import type { Notification } from '../../../shared/types';
import type { Env } from '../index';
import { sendPush, vapidConfig, type PushTarget } from './webpush';

export const PUSH_BATCH = 10;
export const PUSH_MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 30_000;

interface OutboxRow extends PushTarget {
  [key: string]: SqlStorageValue;
  id: number;
  attempts: number;
  owner: string | null;
  notification_id: string;
  recipient: string | null;
  kind: Notification['kind'] | null;
  entry_id: string | null;
  created_at: string | null;
  read_at: string | null;
  actor_name: string | null;
  entry_title: string | null;
  announcement_title: string | null;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
  badge: number;
}

const verbs: Record<Notification['kind'], string> = {
  kudos: 'Gave kudos to',
  comment: 'Commented on',
  tag: 'Tagged you in',
  mention: 'Mentioned you in',
  announcement: 'Announcement',
  report: 'Reported',
};

export function pushPayload(row: OutboxRow, unread: number): PushPayload {
  const kind = row.kind!;
  const title = row.actor_name ?? 'Stanford Rowing';
  const entry = row.entry_title?.trim() || 'your workout';
  const body =
    kind === 'announcement'
      ? row.announcement_title
        ? `${verbs.announcement}: ${row.announcement_title}`
        : verbs.announcement
      : `${verbs[kind]} ${entry}`;
  const url =
    kind === 'report'
      ? '/admin/reports'
      : kind === 'announcement'
        ? row.entry_id
          ? `/announcements?announcement=${encodeURIComponent(row.entry_id)}`
          : '/announcements'
        : !row.entry_id
          ? '/announcements'
          : `/entries/${encodeURIComponent(row.entry_id)}${kind === 'comment' || kind === 'mention' ? '#comments' : ''}`;
  return {
    title,
    body: body.length > 160 ? body.slice(0, 159) + '…' : body,
    url,
    tag: kind === 'kudos' && row.entry_id ? `kudos:${row.entry_id}` : row.notification_id,
    badge: Math.min(unread, 99),
  };
}

export async function schedulePush(storage: DurableObjectStorage, at = Date.now()) {
  const current = await storage.getAlarm();
  if (current === null || current > at) await storage.setAlarm(at);
}

const DUE_SQL = `SELECT o.id,o.attempts,o.notification_id,o.endpoint,s.p256dh,s.auth,s.user_id AS owner,
n.user_id AS recipient,n.kind,n.entry_id,n.created_at,n.read_at,u.name AS actor_name,e.title AS entry_title,
(SELECT a.title FROM announcements a WHERE n.kind='announcement' AND (a.id=n.entry_id OR (n.entry_id IS NULL AND a.author_id=n.actor_id AND a.created_at=n.created_at)) LIMIT 1) AS announcement_title
FROM push_outbox o
LEFT JOIN push_subscriptions s ON s.endpoint=o.endpoint
LEFT JOIN notifications n ON n.id=o.notification_id
LEFT JOIN users u ON u.id=n.actor_id
LEFT JOIN entries e ON n.kind!='announcement' AND e.id=n.entry_id
WHERE o.next_at <= ? ORDER BY o.next_at,o.id LIMIT ?`;

/** Sends a bounded batch of due pushes from the DO alarm, then reschedules for the rest. */
export async function deliverPush(
  storage: DurableObjectStorage,
  env: Pick<Env, 'VAPID_PUBLIC_KEY' | 'VAPID_PRIVATE_KEY' | 'VAPID_SUBJECT'>,
  now = Date.now(),
) {
  const sql = storage.sql;
  const vapid = await vapidConfig(env);
  if (!vapid) {
    sql.exec('DELETE FROM push_outbox');
    return;
  }
  const rows = sql.exec<OutboxRow>(DUE_SQL, now, PUSH_BATCH).toArray();
  const unread = new Map<string, number>();
  await Promise.all(
    rows.map(async (row) => {
      if (
        !row.owner ||
        !row.kind ||
        row.owner !== row.recipient ||
        row.read_at ||
        (row.kind === 'announcement' && !row.announcement_title) ||
        (row.kind === 'report' &&
          !sql
            .exec(
              "SELECT id FROM users WHERE id=? AND active=1 AND role IN ('coxswain','coach','admin')",
              row.owner,
            )
            .toArray().length)
      ) {
        sql.exec('DELETE FROM push_outbox WHERE id = ?', row.id);
        return;
      }
      if (!unread.has(row.owner))
        unread.set(
          row.owner,
          sql
            .exec<{ count: number }>(
              'SELECT COUNT(*) AS count FROM (SELECT 1 FROM notifications WHERE user_id = ? AND read_at IS NULL LIMIT 100)',
              row.owner,
            )
            .one().count,
        );
      let status = 0;
      let retryAfter = 0;
      try {
        const response = await sendPush(vapid, row, pushPayload(row, unread.get(row.owner)!), now);
        status = response.status;
        retryAfter = Number(response.headers.get('Retry-After')) || 0;
        await response.body?.cancel();
      } catch {
        status = 0;
      }
      if (status === 404 || status === 410) {
        sql.exec('DELETE FROM push_subscriptions WHERE endpoint = ?', row.endpoint);
        sql.exec('DELETE FROM push_outbox WHERE endpoint = ?', row.endpoint);
      } else if (
        (status === 0 || status === 429 || status >= 500) &&
        row.attempts + 1 < PUSH_MAX_ATTEMPTS
      ) {
        const delay = Math.max(
          RETRY_BASE_MS * 2 ** row.attempts,
          Math.min(retryAfter, 3600) * 1000,
        );
        sql.exec(
          'UPDATE push_outbox SET attempts = attempts + 1, next_at = ? WHERE id = ?',
          now + delay,
          row.id,
        );
      } else sql.exec('DELETE FROM push_outbox WHERE id = ?', row.id);
    }),
  );
  const next = sql
    .exec<{ next: number | null }>('SELECT MIN(next_at) AS next FROM push_outbox')
    .one().next;
  if (next === null) await storage.deleteAlarm();
  else await storage.setAlarm(Math.max(next, Date.now()));
}
