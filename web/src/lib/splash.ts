export function syncThemeColor(dark: boolean) {
  const splash = document.getElementById('launch-splash');
  const launching = splash && !splash.classList.contains('is-leaving');
  const color = launching ? '#8C1515' : dark ? '#0E0D0E' : '#F6F5F3';
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', color);
  });
}

export function dismissSplash({ waitForHome = false } = {}) {
  const splash = document.getElementById('launch-splash');
  if (!splash) return;
  const minimum = 780;
  let removal: ReturnType<typeof setTimeout> | undefined;
  let dismissal: ReturnType<typeof setTimeout> | undefined;
  let frame = 0;
  const schedule = () => {
    const elapsed = performance.now() - Number(splash.dataset.started ?? 0);
    dismissal = setTimeout(
      () => {
        if (!splash.isConnected) return;
        splash.classList.add('is-leaving');
        document.documentElement.classList.remove('launching');
        document.getElementById('root')?.removeAttribute('inert');
        syncThemeColor(document.documentElement.classList.contains('dark'));
        const fade = matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 520;
        removal = setTimeout(() => splash.remove(), fade);
      },
      Math.max(0, minimum - elapsed),
    );
  };
  const observer = new MutationObserver(() => check());
  const check = () => {
    if (
      location.pathname === '/' &&
      !document.querySelector('[data-launch-ready], #root .ui-empty')
    )
      return;
    observer.disconnect();
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(schedule);
    });
  };
  if (waitForHome) {
    observer.observe(document.getElementById('root') ?? document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-launch-ready'],
    });
    check();
  } else schedule();
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
    clearTimeout(dismissal);
    clearTimeout(removal);
  };
}
