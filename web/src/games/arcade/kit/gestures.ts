import { useEffect, useRef, type PointerEvent } from 'react';

export type ArcadeGesture = 'tap' | 'up' | 'down' | 'left' | 'right';
export function useGestures(onGesture: (gesture: ArcadeGesture) => void, enabled = true) {
  const active = useRef<{
    id: number;
    x: number;
    y: number;
    fired: boolean;
    target: HTMLElement;
  } | null>(null);
  const cancel = () => {
    const g = active.current;
    active.current = null;
    if (g?.target.hasPointerCapture?.(g.id)) g.target.releasePointerCapture(g.id);
  };
  useEffect(() => {
    if (!enabled) cancel();
    return cancel;
  }, [enabled]);
  return {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (!enabled || active.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      active.current = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        fired: false,
        target: e.currentTarget,
      };
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const g = active.current;
      if (!enabled || !g || g.id !== e.pointerId || g.fired) return;
      const dx = e.clientX - g.x,
        dy = e.clientY - g.y;
      if (Math.hypot(dx, dy) < 24) return;
      g.fired = true;
      onGesture(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    },
    onPointerUp(e: PointerEvent<HTMLElement>) {
      const g = active.current;
      if (!g || g.id !== e.pointerId) return;
      cancel();
      if (enabled && !g.fired) onGesture('tap');
    },
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
  };
}
