import type { Comment, CommentWithAuthor } from '../../../shared/types';
import type { Row } from './row';
import { toPublicUser, type UserRow } from './users';
import { notify } from './notifications';
import { HttpError } from '../http';
export function kudosUsers(storage: DurableObjectStorage, entry: string, _viewer: string) {
  const rows = storage.sql
    .exec<UserRow | { id: null }>(
      `SELECT u.* FROM entries e
     LEFT JOIN kudos k ON k.entry_id=e.id
     LEFT JOIN users u ON u.id=k.user_id
     WHERE e.id=?
     ORDER BY k.created_at DESC,k.user_id`,
      entry,
    )
    .toArray();
  if (!rows.length) throw new HttpError(404, 'NOT_FOUND', 'Entry not found.');
  return rows.filter((row): row is UserRow => row.id !== null).map(toPublicUser);
}
export function addKudos(
  storage: DurableObjectStorage,
  entry: string,
  owner: string,
  actor: string,
  timestamp: string,
) {
  storage.transactionSync(() => {
    const inserted = storage.sql.exec(
      'INSERT OR IGNORE INTO kudos VALUES (?,?,?)',
      entry,
      actor,
      timestamp,
    ).rowsWritten;
    if (inserted) notify(storage, owner, actor, 'kudos', entry, timestamp);
  });
}
export function removeKudos(storage: DurableObjectStorage, entry: string, actor: string) {
  storage.transactionSync(() => {
    storage.sql.exec('DELETE FROM kudos WHERE entry_id = ? AND user_id = ?', entry, actor);
    storage.sql.exec(
      'DELETE FROM notifications WHERE entry_id = ? AND actor_id = ? AND kind = ? AND read_at IS NULL',
      entry,
      actor,
      'kudos',
    );
  });
}
export function comments(storage: DurableObjectStorage, entry: string): CommentWithAuthor[] {
  const rows = storage.sql
    .exec<Row<Comment>>('SELECT * FROM comments WHERE entry_id = ? ORDER BY created_at,id', entry)
    .toArray();
  if (!rows.length) return [];
  const ids = [...new Set(rows.map((row) => row.user_id))];
  const authors = storage.sql
    .exec<UserRow>(`SELECT * FROM users WHERE id IN (${ids.map(() => '?').join(',')})`, ...ids)
    .toArray();
  return rows.map((row) => ({
    ...row,
    author: toPublicUser(authors.find((author) => author.id === row.user_id)!),
  }));
}
export function addComment(storage: DurableObjectStorage, comment: Comment, owner: string) {
  storage.transactionSync(() => {
    storage.sql.exec(
      'INSERT INTO comments VALUES (?,?,?,?,?)',
      comment.id,
      comment.entry_id,
      comment.user_id,
      comment.body,
      comment.created_at,
    );
    notify(storage, owner, comment.user_id, 'comment', comment.entry_id, comment.created_at);
  });
}
export function findComment(storage: DurableObjectStorage, id: string) {
  return storage.sql.exec<Row<Comment>>('SELECT * FROM comments WHERE id = ?', id).toArray()[0];
}
export function deleteComment(storage: DurableObjectStorage, id: string) {
  storage.sql.exec('DELETE FROM comments WHERE id = ?', id);
}
