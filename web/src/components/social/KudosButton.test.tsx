// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { EntryDetail } from '../../../../shared/types';
import { KudosButton } from './KudosButton';
import { ToastProvider } from '../ui';
import { MemoryRouter } from 'react-router-dom';
const mutate = vi.fn();
const state = vi.hoisted(() => ({
  query: {
    data: [] as { id: string; name: string; avatar_image_id: null }[],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
  givers: vi.fn(),
}));
vi.mock('../../lib/queries', () => ({
  useKudos: () => ({ mutate, isPending: false }),
  useKudosGivers: (id: string, enabled: boolean) => {
    state.givers(id, enabled);
    return state.query;
  },
}));
beforeEach(() => {
  state.query.data = [];
  state.query.isPending = false;
  state.query.isError = false;
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('exposes pressed state with a stable accessible name', () => {
  const entry = { id: 'a', has_kudos: false, kudos_count: 2 } as EntryDetail;
  const view = render(
    <ToastProvider>
      <KudosButton entry={entry} />
    </ToastProvider>,
  );
  const button = screen.getByRole('button', { name: 'Kudos' });
  expect(button.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(button);
  expect(mutate.mock.calls[0][0]).toEqual({ id: 'a', hasKudos: true });
  view.rerender(
    <ToastProvider>
      <KudosButton entry={{ ...entry, has_kudos: true, kudos_count: 3 }} />
    </ToastProvider>,
  );
  expect(button.getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: 'View 3 Kudos' }).textContent).toBe('3');
});
function surface(count = 2) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <KudosButton entry={{ id: 'a', has_kudos: false, kudos_count: count } as EntryDetail} />
      </ToastProvider>
    </MemoryRouter>,
  );
}
it.each([1, 2])('pluralizes the accessible count for %i kudos', (count) => {
  surface(count);
  expect(
    screen.getByRole('button', {
      name: `View ${count} ${count === 1 ? 'Kudo' : 'Kudos'}`,
    }).textContent,
  ).toBe(String(count));
});
it('keeps zero non-interactive and fetching disabled until the count is opened', () => {
  surface(0);
  expect(screen.queryByRole('button', { name: /View .* Kudos/ })).toBeNull();
  expect(screen.getByText('0')).toBeTruthy();
  expect(state.givers).toHaveBeenLastCalledWith('a', false);
});
it('opens the count independently, lists public profiles and closes when a row is followed', () => {
  state.query.data = [{ id: 'b', name: 'Bea Rower', avatar_image_id: null }];
  surface();
  expect(state.givers).toHaveBeenLastCalledWith('a', false);
  fireEvent.click(screen.getByRole('button', { name: 'View 2 Kudos' }));
  expect(mutate).not.toHaveBeenCalled();
  expect(state.givers).toHaveBeenLastCalledWith('a', true);
  const row = screen.getByRole('link', { name: 'Bea Rower' });
  expect(row.getAttribute('href')).toBe('/users/b');
  fireEvent.click(row);
  expect(screen.queryByRole('dialog', { name: 'Kudos' })).toBeNull();
  expect(state.givers).toHaveBeenLastCalledWith('a', false);
});
it('shows loading skeletons and the empty state', () => {
  state.query.isPending = true;
  const view = surface();
  fireEvent.click(screen.getByRole('button', { name: 'View 2 Kudos' }));
  expect(
    screen.getByRole('status', { name: 'Loading Kudos' }).querySelectorAll('.ui-skeleton'),
  ).toHaveLength(6);
  state.query.isPending = false;
  view.rerender(
    <MemoryRouter>
      <ToastProvider>
        <KudosButton entry={{ id: 'a', has_kudos: false, kudos_count: 2 } as EntryDetail} />
      </ToastProvider>
    </MemoryRouter>,
  );
  expect(screen.getByText('No Kudos Yet')).toBeTruthy();
});
it('offers retry after a query failure', () => {
  state.query.isError = true;
  surface();
  fireEvent.click(screen.getByRole('button', { name: 'View 2 Kudos' }));
  expect(screen.getByRole('alert').textContent).toBe('Could not load kudos');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(state.query.refetch).toHaveBeenCalledOnce();
});
it('keeps Kudos mounted and locked until the slide-down exit completes', async () => {
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
  const animate = vi.fn((_frames: Keyframe[]) => ({ finished, cancel: vi.fn(), finish }));
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
  try {
    surface();
    const opener = screen.getByRole('button', { name: 'View 2 Kudos' });
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Kudos' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.isConnected).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    expect(animate).toHaveBeenCalledOnce();
    expect(animate.mock.calls[0][0]).toEqual([
      { opacity: 1, transform: 'none' },
      { opacity: 1, transform: 'translateY(100%)' },
    ]);
    await act(async () => finish());
    expect(screen.queryByRole('dialog', { name: 'Kudos' })).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(opener);
  } finally {
    cleanup();
    if (original) Object.defineProperty(HTMLElement.prototype, 'animate', original);
    else Reflect.deleteProperty(HTMLElement.prototype, 'animate');
    vi.unstubAllGlobals();
  }
});
it('shows one recoverable failure toast', () => {
  mutate.mockImplementation((_variables, options) => options.onError());
  render(
    <ToastProvider>
      <KudosButton entry={{ id: 'a', has_kudos: false, kudos_count: 0 } as EntryDetail} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Kudos' }));
  expect(screen.getAllByText('Kudos not saved. Try again')).toHaveLength(1);
});
