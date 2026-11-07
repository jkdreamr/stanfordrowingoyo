// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { isIos, isStandalone, listenForInstall, resetInstallForTests } from './install';
import { InstallBanner } from '../components/InstallBanner';
import { ToastProvider } from '../components/ui/Toast';

let standalone = false;
const userAgent = vi.spyOn(navigator, 'userAgent', 'get');
beforeAll(() => {
  listenForInstall(window);
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
beforeEach(() => {
  standalone = false;
  localStorage.clear();
  resetInstallForTests();
  userAgent.mockReturnValue('Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/130');
  window.matchMedia = ((query: string) => ({
    matches: standalone && query === '(display-mode: standalone)',
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);
const view = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <InstallBanner />
      </ToastProvider>
    </MemoryRouter>,
  );
function prompt() {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: 'accepted' }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}
it('detects iPhone, iPadOS and standalone display', () => {
  expect(isIos({ userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5 } as Navigator)).toBe(
    true,
  );
  expect(isIos({ userAgent: 'Mac', platform: 'MacIntel', maxTouchPoints: 5 } as Navigator)).toBe(
    true,
  );
  expect(isIos({ userAgent: 'Mac', platform: 'MacIntel', maxTouchPoints: 0 } as Navigator)).toBe(
    false,
  );
  expect(isStandalone(window)).toBe(false);
  standalone = true;
  expect(isStandalone(window)).toBe(true);
});
it('shows nothing without a prompt on Android/desktop, then uses the deferred prompt once', async () => {
  view();
  expect(screen.queryByRole('region', { name: 'Install App' })).toBeNull();
  const event = prompt();
  expect(event.defaultPrevented).toBe(true);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Install' })));
  expect(event.prompt).toHaveBeenCalledOnce();
  expect(screen.queryByRole('region', { name: 'Install App' })).toBeNull();
});
it('hides after appinstalled and when already installed', () => {
  view();
  prompt();
  expect(screen.getByRole('region', { name: 'Install App' })).toBeTruthy();
  act(() => {
    window.dispatchEvent(new Event('appinstalled'));
  });
  expect(screen.queryByRole('region', { name: 'Install App' })).toBeNull();
  cleanup();
  resetInstallForTests();
  standalone = true;
  userAgent.mockReturnValue('iPhone');
  view();
  expect(screen.queryByRole('region', { name: 'Install App' })).toBeNull();
});
it('shows iPhone Add to Home Screen steps and remembers dismissal', () => {
  userAgent.mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
  view();
  fireEvent.click(screen.getByRole('button', { name: 'Install' }));
  expect(screen.getByRole('dialog', { name: 'Add to Home Screen' })).toBeTruthy();
  expect(screen.getByText('Tap Share')).toBeTruthy();
  expect(screen.getByText('Tap Add to Home Screen')).toBeTruthy();
  cleanup();
  view();
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(screen.queryByRole('region', { name: 'Install App' })).toBeNull();
  expect(localStorage.getItem('oyo-install-dismissed')).toBe('1');
  cleanup();
  view();
  expect(screen.queryByRole('region', { name: 'Install App' })).toBeNull();
});
