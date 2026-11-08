import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { main } from '../components/shell/Navigation';

const positions = new Map<string, number>();
const textField = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
const easing = 'cubic-bezier(0.2,0,0,1)';

export function ignoreTabSwipe(target: Element, root: HTMLElement) {
  if (
    target.closest(
      `${textField}, dialog, [role="dialog"], .social-photo-track, [data-no-tab-swipe]`,
    ) ||
    document.querySelector('dialog[open]') ||
    document.body.style.overflow === 'hidden' ||
    document.activeElement?.matches(textField) ||
    (window.getSelection() && !window.getSelection()!.isCollapsed)
  )
    return true;
  for (let node: Element | null = target; node && node !== root; node = node.parentElement) {
    if (
      /^(auto|scroll)$/.test(getComputedStyle(node).overflowX) &&
      node.scrollWidth > node.clientWidth
    )
      return true;
  }
  return false;
}

export function useTabSwipe(ref: RefObject<HTMLElement>) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const pending = useRef<{ to: string; direction: number; reduced: boolean } | null>(null);
  const tap = useRef<(to: string) => void>(() => {});
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const media = matchMedia('(max-width: 1023.98px)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const index = main.findIndex((tab) => tab.to === pathname);
    let animation: Animation | undefined;
    let frame = 0;
    let scrollFrame = 0;
    let pendingTimer: ReturnType<typeof setTimeout> | undefined;
    let generation = 0;
    let committedExit: (() => void) | undefined;
    let gesture:
      | {
          x: number;
          y: number;
          dx: number;
          width: number;
          lock: boolean;
          reduced: boolean;
          samples: { x: number; t: number }[];
        }
      | undefined;
    const clearStyles = () => {
      root.style.transform = '';
      root.style.opacity = '';
      root.style.willChange = '';
    };
    const reset = () => {
      committedExit = undefined;
      generation++;
      gesture = undefined;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(scrollFrame);
      clearTimeout(pendingTimer);
      animation?.cancel();
      animation = undefined;
      clearStyles();
    };
    const prepareNavigation = (to: string, direction: number, reduced: boolean) => {
      const transition = { to, direction, reduced };
      pending.current = transition;
      root.style.opacity = '0';
      clearTimeout(pendingTimer);
      pendingTimer = setTimeout(() => {
        if (pending.current !== transition) return;
        pending.current = null;
        reset();
      }, 400);
    };
    const interrupt = () => {
      if (pending.current) return true;
      const finish = committedExit;
      if (finish) {
        generation++;
        gesture = undefined;
        cancelAnimationFrame(frame);
        cancelAnimationFrame(scrollFrame);
        animation?.finish();
        finish();
        return true;
      }
      reset();
      return false;
    };
    const animate = (frames: Keyframe[], duration: number, done: () => void, exit = false) => {
      const token = generation;
      animation = root.animate(frames, { duration, easing, fill: 'forwards' });
      animation.finished
        .then(() => {
          if (token !== generation) return;
          if (!exit) {
            animation?.cancel();
            animation = undefined;
          }
          done();
        })
        .catch(() => {});
    };
    const arriving = pending.current;
    pending.current = null;
    if (arriving?.to === pathname && media.matches) {
      const y = positions.get(pathname) ?? 0;
      const deadline = performance.now() + 600;
      const restore = () => {
        window.scrollTo(0, y);
        if (document.documentElement.scrollHeight - innerHeight < y && performance.now() < deadline)
          scrollFrame = requestAnimationFrame(restore);
      };
      restore();
      root.style.willChange = arriving.reduced ? 'opacity' : 'transform, opacity';
      animate(
        arriving.reduced
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [
              {
                transform: `translate3d(${arriving.direction * 24}px,0,0)`,
                opacity: 0,
              },
              { transform: 'translate3d(0,0,0)', opacity: 1 },
            ],
        arriving.reduced ? 120 : 220,
        clearStyles,
      );
    }
    tap.current = (to) => {
      const next = main.findIndex((tab) => tab.to === to);
      if (to === pathname) return;
      reset();
      if (media.matches && index >= 0 && next >= 0) {
        positions.set(pathname, window.scrollY);
        prepareNavigation(to, Math.sign(next - index), reduced.matches);
      }
      navigate(to, { preventScrollReset: media.matches && index >= 0 && next >= 0 });
    };
    const start = (event: TouchEvent) => {
      if (interrupt()) return;
      if (index < 0 || !media.matches || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const width = innerWidth;
      if (
        touch.clientX < 24 ||
        touch.clientX > width - 24 ||
        !(event.target instanceof Element) ||
        ignoreTabSwipe(event.target, root)
      )
        return;
      gesture = {
        x: touch.clientX,
        y: touch.clientY,
        dx: 0,
        width,
        lock: false,
        reduced: reduced.matches,
        samples: [{ x: touch.clientX, t: performance.now() }],
      };
    };
    const move = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        interrupt();
        return;
      }
      const g = gesture;
      if (!g) return;
      const touch = event.touches[0];
      g.dx = touch.clientX - g.x;
      const dy = touch.clientY - g.y;
      if (!g.lock) {
        if (Math.hypot(g.dx, dy) < 10) return;
        if (Math.abs(g.dx) <= Math.abs(dy) * 1.2) {
          reset();
          return;
        }
        g.lock = true;
        root.style.willChange = g.reduced ? 'opacity' : 'transform';
      }
      if (event.cancelable) event.preventDefault();
      const now = performance.now();
      g.samples = g.samples.filter((sample) => now - sample.t <= 100);
      g.samples.push({ x: touch.clientX, t: now });
      const boundary = (index === 0 && g.dx > 0) || (index === main.length - 1 && g.dx < 0);
      const dx = boundary ? Math.sign(g.dx) * Math.min(Math.abs(g.dx) * 0.25, 80) : g.dx;
      cancelAnimationFrame(frame);
      if (!g.reduced)
        frame = requestAnimationFrame(() => {
          root.style.transform = `translate3d(${dx}px,0,0)`;
        });
    };
    const end = () => {
      if (pending.current) return;
      const g = gesture;
      gesture = undefined;
      cancelAnimationFrame(frame);
      if (!g?.lock) {
        clearStyles();
        return;
      }
      const now = performance.now();
      const sample = g.samples.find((s) => now - s.t <= 100);
      const velocity = sample ? (g.x + g.dx - sample.x) / Math.max(1, now - sample.t) : 0;
      const direction = g.dx < 0 ? 1 : -1;
      const to = main[index + direction]?.to;
      const commit =
        to &&
        (Math.abs(g.dx) > g.width * 0.3 || (Math.abs(velocity) > 0.35 && velocity * g.dx > 0));
      if (!commit) {
        animate(
          g.reduced
            ? [{ opacity: 1 }, { opacity: 1 }]
            : [
                { transform: root.style.transform || 'translate3d(0,0,0)' },
                { transform: 'translate3d(0,0,0)' },
              ],
          g.reduced ? 120 : 180,
          clearStyles,
        );
        return;
      }
      positions.set(pathname, window.scrollY);
      const finish = () => {
        committedExit = undefined;
        prepareNavigation(to, direction, g.reduced);
        navigate(to, { preventScrollReset: true });
      };
      committedExit = finish;
      animate(
        g.reduced
          ? [{ opacity: 1 }, { opacity: 0 }]
          : [
              { transform: root.style.transform || `translate3d(${g.dx}px,0,0)`, opacity: 1 },
              { transform: `translate3d(${-direction * g.width}px,0,0)`, opacity: 0 },
            ],
        g.reduced ? 120 : 180,
        finish,
        true,
      );
    };
    const fingers = (event: TouchEvent) => {
      if (event.touches.length > 1) interrupt();
    };
    const recordScroll = () => positions.set(pathname, window.scrollY);
    const watchScroll = () => {
      window.removeEventListener('scroll', recordScroll);
      if (index >= 0 && media.matches)
        window.addEventListener('scroll', recordScroll, { passive: true });
    };
    const resize = () => {
      interrupt();
      watchScroll();
    };
    watchScroll();
    root.addEventListener('touchstart', start, { passive: true });
    root.addEventListener('touchmove', move, { passive: false });
    root.addEventListener('touchend', end, { passive: true });
    root.addEventListener('touchcancel', interrupt, { passive: true });
    document.addEventListener('touchstart', fingers, { passive: true });
    window.addEventListener('resize', resize);
    return () => {
      reset();
      root.removeEventListener('touchstart', start);
      root.removeEventListener('touchmove', move);
      root.removeEventListener('touchend', end);
      root.removeEventListener('touchcancel', interrupt);
      document.removeEventListener('touchstart', fingers);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', recordScroll);
    };
  }, [pathname, navigate, ref]);
  return (to: string) => tap.current(to);
}
