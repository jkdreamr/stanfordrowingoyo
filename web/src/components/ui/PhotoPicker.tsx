import { useId, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { ApiImage } from './ApiImage';
export function PhotoPicker({
  photos,
  onAdd,
  onRemove,
  max = 4,
  disabled = false,
}: {
  photos: { key: string; url: string; id?: string }[];
  onAdd: (files: File[]) => void;
  onRemove: (key: string) => void;
  max?: number;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const id = useId();
  return (
    <div className="space-y-3">
      <label htmlFor={id} className="block text-subhead">
        {max === 1 ? 'Profile Photo' : 'Photos'}
      </label>
      <input
        ref={ref}
        id={id}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={max > 1}
        disabled={disabled || (max > 1 && photos.length >= max)}
        onChange={(event) => {
          onAdd(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />
      <div className="photo-picker">
        {photos.map((photo, i) => (
          <div className="photo-thumb" key={photo.key}>
            {photo.id && !photo.url.startsWith('blob:') ? (
              <ApiImage imageId={photo.id} alt={`Selected photo ${i + 1}`} />
            ) : (
              <img src={photo.url} alt={`Selected photo ${i + 1}`} />
            )}
            <IconButton
              aria-label={`Remove Photo ${i + 1}`}
              disabled={disabled}
              onClick={() => onRemove(photo.key)}
            >
              <X size={20} strokeWidth={1.75} />
            </IconButton>
          </div>
        ))}
        {(max === 1 || photos.length < max) && (
          <Button
            variant="secondary"
            disabled={disabled}
            leading={<Plus size={20} strokeWidth={1.75} />}
            onClick={() => ref.current?.click()}
          >
            {max === 1 ? 'Change Photo' : 'Add Photos'}
          </Button>
        )}
      </div>
      <p className="text-footnote text-muted">
        {max === 1 ? 'Your photo is cropped to a square' : 'Up to 4 photos · JPEG, PNG or WebP'}
      </p>
    </div>
  );
}
