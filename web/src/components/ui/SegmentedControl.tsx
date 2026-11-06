import { useRef, type CSSProperties } from 'react';
export type Segment<T extends string> = { value: T; label: string; disabled?: boolean };
export type SegmentedControlProps<T extends string> = {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly Segment<T>[];
  size?: 'sm' | 'md' | 'lg';
};
export function SegmentedControl<T extends string>({
  label,
  value,
  onChange,
  options,
  size = 'md',
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = options.findIndex((o) => o.value === value);
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`ui-segments ui-segments-${size}`}
      style={{ '--count': options.length, '--selected': Math.max(0, selected) } as CSSProperties}
    >
      {selected >= 0 && <span className="ui-segment-thumb" aria-hidden="true" />}
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={o.disabled}
          tabIndex={
            i === (selected < 0 ? options.findIndex((x) => !x.disabled) : selected) ? 0 : -1
          }
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key))
              return;
            e.preventDefault();
            const enabled = options.map((x, n) => (x.disabled ? -1 : n)).filter((n) => n >= 0);
            if (!enabled.length) return;
            const position = enabled.indexOf(i);
            const next =
              e.key === 'Home'
                ? enabled[0]
                : e.key === 'End'
                  ? enabled.at(-1)!
                  : enabled[
                      (position +
                        (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) +
                        enabled.length) %
                        enabled.length
                    ];
            onChange(options[next].value);
            refs.current[next]?.focus();
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
