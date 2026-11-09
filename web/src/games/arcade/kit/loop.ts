import { useCallback, useEffect, useRef, useState } from 'react';

export const MAX_DT = 1 / 20;
export function useGameLoop(
  update: (dt: number, now: number) => void,
  render: () => void,
  { running }: { running: boolean },
): { invalidate: () => void } {
  const [visible, setVisible] = useState(() => !document.hidden);
  const callbacks = useRef({ update, render });
  callbacks.current = { update, render };
  const redraw = useRef(0);
  const invalidate = useCallback(() => {
    cancelAnimationFrame(redraw.current);
    redraw.current = requestAnimationFrame(() => callbacks.current.render());
  }, []);
  useEffect(() => {
    const change = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', change);
    window.addEventListener('resize', invalidate);
    return () => {
      document.removeEventListener('visibilitychange', change);
      window.removeEventListener('resize', invalidate);
      cancelAnimationFrame(redraw.current);
    };
  }, [invalidate]);
  useEffect(() => {
    if (!running || !visible) return;
    let frame = 0,
      last = -1;
    const tick = (now: number) => {
      if (document.hidden) return;
      const dt = last < 0 ? 0 : Math.min(Math.max(0, (now - last) / 1000), MAX_DT);
      last = now;
      callbacks.current.update(dt, now);
      callbacks.current.render();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, visible]);
  useEffect(() => {
    if (!running || !visible) invalidate();
  });
  return { invalidate };
}
