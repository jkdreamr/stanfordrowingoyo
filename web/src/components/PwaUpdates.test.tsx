// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PwaUpdates } from './PwaUpdates';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function setup(waiting: boolean) {
  const worker = Object.assign(new EventTarget(), {
    postMessage: vi.fn(),
    state: waiting ? 'installed' : 'installing',
  });
  const previous = Object.assign(new EventTarget(), { state: 'activated' });
  const registration = Object.assign(new EventTarget(), {
    waiting: waiting ? worker : null,
    installing: worker,
    active: previous as EventTarget | null,
  });
  const service = Object.assign(new EventTarget(), {
    register: vi.fn().mockResolvedValue(registration),
    controller: previous as EventTarget | null,
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
    worker.state = 'installed';
    worker.dispatchEvent(new Event('statechange'));
  });
  expect(screen.getByText('A new version is available')).toBeTruthy();
  unmount();
  service.register.mockRejectedValue(new Error('Offline'));
  await act(async () => render(<PwaUpdates enabled />));
  expect(screen.queryByText('A new version is available')).toBeNull();
});
it('ignores the transient waiting worker on first install and clears activated updates', async () => {
  const { service, registration, worker } = setup(false);
  service.controller = null;
  registration.active = null;
  await act(async () => render(<PwaUpdates enabled />));
  act(() => {
    worker.state = 'installed';
    registration.waiting = worker;
    worker.dispatchEvent(new Event('statechange'));
  });
  expect(screen.queryByText('A new version is available')).toBeNull();
  act(() => {
    registration.waiting = null;
    registration.active = worker;
    service.controller = worker;
    worker.state = 'activated';
    worker.dispatchEvent(new Event('statechange'));
    service.dispatchEvent(new Event('controllerchange'));
  });
  expect(screen.queryByText('A new version is available')).toBeNull();
});
it('removes an update when another tab activates it without reloading this tab', async () => {
  const { service, registration, worker } = setup(true);
  const reload = vi.fn();
  await act(async () => render(<PwaUpdates enabled reload={reload} />));
  expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
  act(() => {
    registration.waiting = null;
    service.controller = worker;
    worker.state = 'activated';
    service.dispatchEvent(new Event('controllerchange'));
  });
  expect(screen.queryByText('A new version is available')).toBeNull();
  expect(reload).not.toHaveBeenCalled();
});
it('clears an existing waiting update if it becomes redundant', async () => {
  const { registration, worker } = setup(true);
  registration.installing = null as unknown as typeof worker;
  await act(async () => render(<PwaUpdates enabled />));
  expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
  act(() => {
    registration.waiting = null;
    worker.state = 'redundant';
    worker.dispatchEvent(new Event('statechange'));
  });
  expect(screen.queryByText('A new version is available')).toBeNull();
});
it('requires an existing controller, not merely an active or newly controlling first worker', async () => {
  const { service, worker } = setup(true);
  service.controller = null;
  const { rerender } = await act(async () => render(<PwaUpdates enabled />));
  expect(screen.queryByText('A new version is available')).toBeNull();
  service.controller = worker;
  await act(async () => rerender(<PwaUpdates enabled reload={() => {}} />));
  expect(screen.queryByText('A new version is available')).toBeNull();
});
