import { expect, it } from 'vitest';
import { shellRoute } from './swRouting';
const origin = 'https://oyo.test';
const assets = [
  '/index.html',
  '/assets/app-123.js',
  '/icons/icon-192.png',
  '/manifest.webmanifest',
];
it('only intercepts same-origin navigations and explicitly built shell assets', () => {
  expect(shellRoute(origin + '/me', 'GET', 'navigate', origin, assets)).toBe('navigation');
  for (const path of assets)
    expect(shellRoute(origin + path + '?v=1', 'GET', 'cors', origin, assets)).toBe('asset');
  for (const path of ['/photos/secret.png', '/unlisted.js', '/'])
    expect(shellRoute(origin + path, 'GET', 'cors', origin, assets)).toBe('bypass');
});
it('never intercepts API requests even when navigating or mistakenly allowlisted', () => {
  for (const path of ['/api', '/api/me', '/api/images/1?x=1', '/api%2Fme'])
    for (const mode of ['navigate', 'cors'])
      expect(shellRoute(origin + path, 'GET', mode, origin, [...assets, path])).toBe('bypass');
  expect(shellRoute(origin + '/index.html', 'POST', 'navigate', origin, assets)).toBe('bypass');
  expect(shellRoute('https://other.test/index.html', 'GET', 'navigate', origin, assets)).toBe(
    'bypass',
  );
  expect(shellRoute('', 'GET', 'navigate', origin, assets)).toBe('bypass');
});
