import { useState } from 'react';
import { ApiImage } from './ApiImage';
export function Avatar({
  name,
  imageId,
  size = 'md',
}: {
  name: string;
  imageId?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [failed, setFailed] = useState<string | null>(null);
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
      style={{ backgroundColor: `hsl(240 5% ${80 + (hash % 10)}%)` }}
    >
      {imageId && failed !== imageId ? (
        <ApiImage imageId={imageId} alt="" onError={() => setFailed(imageId)} />
      ) : (
        initials
      )}
    </span>
  );
}
