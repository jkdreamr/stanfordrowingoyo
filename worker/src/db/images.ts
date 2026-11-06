import type { ImageMetadata } from '../../../shared/types';
import type { Row } from './row';
export type ImageRow = Row<ImageMetadata> & { bytes: ArrayBuffer };
export function findImage(storage: DurableObjectStorage, id: string) {
  return storage.sql.exec<ImageRow>('SELECT * FROM images WHERE id = ?', id).toArray()[0];
}
export function hiddenImage(storage: DurableObjectStorage, id: string, viewer: string) {
  return !!storage.sql
    .exec(
      'SELECT e.id FROM entries e JOIN entry_images ei ON ei.entry_id = e.id WHERE ei.image_id = ? AND e.visibility = ? AND e.user_id != ?',
      id,
      'private',
      viewer,
    )
    .toArray()[0];
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
