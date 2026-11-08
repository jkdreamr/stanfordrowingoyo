import { useEffect, useRef } from 'react';
import { afterLaunch, lastShown, prefersReducedMotion, remember } from '../../lib/motion';

/**
 * Counts a figure up to `value` with an expo-out curve. With an `id`, the first view in a
 * session counts from `from` (default 0) and later visits start where the figure last
 * settled, so only real changes animate.
 */
export function Ticker({
  value,
  format,
  from,
  id,
  duration = 900,
  className,
}: {
  value: number;
  format: (value: number) => string;
  from?: number;
  id?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(from ?? lastShown(id) ?? 0);
  const formatRef = useRef(format);
  formatRef.current = format;
  const initial = useRef(prefersReducedMotion() ? value : shown.current);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const start = shown.current;
    remember(id, value);
    if (start === value || prefersReducedMotion()) {
      shown.current = value;
      node.textContent = formatRef.current(value);
      return;
    }
    let frame = 0;
    const cancel = afterLaunch((began) => {
      const step = (now: number) => {
        const progress = Math.min(1, Math.max(0, (now - began) / duration));
        shown.current = start + (value - start) * (1 - (1 - progress) ** 4);
        node.textContent = formatRef.current(progress === 1 ? value : shown.current);
        if (progress < 1) frame = requestAnimationFrame(step);
      };
      step(began);
    });
    return () => {
      cancel();
      cancelAnimationFrame(frame);
    };
  }, [value, duration, id]);
  // The figure counts inside a grid cell sized by invisible copies of its start and final
  // values, so the layout never reflows while it counts.
  return (
    <span className={className}>
      <span className="ticker-figure" aria-hidden="true">
        <span ref={ref}>{format(initial.current)}</span>
        <span className="ticker-reserve">{format(shown.current)}</span>
        <span className="ticker-reserve">{format(value)}</span>
      </span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
