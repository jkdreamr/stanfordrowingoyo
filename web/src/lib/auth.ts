import { ApiClientError } from './api';
export function safeNext(search: string) {
  const next = new URLSearchParams(search).get('next');
  if (
    !next ||
    !next.startsWith('/') ||
    next.startsWith('//') ||
    next.includes('\\') ||
    /^\/(login|signup|change-password)(?:[/?#]|$)/.test(next)
  )
    return '/';
  const url = new URL(next, 'https://oyo.local');
  if (
    url.origin !== 'https://oyo.local' ||
    /^\/(login|signup|change-password)(?:\/|$)/.test(url.pathname)
  )
    return '/';
  return url.pathname + url.search + url.hash;
}
export function authError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.detail.code === 'NETWORK_ERROR') return 'No connection. Try again.';
    if (error.status === 401) return 'Email or password is incorrect';
    if (error.status === 429) return 'Too many attempts. Wait a few minutes and try again';
    return error.detail.message;
  }
  return 'Could not connect. Check your connection and try again';
}
export function isUnauthorized(error: unknown) {
  return error instanceof ApiClientError && error.status === 401;
}
