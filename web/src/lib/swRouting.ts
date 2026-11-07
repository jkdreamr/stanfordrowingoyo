export function shellRoute(
  url: string,
  method: string,
  mode: string,
  origin: string,
  assets: readonly string[],
) {
  let parsed: URL;
  let path: string;
  try {
    parsed = new URL(url);
    path = decodeURIComponent(parsed.pathname);
  } catch {
    return 'bypass';
  }
  if (method !== 'GET' || parsed.origin !== origin || path === '/api' || path.startsWith('/api/'))
    return 'bypass';
  if (mode === 'navigate') return 'navigation';
  return assets.includes(parsed.pathname) ? 'asset' : 'bypass';
}
