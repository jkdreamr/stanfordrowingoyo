import { useEffect, useRef, useState } from 'react';
import { resizeImage } from './images';
import { useUploadImage } from './queries';
export type DraftPhoto = { key: string; url: string; file?: File; blob?: Blob; id?: string };
export function usePhotos(initial: DraftPhoto[], max = 4) {
  const [photos, setPhotos] = useState(initial);
  const urls = useRef(new Set(initial.filter((p) => p.url.startsWith('blob:')).map((p) => p.url)));
  const cache = useRef(new Map<Blob, string>());
  const upload = useUploadImage();
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (!mounted.current) urls.current.forEach((url) => URL.revokeObjectURL(url));
      });
    };
  }, []);
  function add(files: File[]) {
    setPhotos((current) => {
      const retained = max === 1 && files.length ? [] : current;
      const next = files.slice(0, max - retained.length).map((file) => {
        const url = URL.createObjectURL(file);
        urls.current.add(url);
        return { file, url, key: url };
      });
      return [...retained, ...next];
    });
  }
  function remove(key: string) {
    setPhotos((current) => current.filter((p) => p.key !== key));
  }
  function addProcessed(blob: Blob) {
    const url = URL.createObjectURL(blob);
    urls.current.add(url);
    setPhotos((current) => [
      ...(max === 1 ? [] : current).slice(0, max - 1),
      { blob, url, key: url },
    ]);
  }
  async function save(maxSide = 1600, square = false) {
    const ids: string[] = [];
    for (const photo of photos) {
      const source = photo.blob ?? photo.file;
      let id = photo.id ?? (source ? cache.current.get(source) : undefined);
      if (!id && source) {
        const blob = photo.blob ?? (await resizeImage(photo.file!, maxSide, square));
        id = (await upload.mutateAsync({ body: blob })).id;
        cache.current.set(source, id);
        photo.id = id;
        setPhotos((current) => current.map((p) => (p.key === photo.key ? { ...p, id } : p)));
      }
      if (id) ids.push(id);
    }
    return ids;
  }
  function reset(next: DraftPhoto[] = []) {
    setPhotos(next);
  }
  return { photos, add, addProcessed, remove, save, reset };
}
