import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { ImageMetadata } from '../../../../shared/types';
import { ApiImage, IconButton } from '../ui';

export function PhotoViewer({
  images,
  index,
  alt,
  onClose,
}: {
  images: ImageMetadata[];
  index: number;
  alt: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(index);
  const move = (next: number) => {
    const slide = Math.max(0, Math.min(images.length - 1, next));
    setCurrent(slide);
    if (track.current) track.current.scrollLeft = slide * track.current.clientWidth;
  };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const modal = dialog.current;
    document.body.style.overflow = 'hidden';
    modal?.showModal();
    counter.current?.focus({ preventScroll: true });
    if (track.current) track.current.scrollLeft = index * track.current.clientWidth;
    return () => {
      document.body.style.overflow = overflow;
      if (modal?.open) modal.close();
      previous?.focus({ preventScroll: true });
    };
  }, [index]);
  return (
    <dialog
      ref={dialog}
      className="social-viewer"
      aria-label="Workout Photos"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={(event) => {
        if (!event.currentTarget.open) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          move(current + (e.key === 'ArrowLeft' ? -1 : 1));
        }
      }}
    >
      <div className="social-viewer-toolbar">
        <span ref={counter} tabIndex={-1} className="focus:outline-none" role="status">
          {images.length ? current + 1 : 0} of {images.length}
        </span>
        <div className="flex items-center gap-1">
          <IconButton
            aria-label="Previous Photo"
            style={{ visibility: current === 0 ? 'hidden' : 'visible' }}
            onClick={() => move(current - 1)}
          >
            <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
          </IconButton>
          <IconButton
            aria-label="Next Photo"
            style={{ visibility: current >= images.length - 1 ? 'hidden' : 'visible' }}
            onClick={() => move(current + 1)}
          >
            <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
          </IconButton>
          <IconButton aria-label="Close" onClick={onClose}>
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </IconButton>
        </div>
      </div>
      <div
        ref={track}
        className="social-photo-track social-viewer-track"
        onScroll={(e) => {
          if (e.currentTarget.clientWidth)
            setCurrent(
              Math.max(
                0,
                Math.min(
                  images.length - 1,
                  Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth),
                ),
              ),
            );
        }}
      >
        {images.map((image, i) => (
          <ZoomPhoto
            key={`${image.id}:${i}:${i === current}`}
            image={image}
            alt={`${alt}, photo ${i + 1}`}
          />
        ))}
      </div>
    </dialog>
  );
}

function ZoomPhoto({ image, alt }: { image: ImageMetadata; alt: string }) {
  const [zoom, setZoom] = useState({ scale: 1, x: 0, y: 0 });
  const points = useRef(new Map<number, { x: number; y: number }>());
  const distance = useRef(0);
  const tap = useRef(0);
  const pointerType = useRef('');
  const gesture = useRef({ x: 0, y: 0, moved: false, pinched: false });
  const toggle = () => setZoom((z) => ({ scale: z.scale === 1 ? 2 : 1, x: 0, y: 0 }));
  return (
    <div
      className="social-zoom-slide"
      onDoubleClick={() => {
        if (pointerType.current !== 'touch') toggle();
      }}
      onPointerDown={(e) => {
        pointerType.current = e.pointerType;
        if (points.current.size === 0)
          gesture.current = { x: e.clientX, y: e.clientY, moved: false, pinched: false };
        points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (zoom.scale > 1) e.currentTarget.setPointerCapture(e.pointerId);
        const p = [...points.current.values()];
        if (p.length === 2) {
          gesture.current.pinched = true;
          distance.current = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        }
      }}
      onPointerMove={(e) => {
        const old = points.current.get(e.pointerId);
        if (!old) return;
        if (Math.hypot(e.clientX - gesture.current.x, e.clientY - gesture.current.y) > 10)
          gesture.current.moved = true;
        points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const p = [...points.current.values()];
        if (p.length === 2) {
          const next = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
          if (distance.current > 0)
            setZoom((z) => ({
              ...z,
              scale: Math.min(4, Math.max(1, (z.scale * next) / distance.current)),
            }));
          distance.current = next;
        } else if (zoom.scale > 1)
          setZoom((z) => ({ ...z, x: z.x + e.clientX - old.x, y: z.y + e.clientY - old.y }));
      }}
      onPointerUp={(e) => {
        points.current.delete(e.pointerId);
        if (gesture.current.moved || gesture.current.pinched) {
          tap.current = 0;
          return;
        }
        if (e.pointerType === 'touch' && Date.now() - tap.current < 280) {
          toggle();
          tap.current = 0;
        } else tap.current = Date.now();
      }}
      onPointerCancel={(e) => points.current.delete(e.pointerId)}
    >
      <div
        className="social-zoom-image"
        style={{
          transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
          touchAction: zoom.scale > 1 ? 'none' : 'pan-x',
        }}
      >
        <ApiImage imageId={image.id} alt={alt} draggable={false} />
      </div>
    </div>
  );
}
