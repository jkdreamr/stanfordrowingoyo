// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Config, EntryDetail, ImageMetadata } from '../../../../shared/types';
import { EntryCard } from './EntryCard';
import { PhotoCarousel } from './PhotoCarousel';
vi.mock('./KudosButton', () => ({ KudosButton: () => <button>Kudos</button> }));
vi.mock('./HighlightBadge', () => ({ HighlightBadge: () => null }));
vi.mock('../../lib/queries', () => ({ useImage: () => ({ data: undefined }) }));
beforeEach(() => {
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
      <EntryCard entry={entry} config={{ today: '2026-11-06' } as Config} full onComment={focus} />
    </MemoryRouter>,
  );
  expect(screen.getByText('just now · Thu, Nov 5')).toBeTruthy();
  const detailChipSpacing = screen.getByText('erg').parentElement?.className;
  expect(detailChipSpacing).toContain('mt-2');
  expect(screen.getByRole('link', { name: 'Alex Kim' }).className).toContain('social-text-link');
  expect(screen.getByRole('link', { name: 'Steady Row' }).className).toContain('social-text-link');
  fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
  expect(focus).toHaveBeenCalledOnce();
  rerender(
    <MemoryRouter>
      <EntryCard
        entry={{ ...entry, date: '2026-11-06' }}
        config={{ today: '2026-11-06' } as Config}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText('just now')).toBeTruthy();
  expect(screen.queryByText(/Thu, Nov 5/)).toBeNull();
  expect(screen.getByText('erg').parentElement?.className).toBe(detailChipSpacing);
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
