import { useEffect, useRef } from 'react';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function Ticker({
  value,
  format,
  from = 0,
  duration = 900,
  className,
}: {
  value: number;
  format: (value: number) => string;
  from?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(from);
  const formatRef = useRef(format);
  formatRef.current = format;
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const start = shown.current;
    if (start === value || reduced()) {
      shown.current = value;
      node.textContent = formatRef.current(value);
      return;
    }
    let frame = 0;
    const began = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - began) / duration);
      shown.current = start + (value - start) * (1 - (1 - progress) ** 4);
      node.textContent = formatRef.current(progress === 1 ? value : shown.current);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return (
    <span className={className}>
      <span ref={ref} aria-hidden="true">
        {format(reduced() ? value : from)}
      </span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
