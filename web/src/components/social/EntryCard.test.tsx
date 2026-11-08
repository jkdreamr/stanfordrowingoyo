// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Config, EntryDetail, ImageMetadata } from '../../../../shared/types';
import { EntryCard } from './EntryCard';
import { PhotoCarousel } from './PhotoCarousel';
import { ToastProvider } from '../ui';
const mutate = vi.hoisted(() => vi.fn());
vi.mock('./KudosButton', () => ({ KudosButton: () => <button>Kudos</button> }));
vi.mock('./HighlightBadge', () => ({ HighlightBadge: () => null }));
vi.mock('../../lib/queries', () => ({
  useImage: () => ({ data: undefined }),
  useKudos: () => ({ mutate, isPending: false }),
}));
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('PointerEvent', MouseEvent);
  mutate.mockClear();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const entry = {
  id: 'entry',
  user_id: 'author',
  author: { name: 'Alex Kim' },
  title: 'Steady Row',
  created_at: new Date().toISOString(),
  date: '2026-11-05',
  equiv_m: 12000,
  distance_m: 12000,
  duration_s: 2880,
  avg_split_s: 120,
  stroke_rate: 20,
  avg_hr: 142,
  modality: 'erg',
  zone: 'E',
  images: [],
  notes: '',
  comment_count: 0,
} as unknown as EntryDetail;
it('shows absolute backdated workout dates, neutral links and a detail comment callback', () => {
  const focus = vi.fn();
  const { rerender } = render(
    <MemoryRouter>
      <ToastProvider>
        <EntryCard
          entry={entry}
          config={{ today: '2026-11-06' } as Config}
          full
          onComment={focus}
        />
      </ToastProvider>
    </MemoryRouter>,
  );
  expect(screen.getByText('just now · Thu, Nov 5')).toBeTruthy();
  const detailChipSpacing = screen.getByText('erg').parentElement?.className;
  expect(detailChipSpacing).toContain('social-modality');
  expect(screen.getByRole('link', { name: 'Alex Kim' }).className).toContain('social-text-link');
  expect(screen.getByRole('link', { name: 'Steady Row' }).className).toContain('social-text-link');
  fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
  expect(focus).toHaveBeenCalledOnce();
  rerender(
    <MemoryRouter>
      <ToastProvider>
        <EntryCard
          entry={{ ...entry, date: '2026-11-06' }}
          config={{ today: '2026-11-06' } as Config}
        />
      </ToastProvider>
    </MemoryRouter>,
  );
  expect(screen.getByText('just now')).toBeTruthy();
  expect(screen.queryByText(/Thu, Nov 5/)).toBeNull();
  expect(screen.getByText('erg').parentElement?.className).toBe(detailChipSpacing);
});
function setup(overrides: Partial<EntryDetail> = {}, full = false) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<EntryCard entry={{ ...entry, ...overrides }} full={full} />} />
          <Route path="/entries/:id" element={<h1>Workout Detail</h1>} />
          <Route path="/users/:id" element={<h1>Rower Profile</h1>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}
