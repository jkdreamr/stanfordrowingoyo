import { useState, type CSSProperties } from 'react';
import { ApiImage } from './ApiImage';
export function Avatar({
  name,
  imageId,
  src,
  size = 'md',
}: {
  name: string;
  imageId?: string | null;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'feed';
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const image = src || imageId;
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join('') || '?';
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <span
      role="img"
      aria-label={name}
      className={`ui-avatar ui-avatar-${size}`}
      style={{ '--avatar-hue': [205, 155, 265, 85, 185, 295][hash % 6] } as CSSProperties}
    >
      {src && failed !== src ? (
        <img src={src} alt="" onError={() => setFailed(src)} />
      ) : !src && image && failed !== image ? (
        <ApiImage imageId={image} alt="" onError={() => setFailed(image)} />
      ) : (
        initials
      )}
    </span>
  );
}
