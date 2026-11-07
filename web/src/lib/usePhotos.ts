import { useEffect, useRef, useState } from 'react';
import { resizeImage } from './images';
import { useUploadImage } from './queries';
export type DraftPhoto = { key: string; url: string; file?: File; id?: string };
export function usePhotos(initial: DraftPhoto[], max = 4) {
  const [photos, setPhotos] = useState(initial);
  const urls = useRef(new Set<string>());
  const cache = useRef(new Map<File, string>());
  const upload = useUploadImage();
  useEffect(
    () => () => {
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
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
  async function save(maxSide = 1600, square = false) {
    const ids: string[] = [];
    for (const photo of photos) {
      let id = photo.id ?? (photo.file ? cache.current.get(photo.file) : undefined);
      if (!id && photo.file) {
        const blob = await resizeImage(photo.file, maxSide, square);
        id = (await upload.mutateAsync({ body: blob })).id;
        cache.current.set(photo.file, id);
      }
      if (id) ids.push(id);
    }
    return ids;
  }
  return { photos, add, remove, save };
}
