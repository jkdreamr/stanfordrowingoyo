// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PwaUpdates } from './PwaUpdates';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function setup(waiting: boolean) {
  const worker = Object.assign(new EventTarget(), { postMessage: vi.fn(), state: 'installing' });
  const registration = Object.assign(new EventTarget(), {
    waiting: waiting ? worker : null,
    installing: worker,
  });
  const service = Object.assign(new EventTarget(), {
    register: vi.fn().mockResolvedValue(registration),
  });
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: service });
  return { service, registration, worker };
}
it('does not register in dev/mock and renders no banner without an update', async () => {
  const { service } = setup(false);
  const { rerender } = render(<PwaUpdates enabled={false} />);
  expect(service.register).not.toHaveBeenCalled();
  await act(async () => rerender(<PwaUpdates enabled />));
  expect(screen.queryByText('A new version is available')).toBeNull();
});
it('offers an existing waiting update and reloads only after controllerchange', async () => {
  const { service, worker } = setup(true);
  const reload = vi.fn();
  await act(async () => render(<PwaUpdates enabled reload={reload} />));
  expect(screen.getByText('A new version is available')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
  expect(worker.postMessage).toHaveBeenCalledWith('SKIP_WAITING');
  expect(reload).not.toHaveBeenCalled();
  act(() => service.dispatchEvent(new Event('controllerchange')));
  expect(reload).toHaveBeenCalledOnce();
});
it('observes later installation and tolerates registration failures', async () => {
  const { service, registration, worker } = setup(false);
  const { unmount } = await act(async () => render(<PwaUpdates enabled />));
  act(() => {
    service.dispatchEvent(new Event('controllerchange'));
    registration.dispatchEvent(new Event('updatefound'));
    registration.waiting = worker;
    worker.dispatchEvent(new Event('statechange'));
  });
  expect(screen.getByText('A new version is available')).toBeTruthy();
  unmount();
  service.register.mockRejectedValue(new Error('Offline'));
  await act(async () => render(<PwaUpdates enabled />));
  expect(screen.queryByText('A new version is available')).toBeNull();
});
