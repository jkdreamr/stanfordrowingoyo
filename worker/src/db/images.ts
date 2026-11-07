import type { ImageMetadata } from '../../../shared/types';
import type { Row } from './row';
export type ImageRow = Row<ImageMetadata> & { bytes: ArrayBuffer };
export function findImage(storage: DurableObjectStorage, id: string) {
  return storage.sql.exec<ImageRow>('SELECT * FROM images WHERE id = ?', id).toArray()[0];
}
export function visibleImage(storage: DurableObjectStorage, id: string, viewer: string) {
  return !!storage.sql
    .exec(
      'SELECT i.id FROM images i WHERE i.id = ? AND (i.owner_id = ? OR EXISTS (SELECT 1 FROM users u WHERE u.avatar_image_id = i.id) OR EXISTS (SELECT 1 FROM entry_images ei JOIN entries e ON e.id = ei.entry_id WHERE ei.image_id = i.id AND (e.visibility != ? OR e.user_id = ?)))',
      id,
      viewer,
      'private',
      viewer,
    )
    .toArray()[0];
}
export function deleteUnreferencedImages(storage: DurableObjectStorage, ids: string[]) {
  if (!ids.length) return;
  storage.sql.exec(
    `DELETE FROM images WHERE id IN (${ids.map(() => '?').join(',')}) AND NOT EXISTS (SELECT 1 FROM entry_images ei WHERE ei.image_id = images.id) AND NOT EXISTS (SELECT 1 FROM users u WHERE u.avatar_image_id = images.id)`,
    ...ids,
  );
}
export function insertImage(
  storage: DurableObjectStorage,
  image: ImageMetadata,
  bytes: ArrayBuffer,
) {
  storage.sql.exec(
    'INSERT INTO images VALUES (?,?,?,?,?,?,?)',
    image.id,
    image.owner_id,
    image.mime,
    image.width,
    image.height,
    bytes,
    image.created_at,
  );
}
