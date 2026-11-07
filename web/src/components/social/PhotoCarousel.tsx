import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ImageMetadata } from '../../../../shared/types';
import { ApiImage, IconButton } from '../ui';
import { PhotoViewer } from './PhotoViewer';
const positions = new Map<string, number>();

export function PhotoCarousel({
  images,
  alt,
  onPhotoClick,
}: {
  images: ImageMetadata[];
  alt: string;
  onPhotoClick?: (event: MouseEvent<HTMLButtonElement>, open: () => void) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const key = images.map((image) => image.id).join(':');
  const [index, setIndex] = useState(() => positions.get(key) ?? 0);
  useEffect(() => {
    if (track.current)
      track.current.scrollLeft = (positions.get(key) ?? 0) * track.current.clientWidth;
  }, [key]);
  const [viewing, setViewing] = useState<number | null>(null);
  const move = (next: number) =>
    track.current?.scrollTo({
      left: next * track.current.clientWidth,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  return (
    <div className="social-carousel">
      <div
        ref={track}
        className="social-photo-track"
        onScroll={(e) => {
          const next = Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth);
          setIndex(next);
          positions.set(key, next);
        }}
      >
        {images.map((image, i) => (
          <button
            key={`${image.id}:${i}`}
            className="social-photo-slide"
            type="button"
            aria-label={`Open Photo ${i + 1}`}
            onClick={(event) => {
              const button = event.currentTarget;
              const open = () => {
                button.focus({ preventScroll: true });
                setViewing(i);
              };
              if (onPhotoClick) onPhotoClick(event, open);
              else open();
            }}
          >
            <ApiImage
              imageId={image.id}
              alt={`${alt}, photo ${i + 1}`}
              loading={i === 0 ? 'eager' : 'lazy'}
              draggable={false}
            />
          </button>
        ))}
      </div>
      {images.length > 1 && (
        <>
          <div className="social-photo-controls">
            <IconButton
              aria-label="Previous Photo"
              style={{ visibility: index === 0 ? 'hidden' : 'visible' }}
              disabled={index === 0}
              onClick={() => move(index - 1)}
            >
              <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
            </IconButton>
            <IconButton
              aria-label="Next Photo"
              style={{ visibility: index === images.length - 1 ? 'hidden' : 'visible' }}
              disabled={index === images.length - 1}
              onClick={() => move(index + 1)}
            >
              <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
            </IconButton>
          </div>
          <div className="flex justify-center gap-2 py-3" aria-hidden="true">
            {images.map((image, i) => (
              <span
                key={`${image.id}:${i}`}
                className={`h-2 w-2 rounded-full ${i === index ? 'bg-accent' : 'bg-divider'}`}
              />
            ))}
          </div>
        </>
      )}
      <span className="sr-only" role="status">
        Photo {index + 1} of {images.length}
      </span>
      {viewing !== null && (
        <PhotoViewer images={images} index={viewing} alt={alt} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}
