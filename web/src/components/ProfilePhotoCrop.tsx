import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Button, Sheet } from './ui';
import { clampCrop, coverScale, sourceRect, zoomAt, type Crop, type Point } from '../lib/crop';
import { decode, encodeCrop } from '../lib/images';
import { FormErrors } from './auth/FormErrors';

const size = 300;
const photoError = "Can't open this photo. Try a JPEG or PNG";
export function ProfilePhotoCrop({
  file,
  onCancel,
  onDone,
}: {
  file: File;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
}) {
  const [image, setImage] = useState<Awaited<ReturnType<typeof decode>>>();
  const [crop, setCrop] = useState<Crop>({ x: 0, y: 0, zoom: 1 });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  useEffect(() => {
    let active = true;
    let decoded: Awaited<ReturnType<typeof decode>> | undefined;
    if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) setError(photoError);
    else
      void decode(file)
        .then((result) => {
          decoded = result;
          if (active) setImage(result);
          else result.close();
        })
        .catch(() => {
          if (active) setError(photoError);
        });
    return () => {
      active = false;
      decoded?.close();
    };
  }, [file]);
  useEffect(() => {
    if (!image) return;
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    const scale = coverScale(image.width, image.height, size) * crop.zoom;
    context.clearRect(0, 0, size, size);
    context.drawImage(
      image.source,
      (size - image.width * scale) / 2 + crop.x,
      (size - image.height * scale) / 2 + crop.y,
      image.width * scale,
      image.height * scale,
    );
  }, [image, crop]);
  useEffect(() => {
    const element = viewport.current;
    if (!element || !image || busy) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      setCrop((current) =>
        zoomAt(
          image.width,
          image.height,
          size,
          current,
          current.zoom * Math.exp(-event.deltaY * 0.002),
          {
            x: ((event.clientX - rect.left) * size) / rect.width - size / 2,
            y: ((event.clientY - rect.top) * size) / rect.height - size / 2,
          },
        ),
      );
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [image, busy]);
  function point(event: PointerEvent<HTMLDivElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * size) / rect.width - size / 2,
      y: ((event.clientY - rect.top) * size) / rect.height - size / 2,
    };
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!image || busy || !pointers.current.has(event.pointerId)) return;
    const before = [...pointers.current.values()];
    pointers.current.set(event.pointerId, point(event));
    const after = [...pointers.current.values()];
    const center = (points: Point[]) => ({
      x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
    });
    const a = center(before),
      b = center(after);
    setCrop((current) => {
      const distance = (points: Point[]) =>
        Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const zoomed =
        before.length === 2 && distance(before) > 0
          ? zoomAt(
              image.width,
              image.height,
              size,
              current,
              (current.zoom * distance(after)) / distance(before),
              a,
            )
          : current;
      return clampCrop(image.width, image.height, size, {
        ...zoomed,
        x: zoomed.x + b.x - a.x,
        y: zoomed.y + b.y - a.y,
      });
    });
  }
  async function done() {
    if (!image || busy) return;
    setBusy(true);
    try {
      onDone(await encodeCrop(image, sourceRect(image.width, image.height, size, crop)));
    } catch {
      setError("Can't process this photo. Try another photo");
      setBusy(false);
    }
  }
  return (
    <Sheet
      open
      onClose={() => {
        if (!busy) onCancel();
      }}
      title="Move and Scale"
      footer={
        <div className="profile-photo-actions">
          <Button variant="secondary" fullWidth disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button fullWidth disabled={!image} loading={busy} onClick={() => void done()}>
            Done
          </Button>
        </div>
      }
    >
      <div className="profile-photo-crop">
        <FormErrors message={error} />
        <div
          ref={viewport}
          className="profile-photo-viewport"
          role="group"
          aria-label="Photo crop. Use arrow keys to move the photo"
          tabIndex={0}
          onPointerDown={(event) => {
            if (busy || pointers.current.size >= 2) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            pointers.current.set(event.pointerId, point(event));
          }}
          onPointerMove={move}
          onPointerUp={(event) => pointers.current.delete(event.pointerId)}
          onPointerCancel={(event) => pointers.current.delete(event.pointerId)}
          onLostPointerCapture={(event) => pointers.current.delete(event.pointerId)}
          onKeyDown={(event) => {
            if (!image || busy) return;
            const delta = {
              ArrowLeft: [-10, 0],
              ArrowRight: [10, 0],
              ArrowUp: [0, -10],
              ArrowDown: [0, 10],
            }[event.key];
            if (!delta) return;
            event.preventDefault();
            setCrop((current) =>
              clampCrop(image.width, image.height, size, {
                ...current,
                x: current.x + delta[0],
                y: current.y + delta[1],
              }),
            );
          }}
        >
          <canvas ref={canvas} width={size} height={size} aria-label="Photo preview" role="img" />
          <svg viewBox="0 0 300 300" aria-hidden="true">
            <path
              d="M0 0H300V300H0Z M150 0A150 150 0 1 0 150 300A150 150 0 1 0 150 0Z"
              fill="black"
              fillOpacity="0.65"
              fillRule="evenodd"
            />
            <circle
              cx="150"
              cy="150"
              r="149.5"
              fill="none"
              stroke="white"
              strokeOpacity="0.6"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
        <label className="profile-photo-zoom">
          Zoom
          <input
            type="range"
            min="1"
            max="4"
            step="0.01"
            value={crop.zoom}
            disabled={!image || busy}
            onChange={(event) => {
              if (image)
                setCrop((current) =>
                  zoomAt(image.width, image.height, size, current, Number(event.target.value), {
                    x: 0,
                    y: 0,
                  }),
                );
            }}
          />
        </label>
      </div>
    </Sheet>
  );
}
