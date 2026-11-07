import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';

const delay = 280;
export function useDoubleTap(onDoubleTap: (x: number, y: number) => void) {
  const pending = useRef<{
    x: number;
    y: number;
    at: number;
    single: () => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  const pointer = useRef<{ id: number; x: number; y: number }>();
  const blocked = useRef(false);
  const cancel = () => {
    clearTimeout(pending.current?.timer);
    pending.current = undefined;
  };
  useEffect(() => () => clearTimeout(pending.current?.timer), []);
  return {
    cancel,
    onPointerDown(event: PointerEvent) {
      blocked.current = event.button !== 0 || event.isPrimary === false;
      if (blocked.current) {
        pointer.current = undefined;
        cancel();
      } else pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    },
    onPointerMove(event: PointerEvent) {
      const start = pointer.current;
      if (
        start &&
        start.id === event.pointerId &&
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10
      ) {
        blocked.current = true;
        cancel();
      }
    },
    onPointerCancel() {
      blocked.current = true;
      pointer.current = undefined;
      cancel();
    },
    click(event: MouseEvent, single: () => void) {
      if (blocked.current || window.getSelection()?.toString().trim()) {
        cancel();
        return;
      }
      if (
        event.detail === 0 ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        cancel();
        single();
        return;
      }
      const { clientX: x, clientY: y } = event;
      const previous = pending.current;
      cancel();
      if (
        previous &&
        Date.now() - previous.at <= delay &&
        Math.hypot(x - previous.x, y - previous.y) <= 24
      ) {
        onDoubleTap(x, y);
        return;
      }
      previous?.single();
      pending.current = {
        x,
        y,
        at: Date.now(),
        single,
        timer: setTimeout(() => {
          pending.current = undefined;
          single();
        }, delay),
      };
    },
  };
}