function tap(element: Element, x = 80, y = 100) {
  fireEvent.click(element, { detail: 1, clientX: x, clientY: y });
}
it('gives kudos exactly once for repeated double taps and removes the heart after 600ms', () => {
  const { container } = setup();
  const body = screen.getByText('Distance');
  tap(body);
  tap(body);
  tap(body);
  tap(body);
  expect(mutate).toHaveBeenCalledExactlyOnceWith(
    { id: entry.id, hasKudos: true },
    expect.any(Object),
  );
  expect(container.querySelector('.social-heart-burst')).toBeTruthy();
  act(() => vi.advanceTimersByTime(600));
  expect(container.querySelector('.social-heart-burst')).toBeNull();
});
it('never un-kudoses an already-kudosed workout', () => {
  setup({ has_kudos: true });
  tap(screen.getByText('Distance'));
  tap(screen.getByText('Distance'));
  expect(mutate).not.toHaveBeenCalled();
});
it('keeps inner links, buttons and avatars out of the double-tap gesture', () => {
  const { container } = setup();
  const button = screen.getByRole('button', { name: 'Kudos' });
  tap(button);
  tap(button);
  const avatar = container.querySelector('[data-no-double-tap]')!;
  tap(avatar);
  tap(avatar);
  fireEvent.click(screen.getByRole('link', { name: 'Alex Kim' }));
  expect(screen.getByRole('heading', { name: 'Rower Profile' })).toBeTruthy();
  expect(mutate).not.toHaveBeenCalled();
});
it('navigates on a single body tap after no more than 280ms and leaves keyboard links immediate', () => {
  setup();
  tap(screen.getByText('Distance'));
  expect(screen.queryByText('Workout Detail')).toBeNull();
  act(() => vi.advanceTimersByTime(280));
  expect(screen.getByRole('heading', { name: 'Workout Detail' })).toBeTruthy();
  expect(mutate).not.toHaveBeenCalled();
});
it('does not render an animated burst for reduced motion', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const { container } = setup();
  tap(screen.getByText('Distance'));
  tap(screen.getByText('Distance'));
  expect(mutate).toHaveBeenCalledOnce();
  expect(container.querySelector('.social-heart-burst')).toBeNull();
});
it('gives kudos on detail photos without opening the viewer; keyboard photo activation remains immediate', () => {
  setup({ images: [{ id: 'one' }] as ImageMetadata[] }, true);
  const photo = screen.getByRole('button', { name: 'Open Photo 1' });
  tap(photo);
  tap(photo);
  act(() => vi.advanceTimersByTime(280));
  expect(mutate).toHaveBeenCalledOnce();
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(photo);
  expect(screen.getByRole('dialog')).toBeTruthy();
});
it('reports failed kudos with the existing error toast and removes its burst', () => {
  const { container } = setup();
  tap(screen.getByText('Distance'));
  tap(screen.getByText('Distance'));
  act(() => mutate.mock.calls[0][1].onError());
  expect(screen.getByRole('alert').textContent).toBe('Kudos not saved. Try again');
  expect(container.querySelector('.social-heart-burst')).toBeNull();
});
it('keeps a single photo tap opening its viewer after 280ms and does not add kudos inside it', () => {
  setup({ images: [{ id: 'one' }] as ImageMetadata[] });
  tap(screen.getByRole('button', { name: 'Open Photo 1' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  act(() => vi.advanceTimersByTime(280));
  const photo = screen.getByRole('dialog').querySelector('.social-zoom-slide')!;
  tap(photo);
  tap(photo);
  expect(mutate).not.toHaveBeenCalled();
});
it('ignores moved or cancelled pointers and selected text', () => {
  setup();
  const body = screen.getByText('Distance');
  fireEvent.pointerDown(body, { button: 0, clientX: 0, clientY: 0 });
  fireEvent.pointerMove(body, { clientX: 100, clientY: 0 });
  tap(body);
  tap(body);
  fireEvent.pointerDown(body, { button: 0 });
  fireEvent.pointerCancel(body);
  tap(body);
  tap(body);
  fireEvent.pointerDown(body, { button: 0 });
  const selection = window.getSelection()!;
  selection.selectAllChildren(body);
  tap(body);
  tap(body);
  selection.removeAllRanges();
  act(() => vi.advanceTimersByTime(300));
  expect(mutate).not.toHaveBeenCalled();
  expect(screen.queryByText('Workout Detail')).toBeNull();
});
it('keeps title links immediate and clears any pending body navigation on another control', () => {
  setup();
  tap(screen.getByText('Distance'));
  fireEvent.click(screen.getByRole('button', { name: 'Kudos' }));
  act(() => vi.advanceTimersByTime(280));
  expect(screen.queryByText('Workout Detail')).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: entry.title }));
  expect(screen.getByRole('heading', { name: 'Workout Detail' })).toBeTruthy();
  expect(mutate).not.toHaveBeenCalled();
});
it('does not mistake a browser-selected whitespace line break for text selection', () => {
  setup({ notes: '\n' });
  const notes = document.querySelector('p.whitespace-pre-wrap')!;
  const selection = window.getSelection()!;
  selection.selectAllChildren(notes);
  tap(screen.getByText('Distance'));
  tap(screen.getByText('Distance'));
  selection.removeAllRanges();
  expect(mutate).toHaveBeenCalledOnce();
});
it('hides carousel controls at each endpoint instead of leaving faded controls', () => {
  render(<PhotoCarousel images={[{ id: '1' }, { id: '2' }] as ImageMetadata[]} alt="Training" />);
  const previous = screen.getByLabelText('Previous Photo');
  const next = screen.getByLabelText('Next Photo');
  expect(previous.style.visibility).toBe('hidden');
  expect(next.style.visibility).toBe('visible');
  const track = document.querySelector('.social-photo-track')!;
  Object.defineProperty(track, 'clientWidth', { value: 393 });
  track.scrollLeft = 393;
  fireEvent.scroll(track);
  expect(previous.style.visibility).toBe('visible');
  expect(next.style.visibility).toBe('hidden');
});
