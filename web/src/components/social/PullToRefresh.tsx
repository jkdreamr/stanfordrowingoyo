import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

export function PullToRefresh({
  onRefresh,
  children,
  label = 'Feed',
  className,
}: {
  onRefresh: () => Promise<unknown>;
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState(false);
  useEffect(() => {
    let start: { x: number; y: number } | null = null;
    let distance = 0;
    let pending = false;
    const element = root.current!;
    const reset = () => {
      start = null;
      distance = 0;
      setOffset(0);
    };
    const begin = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (
        pending ||
        e.touches.length !== 1 ||
        window.scrollY !== 0 ||
        document.querySelector('dialog[open]') ||
        target.closest('input, textarea, select, .social-photo-track')
      )
        return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const move = (e: TouchEvent) => {
      if (!start) return;
      if (
        e.touches.length !== 1 ||
        window.scrollY !== 0 ||
        document.querySelector('dialog[open]')
      ) {
        reset();
        return;
      }
      const dy = e.touches[0].clientY - start.y;
      const dx = Math.abs(e.touches[0].clientX - start.x);
      if (dx > 10 && dx > dy) {
        reset();
        return;
      }
      if (dy > 10 && dy > dx) {
        distance = Math.min(72, dy * 0.4);
        setOffset(distance);
      }
    };
    const end = () => {
      const armed =
        distance >= 56 && window.scrollY === 0 && !document.querySelector('dialog[open]');
      reset();
      if (!armed || pending) return;
      pending = true;
      setBusy(true);
      setUpdated(false);
      void refresh
        .current()
        .then(() => setUpdated(true))
        .catch(() => {})
        .finally(() => {
          pending = false;
          setBusy(false);
        });
    };
    element.addEventListener('touchstart', begin, { passive: true });
    element.addEventListener('touchmove', move, { passive: true });
    element.addEventListener('touchend', end, { passive: true });
    element.addEventListener('touchcancel', reset, { passive: true });
    return () => {
      element.removeEventListener('touchstart', begin);
      element.removeEventListener('touchmove', move);
      element.removeEventListener('touchend', end);
      element.removeEventListener('touchcancel', reset);
    };
  }, []);
  return (
    <div ref={root} className={className}>
      <div className="social-refresh-slot">
        <span
          className="social-refresh-indicator"
          style={{ transform: `translateY(${offset}px)`, opacity: offset || busy ? 1 : 0 }}
        >
          <RefreshCw size={20} strokeWidth={1.75} aria-hidden="true" />
          <span className="sr-only">{offset >= 56 ? 'Release to refresh' : 'Pull to refresh'}</span>
        </span>
      </div>
      <span role="status" className="sr-only">
        {busy ? `Refreshing ${label.toLowerCase()}` : updated ? `${label} updated` : ''}
      </span>
      {children}
    </div>
  );
}
