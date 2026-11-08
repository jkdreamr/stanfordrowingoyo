/** Shared motion helpers: reduced-motion checks, launch timing and once-per-session values. */
const shown = new Map<string, number>();

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

/** The last value a keyed figure animated to in this session, so revisits do not replay it. */
export const lastShown = (id?: string) => (id ? shown.get(id) : undefined);
export const remember = (id: string | undefined, value: number) => {
  if (id) shown.set(id, value);
};

/**
 * Runs `start` on the next frame once the launch splash has lifted, so focal motion plays
 * where people can see it rather than behind the splash. Returns a cancel function.
 */
export function afterLaunch(start: (now: number) => void): () => void {
  const root = document.documentElement;
  let frame = 0;
  const run = () => {
    frame = requestAnimationFrame(start);
  };
  if (!root.classList.contains('launching')) {
    run();
    return () => cancelAnimationFrame(frame);
  }
  const observer = new MutationObserver(() => {
    if (root.classList.contains('launching')) return;
    observer.disconnect();
    run();
  });
  observer.observe(root, { attributes: true, attributeFilter: ['class'] });
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
}
