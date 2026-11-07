import type { Entry, EntryDetail, ImageMetadata } from '../../../shared/types';
import type { Row } from './row';
import { toPublicUser, type UserRow } from './users';
import { HttpError } from '../http';
import { deleteUnreferencedImages } from './images';
import { notify } from './notifications';
export function findEntry(storage: DurableObjectStorage, id: string) {
  return storage.sql.exec<Row<Entry>>('SELECT * FROM entries WHERE id = ?', id).toArray()[0];
}
export function visibleEntry(storage: DurableObjectStorage, id: string, _viewer: string) {
  const entry = findEntry(storage, id);
  if (!entry) throw new HttpError(404, 'NOT_FOUND', 'Entry not found.');
  return entry;
}
export function details(
  storage: DurableObjectStorage,
  rows: Entry[],
  viewer: string,
): EntryDetail[] {
  if (!rows.length) return [];
  const ids = JSON.stringify(rows.map((row) => row.id));
  const authors = storage.sql
    .exec<UserRow>(
      'SELECT * FROM users WHERE id IN (SELECT user_id FROM entries WHERE id IN (SELECT value FROM json_each(?)))',
      ids,
    )
    .toArray();
  const images = storage.sql
    .exec<Row<ImageMetadata> & { entry_id: string }>(
      'SELECT i.id,i.owner_id,i.mime,i.width,i.height,i.created_at,ei.entry_id FROM images i JOIN entry_images ei ON ei.image_id = i.id WHERE ei.entry_id IN (SELECT value FROM json_each(?)) ORDER BY ei.position',
      ids,
    )
    .toArray();
  const kudos = storage.sql
    .exec<{ entry_id: string; count: number; mine: number }>(
      'SELECT entry_id,COUNT(*) AS count,MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS mine FROM kudos WHERE entry_id IN (SELECT value FROM json_each(?)) GROUP BY entry_id',
      viewer,
      ids,
    )
    .toArray();
  const comments = storage.sql
    .exec<{ entry_id: string; count: number }>(
      'SELECT entry_id,COUNT(*) AS count FROM comments WHERE entry_id IN (SELECT value FROM json_each(?)) GROUP BY entry_id',
      ids,
    )
    .toArray();
  const tags = storage.sql
    .exec<UserRow & { entry_id: string }>(
      'SELECT u.*,t.entry_id FROM entry_tags t JOIN users u ON u.id=t.user_id WHERE u.active=1 AND t.entry_id IN (SELECT value FROM json_each(?)) ORDER BY t.created_at,u.name,u.id',
      ids,
    )
    .toArray();
  return rows.map((row) => ({
    tagged: tags
      .filter((tag) => tag.entry_id === row.id)
      .map(({ entry_id: _entry, ...user }) => {
        void _entry;
        return toPublicUser(user);
      }),
    ...row,
    author: toPublicUser(authors.find((author) => author.id === row.user_id)!),
    images: images
      .filter((image) => image.entry_id === row.id)
      .map(({ entry_id: _entry, ...image }) => {
        void _entry;
        return image;
      }),
    kudos_count: kudos.find((k) => k.entry_id === row.id)?.count ?? 0,
    has_kudos: !!kudos.find((k) => k.entry_id === row.id)?.mine,
    comment_count: comments.find((c) => c.entry_id === row.id)?.count ?? 0,
  }));
}
export function saveEntry(
  storage: DurableObjectStorage,
  entry: Entry,
  imageIds?: string[],
  update = false,
  taggedIds?: string[],
  actor = entry.user_id,
) {
  storage.transactionSync(() => {
    const keys = [
      'user_id',
      'date',
      'week_start',
      'modality',
      'zone',
      'distance_m',
      'duration_s',
      'avg_split_s',
      'stroke_rate',
      'avg_hr',
      'title',
      'notes',
      'preset_id',
      'mode_factor',
      'zone_factor',
      'equiv_m',
      'visibility',
      'created_at',
      'updated_at',
    ] as const;
    const values = keys.map((key) => entry[key]);
    if (update) {
      if (
        !storage.sql.exec(
          `UPDATE entries SET ${keys.map((key) => `${key} = ?`).join(',')} WHERE id = ?`,
          ...values,
          entry.id,
        ).rowsWritten
      )
        throw new HttpError(404, 'NOT_FOUND', 'Entry not found.');
    } else
      storage.sql.exec(
        `INSERT INTO entries (${keys.join(',')},id) VALUES (${keys.map(() => '?').join(',')},?)`,
        ...values,
        entry.id,
      );
    if (taggedIds) {
      const previous = storage.sql
        .exec<{ user_id: string }>('SELECT user_id FROM entry_tags WHERE entry_id = ?', entry.id)
        .toArray()
        .map((row) => row.user_id);
      for (const id of previous)
        if (!taggedIds.includes(id))
          storage.sql.exec(
            'DELETE FROM entry_tags WHERE entry_id = ? AND user_id = ?',
            entry.id,
            id,
          );
      for (const id of taggedIds) {
        if (previous.includes(id)) continue;
        storage.sql.exec('INSERT INTO entry_tags VALUES (?,?,?)', entry.id, id, entry.updated_at);
        if (
          !storage.sql
            .exec(
              "SELECT id FROM notifications WHERE user_id = ? AND entry_id = ? AND kind = 'tag'",
              id,
              entry.id,
            )
            .toArray().length
        )
          notify(storage, id, actor, 'tag', entry.id, entry.updated_at);
      }
    }
    if (imageIds) {
      const previous = storage.sql
        .exec<{ image_id: string }>(
          'SELECT image_id FROM entry_images WHERE entry_id = ?',
          entry.id,
        )
        .toArray();
      storage.sql.exec('DELETE FROM entry_images WHERE entry_id = ?', entry.id);
      imageIds.forEach((id, position) =>
        storage.sql.exec('INSERT INTO entry_images VALUES (?,?,?)', entry.id, id, position),
      );
      deleteUnreferencedImages(
        storage,
        previous.map((row) => row.image_id),
      );
    }
  });
}
export function checkImages(
  storage: DurableObjectStorage,
  ids: string[],
  owner: string,
  entryId: string,
) {
  for (const id of ids) {
    if (
      !storage.sql
        .exec('SELECT id FROM images WHERE id = ? AND owner_id = ?', id, owner)
        .toArray()[0]
    )
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        'Images must exist and be owned by the entry owner.',
      );
    if (
      storage.sql
        .exec('SELECT entry_id FROM entry_images WHERE image_id = ? AND entry_id != ?', id, entryId)
        .toArray()[0]
    )
      throw new HttpError(409, 'CONFLICT', 'Image is attached to another entry.');
  }
}
export function deleteEntry(storage: DurableObjectStorage, id: string) {
  storage.transactionSync(() => {
    const previous = storage.sql
      .exec<{ image_id: string }>('SELECT image_id FROM entry_images WHERE entry_id = ?', id)
      .toArray();
    for (const table of [
      'entry_tags',
      'comment_mentions',
      'entry_images',
      'kudos',
      'comments',
      'notifications',
    ])
      storage.sql.exec(`DELETE FROM ${table} WHERE entry_id = ?`, id);
    storage.sql.exec('DELETE FROM entries WHERE id = ?', id);
    deleteUnreferencedImages(
      storage,
      previous.map((row) => row.image_id),
    );
  });
}
export function listEntries(
  storage: DurableObjectStorage,
  viewer: string,
  scope: string,
  cursor?: [string, string],
): Entry[] {
  const clauses: string[] = [];
  const binds: (string | number)[] = [];
  if (scope === 'feed') {
    clauses.push('visibility = ?');
    binds.push('team');
  } else {
    clauses.push('user_id = ?');
    binds.push(scope === 'mine' ? viewer : scope.slice(5));
  }
  if (cursor) {
    clauses.push('(created_at < ? OR (created_at = ? AND id < ?))');
    binds.push(cursor[0], cursor[0], cursor[1]);
  }
  return storage.sql
    .exec<Row<Entry>>(
      `SELECT * FROM entries WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC,id DESC LIMIT ?`,
      ...binds,
      21,
    )
    .toArray();
}
export function userEntries(
  storage: DurableObjectStorage,
  user: string,
  start: string,
  end: string,
  _viewer = user,
) {
  return storage.sql
    .exec<Row<Entry>>(
      'SELECT * FROM entries WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date,created_at,id',
      user,
      start,
      end,
    )
    .toArray();
}
