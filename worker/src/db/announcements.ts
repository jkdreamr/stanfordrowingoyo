import type { Announcement } from '../../../shared/types';
import type { Row } from './row';
import { toPublicUser, type UserRow } from './users';
import { HttpError } from '../http';
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
export function saveAnnouncement(
  storage: DurableObjectStorage,
  row: Omit<Announcement, 'author'>,
  update = false,
) {
  const values = [row.author_id, row.title, row.body, Number(row.pinned), row.created_at, row.id];
  if (update) {
    if (
      !storage.sql.exec(
        'UPDATE announcements SET author_id=?,title=?,body=?,pinned=?,created_at=? WHERE id=?',
        ...values,
      ).rowsWritten
    )
      throw new HttpError(404, 'NOT_FOUND', 'Announcement not found.');
  } else
    storage.sql.exec(
      'INSERT INTO announcements (author_id,title,body,pinned,created_at,id) VALUES (?,?,?,?,?,?)',
      ...values,
    );
}
