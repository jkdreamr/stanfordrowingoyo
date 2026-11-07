import { describe, it, expect } from 'vitest';
import { authError, safeNext } from './auth';
import { ApiClientError } from './api';
describe('auth navigation and errors', () => {
  it('preserves local destinations and rejects unsafe or looping destinations', () => {
    expect(safeNext('?next=%2Ffeed%3Fscope%3Dmine')).toBe('/feed?scope=mine');
    for (const next of [
      '',
      '//evil.test',
      '/\\evil.test',
      'https://evil.test',
      '/login',
      '/\t/evil.test',
      '/feed/../login',
      '/signup?next=/',
      '/change-password',
    ])
      expect(safeNext(`?next=${encodeURIComponent(next)}`)).toBe('/');
  });
  it('explains credential, rate limit, and network errors', () => {
    expect(authError(new ApiClientError(401, { code: 'UNAUTHORIZED', message: 'bad' }))).toBe(
      'Email or password is incorrect',
    );
    expect(authError(new ApiClientError(429, { code: 'RATE_LIMITED', message: 'bad' }))).toContain(
      'Too many attempts',
    );
    expect(authError(new TypeError('fetch'))).toContain('Check your connection');
  });
});
