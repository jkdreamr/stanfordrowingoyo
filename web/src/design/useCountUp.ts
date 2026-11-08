import { useEffect, useRef, useState } from 'react';

export function useCountUp(value: number, { duration = 700 } = {}) {
  const [current, setCurrent] = useState(0);
  const displayed = useRef(0);
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    if (reduced || duration <= 0 || !Number.isFinite(value)) return;
    let frame: number;
    let start: number | undefined;
    const from = displayed.current;
    const tick = (now: number) => {
      start ??= now;
      const progress = Math.min(1, (now - start) / duration);
      displayed.current =
        progress === 1 ? value : from + (value - from) * (1 - 2 ** (-10 * progress));
      setCurrent(displayed.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);
  return reduced || duration <= 0 || !Number.isFinite(value) ? value : current;
}
