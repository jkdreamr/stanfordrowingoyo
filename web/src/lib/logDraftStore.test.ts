import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  clearLogDrafts,
  deleteLogDraft,
  loadLogDraft,
  mirrorLogDraft,
  saveLogDraft,
  restorePhotos,
  type StoredLogDraft,
} from './logDraftStore';
import { logDraft } from './logForm';

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  const entries = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
    key: (index: number) => [...entries.keys()][index] ?? null,
    get length() {
      return entries.size;
    },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function value(): StoredLogDraft {
  return {
    draft: { ...logDraft('2026-11-07'), distance: '12000' },
    details: true,
    tagged: [],
    photos: [
      {
        key: 'photo',
        blob: new Blob(['photo'], { type: 'image/png' }),
        name: 'row.png',
        type: 'image/png',
        id: 'uploaded',
      },
    ],
    idempotencyKey: 'persisted-key',
    savedAt: Date.now(),
  };
}
it('round-trips fields, blobs, names and uploaded ids independently per user', async () => {
  const draft = value();
  await saveLogDraft('a', draft);
  await saveLogDraft('b', { ...draft, idempotencyKey: 'other-key' });
  const restored = await loadLogDraft('a');
  expect(restored?.draft).toEqual(draft.draft);
  expect(restored?.idempotencyKey).toBe('persisted-key');
  expect(restored?.details).toBe(true);
  expect(restored?.photos[0]).toMatchObject({ name: 'row.png', type: 'image/png', id: 'uploaded' });
  expect(await restored?.photos[0].blob?.text()).toBe('photo');
  expect((await loadLogDraft('b'))?.idempotencyKey).toBe('other-key');
  await deleteLogDraft('a');
  expect(await loadLogDraft('a')).toBeNull();
  expect(await loadLogDraft('b')).not.toBeNull();
  await clearLogDrafts();
  expect(await loadLogDraft('b')).toBeNull();
});
it('drops drafts older than fourteen days', async () => {
  const draft = value();
  await saveLogDraft('a', draft);
  expect(await loadLogDraft('a', draft.savedAt + 14 * 86400000)).not.toBeNull();
  expect(await loadLogDraft('a', draft.savedAt + 14 * 86400000 + 1)).toBeNull();
  expect(await loadLogDraft('a')).toBeNull();
});
it('retries without photos after quota failure', async () => {
  const put = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
    this: IDBObjectStore,
    ...args: Parameters<typeof put>
  ) {
    if ((args[0] as StoredLogDraft).photos.length)
      throw new DOMException('Quota', 'QuotaExceededError');
    return put.apply(this, args);
  });
  await saveLogDraft('a', value());
  expect(await loadLogDraft('a')).toMatchObject({ photos: [], idempotencyKey: 'persisted-key' });
});
it('restores text from the synchronous mirror when IndexedDB is unavailable or writes fail', async () => {
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
    throw new Error('Unavailable');
  });
  await expect(saveLogDraft('a', value())).resolves.toBeUndefined();
  expect(await loadLogDraft('a')).toMatchObject({ draft: value().draft, photos: [] });
  vi.stubGlobal('indexedDB', undefined);
  await expect(saveLogDraft('a', value())).resolves.toBeUndefined();
  expect(await loadLogDraft('a')).toMatchObject({ draft: value().draft, photos: [] });
  await expect(deleteLogDraft('a')).resolves.toBeUndefined();
  await expect(clearLogDrafts()).resolves.toBeUndefined();
  expect(await loadLogDraft('a')).toBeNull();
});
it('chooses the newer mirror and keeps only its matching IndexedDB photos', async () => {
  const older = value();
  await saveLogDraft('a', older);
  mirrorLogDraft('a', {
    ...older,
    draft: { ...older.draft, notes: 'Last edit' },
    savedAt: older.savedAt + 1,
  });
  const restored = await loadLogDraft('a');
  expect(restored?.draft.notes).toBe('Last edit');
  expect(await restored?.photos[0].blob?.text()).toBe('photo');
  expect(localStorage.getItem(localStorage.key(0)!)).not.toContain('blob');
  mirrorLogDraft('a', { ...older, photos: [], savedAt: older.savedAt + 2 });
  expect((await loadLogDraft('a'))?.photos).toEqual([]);
  expect(await loadLogDraft('b')).toBeNull();
});
it('chooses a newer IndexedDB draft over an older mirror', async () => {
  const newer = value();
  newer.draft.notes = 'Newest IDB edit';
  await saveLogDraft('a', newer);
  mirrorLogDraft('a', {
    ...newer,
    draft: { ...newer.draft, notes: 'Older mirror' },
    savedAt: newer.savedAt - 1,
  });
  expect((await loadLogDraft('a'))?.draft.notes).toBe('Newest IDB edit');
});
it('clears mirrors synchronously on discard and logout without clearing unrelated storage', async () => {
  await saveLogDraft('a', value());
  await saveLogDraft('b', value());
  localStorage.setItem('theme', 'dark');
  const deletion = deleteLogDraft('a');
  expect(localStorage.getItem('oyo-log-draft:a')).toBeNull();
  expect(localStorage.getItem('oyo-log-draft:b')).not.toBeNull();
  await deletion;
  const clearing = clearLogDrafts();
  expect(localStorage.getItem('oyo-log-draft:b')).toBeNull();
  expect(localStorage.getItem('theme')).toBe('dark');
  await clearing;
  expect(await loadLogDraft('b')).toBeNull();
});
it('ignores malformed mirrors and fails soft when both storage APIs are unavailable', async () => {
  localStorage.setItem('oyo-log-draft:a', '{bad json');
  expect(await loadLogDraft('a')).toBeNull();
  vi.stubGlobal('localStorage', {
    getItem() {
      throw new Error('Denied');
    },
    setItem() {
      throw new Error('Denied');
    },
  });
  vi.stubGlobal('indexedDB', undefined);
  await expect(saveLogDraft('a', value())).resolves.toBeUndefined();
  expect(await loadLogDraft('a')).toBeNull();
  await expect(deleteLogDraft('a')).resolves.toBeUndefined();
  await expect(clearLogDrafts()).resolves.toBeUndefined();
});
it('restores file names and usable local previews while retaining uploaded ids', () => {
  const restored = restorePhotos(value().photos);
  expect(restored[0].url).toMatch(/^blob:/);
  expect(restored[0].file?.name).toBe('row.png');
  expect(restored[0].file?.type).toBe('image/png');
  expect(restored[0].id).toBe('uploaded');
  URL.revokeObjectURL(restored[0].url);
});
it('materializes stored photo bytes before handing them to previews and uploads', async () => {
  await saveLogDraft('a', value());
  const read = vi.spyOn(Blob.prototype, 'arrayBuffer');
  const restored = await loadLogDraft('a');
  expect(read).toHaveBeenCalledOnce();
  expect(await restored?.photos[0].blob?.text()).toBe('photo');
  read.mockRejectedValue(new Error('Unreadable photo'));
  expect(await loadLogDraft('a')).toMatchObject({
    draft: value().draft,
    photos: [],
    idempotencyKey: 'persisted-key',
  });
});
