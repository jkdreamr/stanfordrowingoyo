// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { EntryDetail, WeekStats } from '../../../../shared/types';
import { HighlightBadge } from './HighlightBadge';
import { useWeekStats } from '../../lib/queries';

vi.mock('../../lib/queries', () => ({ useWeekStats: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

for (const active of [true, false]) {
  it(`${active ? 'loads stats for an active' : 'never loads stats for an inactive'} visible author`, () => {
    let intersect: IntersectionObserverCallback;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          intersect = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const entry = {
      id: 'post',
      user_id: 'author',
      author: { active },
      week_start: '2026-11-02',
      equiv_m: 10000,
      created_at: '2026-11-06T12:00:00Z',
    } as EntryDetail;
    vi.mocked(useWeekStats).mockReturnValue({
      data: { target_m: 10000, entries: [entry] } as WeekStats,
    } as ReturnType<typeof useWeekStats>);
    render(<HighlightBadge entry={entry} />);
    expect(useWeekStats).toHaveBeenLastCalledWith(
      { week: entry.week_start, user: 'author' },
      false,
    );
    act(() =>
      intersect!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    expect(useWeekStats).toHaveBeenLastCalledWith(
      { week: entry.week_start, user: 'author' },
      active,
    );
    expect(!!screen.queryByText('Hit Weekly Target')).toBe(active);
  });
}
