// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { usePhotos } from './usePhotos';
import { StrictMode } from 'react';
const { upload, resize } = vi.hoisted(() => ({ upload: vi.fn(), resize: vi.fn() }));
vi.mock('./queries', () => ({ useUploadImage: () => ({ mutateAsync: upload }) }));
vi.mock('./images', () => ({ resizeImage: resize }));
beforeEach(() => {
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() });
  upload.mockReset().mockResolvedValue({ id: 'uploaded' });
  resize.mockReset().mockResolvedValue(new Blob(['resized']));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('uploads processed blobs unchanged, caches retries and removes the draft', async () => {
  const { result, unmount } = renderHook(() => usePhotos([], 1));
  const blob = new Blob(['crop'], { type: 'image/webp' });
  act(() => result.current.addProcessed(blob));
  expect(result.current.photos[0].url).toBe('blob:preview');
  expect(await result.current.save()).toEqual(['uploaded']);
  expect(upload).toHaveBeenCalledWith({ body: blob });
  expect(resize).not.toHaveBeenCalled();
  expect(await result.current.save()).toEqual(['uploaded']);
  expect(upload).toHaveBeenCalledTimes(1);
  act(() => result.current.remove(result.current.photos[0].key));
  expect(await result.current.save()).toEqual([]);
  unmount();
  await Promise.resolve();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
});
it('keeps a processed draft intact after an upload error', async () => {
  const { result } = renderHook(() => usePhotos([], 1));
  const blob = new Blob(['crop']);
  act(() => result.current.addProcessed(blob));
  upload.mockRejectedValueOnce(new Error('Offline'));
  await expect(result.current.save()).rejects.toThrow('Offline');
  expect(result.current.photos[0].blob).toBe(blob);
  expect(await result.current.save()).toEqual(['uploaded']);
});
it('preserves existing ids and resizes files for session callers', async () => {
  const { result } = renderHook(() =>
    usePhotos([{ key: 'existing', id: 'existing', url: '/photo' }]),
  );
  const file = new File(['file'], 'photo.jpg', { type: 'image/jpeg' });
  act(() => result.current.add([file]));
  expect(await result.current.save()).toEqual(['existing', 'uploaded']);
  expect(resize).toHaveBeenCalledWith(file, 1600, false);
});
it('seeds restored photos, reuses uploaded ids and reports each new upload id', async () => {
  const blob = new Blob(['restored'], { type: 'image/png' });
  const { result } = renderHook(() =>
    usePhotos([
      { key: 'uploaded', url: '/api/images/existing', id: 'existing', blob },
      { key: 'pending', url: 'blob:restored', blob },
    ]),
  );
  await act(async () => expect(await result.current.save()).toEqual(['existing', 'uploaded']));
  expect(upload).toHaveBeenCalledTimes(1);
  expect(upload).toHaveBeenCalledWith({ body: blob });
  expect(result.current.photos[1].id).toBe('uploaded');
  await act(async () => expect(await result.current.save()).toEqual(['existing', 'uploaded']));
  expect(upload).toHaveBeenCalledTimes(1);
});
it('keeps restored previews alive through StrictMode effect replay', async () => {
  const { unmount } = renderHook(
    () => usePhotos([{ key: 'restored', url: 'blob:restored', blob: new Blob(['photo']) }]),
    { wrapper: StrictMode },
  );
  await Promise.resolve();
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  unmount();
  await Promise.resolve();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:restored');
});
