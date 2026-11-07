// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { OfflineBanner } from './OfflineBanner';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('announces Offline and reconnects without moving focus or blocking interaction', () => {
  vi.stubGlobal('navigator', { onLine: true });
  render(
    <>
      <OfflineBanner />
      <button>Save</button>
    </>,
  );
  const status = screen.getByRole('status');
  expect(status.textContent).toBe('');
  screen.getByRole('button').focus();
  act(() => {
    vi.stubGlobal('navigator', { onLine: false });
    window.dispatchEvent(new Event('offline'));
  });
  expect(status.textContent).toBe('Offline');
  expect(status.getAttribute('aria-live')).toBe('polite');
  expect(document.activeElement).toBe(screen.getByRole('button'));
  act(() => {
    vi.stubGlobal('navigator', { onLine: true });
    window.dispatchEvent(new Event('online'));
  });
  expect(status.textContent).toBe('');
});
it('shows Offline on an offline initial mount', () => {
  vi.stubGlobal('navigator', { onLine: false });
  render(<OfflineBanner />);
  expect(screen.getByRole('status').textContent).toBe('Offline');
});
