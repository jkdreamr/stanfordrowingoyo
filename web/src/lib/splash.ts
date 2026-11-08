export function syncThemeColor(dark: boolean) {
  const splash = document.getElementById('launch-splash');
  const launching = splash && !splash.classList.contains('is-leaving');
  const color = launching ? '#8C1515' : dark ? '#0D0C0C' : '#F5F3F0';
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', color);
  });
}

export function dismissSplash() {
  const splash = document.getElementById('launch-splash');
  if (!splash || splash.classList.contains('is-leaving')) return;
  const minimum = 900;
  const elapsed = performance.now() - Number(splash.dataset.started ?? 0);
  let removal: ReturnType<typeof setTimeout> | undefined;
  const dismissal = setTimeout(
    () => {
      splash.classList.add('is-leaving');
      document.documentElement.classList.remove('launching');
      document.getElementById('root')?.removeAttribute('inert');
      syncThemeColor(document.documentElement.classList.contains('dark'));
      const fade = matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 380;
      removal = setTimeout(() => splash.remove(), fade);
    },
    Math.max(0, minimum - elapsed),
  );
  return () => {
    clearTimeout(dismissal);
    clearTimeout(removal);
  };
}
