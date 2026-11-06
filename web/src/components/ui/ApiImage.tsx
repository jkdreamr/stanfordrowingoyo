import { useEffect, useState } from 'react';
import { useImage } from '../../lib/queries';
export function ApiImage({
  imageId,
  alt,
  onError,
}: {
  imageId: string;
  alt: string;
  onError?: () => void;
}) {
  const query = useImage(imageId);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!query.data) return;
    const url = URL.createObjectURL(query.data);
    setUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [query.data]);
  useEffect(() => {
    if (query.isError) onError?.();
  }, [query.isError, onError]);
  return url ? (
    <img src={url} alt={alt} onError={onError} />
  ) : (
    <span className="photo-loading text-caption text-muted" role="img" aria-label={alt}>
      {query.isError ? 'Photo unavailable' : ''}
    </span>
  );
}
