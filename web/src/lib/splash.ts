export function syncThemeColor(dark: boolean) {
  const splash = document.getElementById('launch-splash');
  const launching = splash && !splash.classList.contains('is-leaving');
  const color = launching ? '#8C1515' : dark ? '#121214' : '#F7F7FA';
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', color);
  });
}

export function dismissSplash() {
  const splash = document.getElementById('launch-splash');
  if (!splash) return;
  const minimum = 600;
  const elapsed = performance.now() - Number(splash.dataset.started ?? 0);
  let removal: ReturnType<typeof setTimeout> | undefined;
  const dismissal = setTimeout(
    () => {
      splash.classList.add('is-leaving');
      document.documentElement.classList.remove('launching');
      document.getElementById('root')?.removeAttribute('inert');
      syncThemeColor(document.documentElement.classList.contains('dark'));
      const fade = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
      removal = setTimeout(() => splash.remove(), fade);
    },
    Math.max(0, minimum - elapsed),
  );
  return () => {
    clearTimeout(dismissal);
    clearTimeout(removal);
  };
}
