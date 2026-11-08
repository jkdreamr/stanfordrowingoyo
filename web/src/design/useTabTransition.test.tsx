// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { useTabTransition } from './useTabTransition';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'startViewTransition');
});
function setup(to: string, supported = true, reduced = false) {
  if (supported)
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: vi.fn() });
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
  return renderHook(() => useTabTransition(to), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={['/feed']}>{children}</MemoryRouter>,
  });
}
it('opts tab links into the router view transition and records travel direction', () => {
  const { result } = setup('/me');
  expect(result.current.viewTransition).toBe(true);
  result.current.onClick();
  expect(document.documentElement.style.getPropertyValue('--tab-direction')).toBe('1');
});
it.each([
  ['/', true, false, true],
  ['/feed', true, false, false],
  ['/settings', true, false, false],
  ['/me', false, false, false],
  ['/me', true, true, false],
])('handles %s with supported=%s reduced=%s', (to, supported, reduced, enabled) => {
  const { result } = setup(to as string, supported as boolean, reduced as boolean);
  expect(result.current.viewTransition).toBe(enabled);
});
