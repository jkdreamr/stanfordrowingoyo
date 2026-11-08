/** Browser chrome follows the page: cardinal while the splash covers it, then the theme's paper. */
export function syncThemeColor(dark: boolean) {
  const splash = document.getElementById('launch-splash');
  const launching = splash && !splash.classList.contains('is-leaving');
  const color = launching ? '#8C1515' : dark ? '#000000' : '#FFFFFF';
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', color);
  });
}

/** Earliest exit, counted from the inline splash's first paint so React and auth time count. */
export const SPLASH_MINIMUM = 900;
/** Curtain lift and reduced-motion fade durations. */
export const CURTAIN_MS = 380;
export const REDUCED_FADE_MS = 120;
/** Handoff: the cover contracts onto the hero, then fades from `HANDOFF_REVEAL_MS`. */
export const HANDOFF_REVEAL_MS = 280;
export const HANDOFF_MS = 480;

/**
 * Home's Week Hero, when it can receive the launch handoff: Home is the landing route, the
 * hero has rendered and sits wholly inside the splash's box. Marks the document so the hero
 * skips its own rise (it is the destination, so it must already be in place).
 */
function handoffTarget(splash: HTMLElement) {
  if (location.pathname !== '/') return;
  const hero = document.querySelector<HTMLElement>('#root .drive-hero');
  if (!hero) return;
  const root = document.documentElement;
  root.dataset.handoff = '';
  const box = hero.getBoundingClientRect();
  const frame = splash.getBoundingClientRect();
  if (
    box.width > 0 &&
    box.height > 0 &&
    box.top >= frame.top &&
    box.left >= frame.left &&
    box.bottom <= frame.bottom &&
    box.right <= frame.right
  ) {
    return {
      top: box.top - frame.top,
      right: frame.right - box.right,
      bottom: frame.bottom - box.bottom,
      left: box.left - frame.left,
    };
  }
  delete root.dataset.handoff;
}

/**
 * Lifts the inline launch splash once the minimum has passed. Interactivity returns at the
 * same moment on every path (inert removed, splash ignores pointers); only the exit differs:
 * - Home with its hero on screen: the painted handoff (the sheet becomes the hero card).
 * - Any other route, or the hero not rendered or not fully visible: the curtain lift.
 * - Reduced motion: a 120 ms fade of the static mark.
 */
export function dismissSplash() {
  const splash = document.getElementById('launch-splash');
  if (!splash || splash.classList.contains('is-leaving')) return;
  const root = document.documentElement;
  const elapsed = performance.now() - Number(splash.dataset.started ?? 0);
  let reveal: ReturnType<typeof setTimeout> | undefined;
  let removal: ReturnType<typeof setTimeout> | undefined;
  let leaving = false;
  const finish = () => {
    clearTimeout(reveal);
    root.classList.remove('launch-handoff');
    splash.remove();
  };
  const dismissal = setTimeout(
    () => {
      if (!splash.isConnected || splash.classList.contains('is-leaving')) return;
      leaving = true;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const target = reduced ? undefined : handoffTarget(splash);
      if (target) {
        for (const [side, value] of Object.entries(target))
          splash.style.setProperty(`--handoff-${side}`, `${value}px`);
        splash.classList.add('is-handoff');
        // Hero figures, ring and day columns wait for the reveal instead of playing under the cover.
        root.classList.add('launch-handoff');
        reveal = setTimeout(() => root.classList.remove('launch-handoff'), HANDOFF_REVEAL_MS);
      }
      splash.classList.add('is-leaving');
      root.classList.remove('launching');
      document.getElementById('root')?.removeAttribute('inert');
      syncThemeColor(root.classList.contains('dark'));
      removal = setTimeout(finish, reduced ? REDUCED_FADE_MS : target ? HANDOFF_MS : CURTAIN_MS);
    },
    Math.max(0, SPLASH_MINIMUM - elapsed),
  );
  return () => {
    clearTimeout(dismissal);
    clearTimeout(removal);
    // An exit already under way completes rather than leaving a cover or a held reveal behind.
    if (leaving) finish();
  };
}
