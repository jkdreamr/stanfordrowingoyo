import type { PublicUser } from '../../../shared/types';
import type { LogDraft } from './logForm';
import type { DraftPhoto } from './usePhotos';

export type StoredPhoto = { key: string; blob?: Blob; name?: string; type?: string; id?: string };
export type StoredLogDraft = {
  draft: LogDraft;
  details: boolean;
  tagged: PublicUser[];
  photos: StoredPhoto[];
  idempotencyKey: string;
  submitted?: boolean;
  savedAt: number;
};
const database = 'oyo-log-drafts';
const table = 'drafts';
let pending: Promise<unknown> = Promise.resolve();
function serial<T>(operation: () => Promise<T>): Promise<T> {
  const next = pending.then(operation, operation);
  pending = next.catch(() => undefined);
  return next;
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    const timer = setTimeout(() => reject(new Error('Storage unavailable')), 1000);
    request.onupgradeneeded = () => request.result.createObjectStore(table);
    request.onerror = () => {
      clearTimeout(timer);
      reject(request.error);
    };
    request.onblocked = () => {
      clearTimeout(timer);
      reject(new Error('Storage blocked'));
    };
    request.onsuccess = () => {
      clearTimeout(timer);
      resolve(request.result);
    };
  });
}
async function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(table, mode);
      const request = action(tx.objectStore(table));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export function saveLogDraft(userId: string, value: StoredLogDraft): Promise<void> {
  return serial(async () => {
    try {
      await transact('readwrite', (store) => store.put(value, userId));
    } catch {
      try {
        await transact('readwrite', (store) => store.put({ ...value, photos: [] }, userId));
      } catch {
        /* Draft storage is best effort. */
      }
    }
  });
}
export function loadLogDraft(userId: string, now = Date.now()): Promise<StoredLogDraft | null> {
  return serial(async () => {
    try {
      const value = await transact<StoredLogDraft | undefined>('readonly', (store) =>
        store.get(userId),
      );
      if (!value) return null;
      if (
        !Number.isFinite(value.savedAt) ||
        now - value.savedAt > 14 * 86400000 ||
        !value.draft ||
        !Array.isArray(value.photos) ||
        !Array.isArray(value.tagged) ||
        typeof value.idempotencyKey !== 'string'
      ) {
        await transact('readwrite', (store) => store.delete(userId));
        return null;
      }
      const photos = await Promise.all(
        value.photos.map(async (photo) =>
          photo.blob
            ? {
                ...photo,
                blob: new Blob([await photo.blob.arrayBuffer()], { type: photo.blob.type }),
              }
            : photo,
        ),
      ).catch(() => []);
      return { ...value, photos };
    } catch {
      return null;
    }
  });
}
export function deleteLogDraft(userId: string): Promise<void> {
  return serial(async () => {
    try {
      await transact('readwrite', (store) => store.delete(userId));
    } catch {
      /* Best effort. */
    }
  });
}
export function clearLogDrafts(): Promise<void> {
  return serial(async () => {
    try {
      await transact('readwrite', (store) => store.clear());
    } catch {
      /* Best effort. */
    }
  });
}
export function storePhotos(photos: DraftPhoto[]): StoredPhoto[] {
  return photos.map((photo) => ({
    key: photo.key,
    blob: photo.blob ?? photo.file,
    name: photo.file?.name,
    type: (photo.blob ?? photo.file)?.type,
    id: photo.id,
  }));
}
export function restorePhotos(photos: StoredPhoto[]): DraftPhoto[] {
  return photos.map((photo) => {
    const source = photo.blob;
    const url = source
      ? URL.createObjectURL(source)
      : `/api/images/${encodeURIComponent(photo.id ?? '')}`;
    return {
      key: photo.key,
      url,
      id: photo.id,
      ...(source
        ? photo.name
          ? { file: new File([source], photo.name, { type: photo.type ?? source.type }) }
          : { blob: source }
        : {}),
    };
  });
}
