import type { Announcement } from '../../../shared/types';
import type { Row } from './row';
import { toPublicUser, type UserRow } from './users';
export type AnnouncementRow = Row<Omit<Announcement, 'author'>>;
export function announcements(storage: DurableObjectStorage): Announcement[] {
  const rows = storage.sql
    .exec<AnnouncementRow>(
      'SELECT * FROM announcements ORDER BY pinned DESC,created_at DESC,id DESC',
    )
    .toArray();
  if (!rows.length) return [];
  const ids = [...new Set(rows.map((row) => row.author_id))];
  const authors = storage.sql
    .exec<UserRow>(`SELECT * FROM users WHERE id IN (${ids.map(() => '?').join(',')})`, ...ids)
    .toArray();
  return rows.map((row) => ({
    ...row,
    pinned: !!row.pinned,
    author: toPublicUser(authors.find((user) => user.id === row.author_id)!),
  }));
}
export function saveAnnouncement(storage: DurableObjectStorage, row: Omit<Announcement, 'author'>) {
  storage.sql.exec(
    'INSERT OR REPLACE INTO announcements VALUES (?,?,?,?,?,?)',
    row.id,
    row.author_id,
    row.title,
    row.body,
    Number(row.pinned),
    row.created_at,
  );
}
