// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { SeasonStats, WeekSummary } from '../../../shared/types';
import { addDays } from '../../../shared/dates';
import {
  chartPath,
  cumulativeSeries,
  paceGap,
  rangeStart,
  sampleWeekly,
  selectRange,
  yDomain,
} from './season-chart';
import { SeasonChartView } from '../components/ui/SeasonChart';

function stats(overrides: Partial<SeasonStats> = {}): SeasonStats {
  const totals = {
    total_m: 300,
    by_modality: { erg: 300, bike: 0, run: 0 },
    by_zone: {} as SeasonStats['by_zone'],
  };
  const week: WeekSummary = {
    ...totals,
    week_start: '2026-08-31',
    target_m: 700,
    percent: 0,
    hit_target: false,
  };
  return {
    ...totals,
    start: '2026-09-01',
    end: '2027-08-31',
    days: [
      { date: '2026-09-01', equiv_m: 100 },
      { date: '2026-09-03', equiv_m: 200 },
    ],
    weeks: [week, { ...week, week_start: '2026-09-07', target_m: 1400 }],
    streak: 0,
    best_week: week,
    ...overrides,
  };
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('daily mileage and pace', () => {
  it('starts a mid-season joiner at account creation in Los Angeles, not season start', () => {
    const joined = stats({
      days: [{ date: '2026-11-06', equiv_m: 1000 }],
      weeks: [{ ...stats().weeks[0], week_start: '2026-11-02', target_m: 80000 }],
    });
    const points = cumulativeSeries([joined], '2026-11-06', false, '2026-11-06T18:00:00Z');
    expect(points.find((p) => p.date === '2026-11-05')?.pace).toBe(0);
    expect(points.at(-1)?.pace).toBeCloseTo(80000 / 7);
    expect(paceGap(points.at(-1)!)).toBe(-10429);
    const overnight = cumulativeSeries([joined], '2026-11-06', false, '2026-11-06T01:00:00Z');
    expect(overnight.at(-1)?.pace).toBeCloseTo((2 * 80000) / 7);
  });
  it('does not charge pace before account creation even for backdated entries, and falls back to first activity', () => {
    const prior = stats({
      start: '2025-09-01',
      end: '2026-08-31',
      days: [{ date: '2025-11-03', equiv_m: 300 }],
      weeks: [{ ...stats().weeks[0], week_start: '2025-11-03', target_m: 700 }],
    });
    const points = cumulativeSeries([prior, stats()], '2026-09-03', false, '2026-09-03T18:00:00Z');
    expect(points.find((p) => p.date === '2025-11-02')?.pace).toBe(0);
    expect(points.find((p) => p.date === '2025-11-03')?.pace).toBe(0);
    expect(points.at(-1)).toMatchObject({ total: 600, pace: 100 });
    expect(cumulativeSeries([prior, stats()], '2026-09-03').at(-1)).toMatchObject({
      total: 600,
      pace: 1000,
    });
    const empty = cumulativeSeries(
      [stats({ days: [], total_m: 0 })],
      '2026-09-03',
      false,
      '2026-09-03T18:00:00Z',
    );
    expect(empty.at(-1)?.pace).toBe(100);
    expect(cumulativeSeries([stats()], '2026-09-03', false, 'invalid').at(-1)?.pace).toBe(300);
  });
  it('fills zero days and accumulates partial first-week targets day by day', () => {
    const points = cumulativeSeries([stats()], '2026-09-07');
    expect(points[0]).toEqual({ date: '2026-09-01', total: 100, day: 100, pace: 100 });
    expect(points[1].total).toBe(100);
    expect(points.at(-1)).toMatchObject({ total: 300, pace: 800 });
    expect(paceGap(points.at(-1)!)).toBe(-500);
  });
  it('keeps lifetime accumulation continuous across a season boundary', () => {
    const prior = stats({
      start: '2025-09-01',
      end: '2026-08-31',
      days: [{ date: '2026-08-31', equiv_m: 50 }],
      weeks: [],
    });
    const points = cumulativeSeries([stats(), prior], '2026-09-03');
    expect(points.at(-1)?.total).toBe(350);
    expect(points.find((p) => p.date === '2026-08-31')?.total).toBe(50);
  });
  it('handles empty, future, zero-target and coxswain histories', () => {
    expect(cumulativeSeries([], '2026-09-03')).toEqual([]);
    expect(cumulativeSeries([stats()], '2025-01-01')).toEqual([]);
    expect(cumulativeSeries([stats({ days: [], total_m: 0 })], '2026-09-03').at(-1)).toMatchObject({
      total: 0,
      pace: 300,
    });
    expect(
      cumulativeSeries([stats({ weeks: [] })], '2026-09-03').every((p) => p.pace === null),
    ).toBe(true);
    expect(cumulativeSeries([stats()], '2026-09-03', true).every((p) => p.pace === null)).toBe(
      true,
    );
    expect(paceGap({ date: '', total: 0, pace: null, day: 0 })).toBeNull();
  });
  it('does not invent a target through a missing week', () => {
    const points = cumulativeSeries([stats({ weeks: [stats().weeks[0]] })], '2026-09-09');
    expect(points.at(-1)?.pace).toBe(600);
  });
});
describe('range and plotting helpers', () => {
  it('clamps short ranges to season start and keeps Monday totals cumulative', () => {
    expect(rangeStart('1M', '2026-09-01', '2026-09-07', '2026-09-07')).toBe('2026-09-01');
    expect(rangeStart('3M', '2026-09-01', '2026-09-07', '2026-09-07')).toBe('2026-09-01');
    const start = rangeStart('1W', '2026-09-01', '2026-09-07', '2026-09-07');
    const selected = selectRange(cumulativeSeries([stats()], '2026-09-07'), '1W', start);
    expect(selected).toHaveLength(1);
    expect(selected[0]).toMatchObject({ total: 300, day: 0 });
    expect(chartPath(selected, yDomain(selected, '1W'))).toContain('L1000');
  });
  it('samples only beyond 400 days and retains both ends', () => {
    const points = Array.from({ length: 405 }, (_, i) => ({
      date: addDays('2025-01-01', i),
      total: i,
      day: 1,
      pace: null,
    }));
    expect(sampleWeekly(points.slice(0, 400))).toHaveLength(400);
    const sampled = sampleWeekly(points);
    expect(sampled.length).toBe(59);
    expect(sampled[0]).toBe(points[0]);
    expect(sampled.at(-1)).toBe(points.at(-1));
  });
  it('includes pace, zero and headroom without invalid flat domains', () => {
    const points = [{ date: '', total: 100, pace: 500, day: 0 }];
    expect(yDomain(points, 'Season')[0]).toBe(0);
    expect(yDomain(points, 'All')[1]).toBeGreaterThan(500);
    expect(yDomain(points, '1W')[0]).toBeLessThan(100);
    expect(yDomain([], 'Season')).toEqual([0, 1]);
    expect(chartPath([], [0, 1])).toBe('');
    expect(chartPath(cumulativeSeries([stats({ days: [] })], '2026-09-03'), [0, 1000])).not.toMatch(
      /NaN|Infinity/,
    );
  });
});
function view(overrides: Partial<React.ComponentProps<typeof SeasonChartView>> = {}) {
  return render(
    <MemoryRouter>
      <SeasonChartView
        stats={stats()}
        today="2026-09-07"
        currentWeekStart="2026-09-07"
        {...overrides}
      />
    </MemoryRouter>,
  );
}
it('holds to scrub continuously, resets on release and leaves quick swipes unclaimed', () => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(callback, 16),
  );
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  view();
  const plot = screen.getByRole('img');
  vi.spyOn(plot, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 300 } as DOMRect);
  const touch = (x: number, y = 100) => [{ clientX: x, clientY: y }];
  fireEvent.touchStart(plot, { touches: touch(0) });
  act(() => vi.advanceTimersByTime(270));
  expect(screen.getByText('Tue, Sep 1')).toBeTruthy();
  expect(fireEvent.touchMove(plot, { touches: touch(300), cancelable: true })).toBe(false);
  act(() => vi.advanceTimersByTime(20));
  expect(screen.getByText('Mon, Sep 7')).toBeTruthy();
  fireEvent.touchEnd(plot, { touches: [] });
  expect(screen.queryByText('Mon, Sep 7')).toBeNull();
  fireEvent.touchStart(plot, { touches: touch(0) });
  expect(fireEvent.touchMove(plot, { touches: touch(0, 150), cancelable: true })).toBe(true);
  act(() => vi.advanceTimersByTime(300));
  expect(screen.queryByText('Tue, Sep 1')).toBeNull();
  fireEvent.touchCancel(plot, { touches: [] });
});
for (const end of ['pointerup', 'pointercancel', 'pointerout']) {
  it(`scrubs a pen drag and resets on ${end}`, () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      setTimeout(callback, 16),
    );
    vi.stubGlobal('cancelAnimationFrame', clearTimeout);
    view();
    const plot = screen.getByRole('img');
    const capture = vi.fn();
    Object.defineProperty(plot, 'setPointerCapture', { value: capture });
    vi.spyOn(plot, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 300 } as DOMRect);
    const pen = (type: string, clientX = 0) => {
      fireEvent(
        plot,
        Object.assign(
          new MouseEvent(type, { bubbles: true, clientX, relatedTarget: document.body }),
          {
            pointerType: 'pen',
            pointerId: 7,
          },
        ),
      );
      act(() => vi.advanceTimersByTime(20));
    };
    pen('pointermove');
    expect(screen.queryByText('Tue, Sep 1')).toBeNull();
    pen('pointerdown');
    expect(capture).toHaveBeenCalledWith(7);
    expect(screen.getByText('Tue, Sep 1')).toBeTruthy();
    pen('pointermove', 300);
    expect(screen.getByText('Mon, Sep 7')).toBeTruthy();
    pen(end, 300);
    expect(screen.queryByText('Mon, Sep 7')).toBeNull();
    pen('pointermove');
    expect(screen.queryByText('Tue, Sep 1')).toBeNull();
  });
}
it('ignores companion stylus touches without resetting a pen drag', () => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(callback, 16),
  );
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  view();
  const plot = screen.getByRole('img');
  Object.defineProperty(plot, 'setPointerCapture', { value: vi.fn() });
  vi.spyOn(plot, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 300 } as DOMRect);
  const stylus = [{ clientX: 0, clientY: 100, touchType: 'stylus' }];
  fireEvent.touchStart(plot, { touches: stylus, changedTouches: stylus });
  act(() => vi.advanceTimersByTime(300));
  expect(screen.queryByText('Tue, Sep 1')).toBeNull();
  const pen = (type: string, clientX: number) =>
    fireEvent(
      plot,
      Object.assign(new MouseEvent(type, { bubbles: true, clientX }), {
        pointerType: 'pen',
        pointerId: 7,
      }),
    );
  pen('pointerdown', 0);
  fireEvent.touchStart(plot, { touches: stylus, changedTouches: stylus });
  act(() => vi.advanceTimersByTime(20));
  expect(screen.getByText('Tue, Sep 1')).toBeTruthy();
  fireEvent.touchMove(plot, { touches: stylus, changedTouches: stylus });
  pen('pointermove', 300);
  act(() => vi.advanceTimersByTime(20));
  expect(screen.getByText('Mon, Sep 7')).toBeTruthy();
  fireEvent.touchEnd(plot, { touches: [], changedTouches: stylus });
  fireEvent.touchCancel(plot, { touches: [], changedTouches: stylus });
  fireEvent.touchStart(plot, { touches: [{ clientX: 0, clientY: 100 }] });
  act(() => vi.advanceTimersByTime(300));
  expect(screen.getByText('Mon, Sep 7')).toBeTruthy();
  pen('pointerup', 300);
  expect(screen.queryByText('Mon, Sep 7')).toBeNull();
});
it('scrubs by keyboard, announces keyboard changes and resets on Escape', () => {
  const { container } = view();
  const plot = screen.getByRole('img');
  const path = container.querySelector('path')!;
  const original = path.getAttribute('d');
  fireEvent.keyDown(plot, { key: 'Home' });
  expect(screen.getByText('100 m')).toBeTruthy();
  expect(container.querySelector('[aria-live]')?.textContent).toContain('Tue, Sep 1, 100 m');
  fireEvent.keyDown(plot, { key: 'ArrowRight' });
  expect(container.querySelector('[aria-live]')?.textContent).toContain('Wed, Sep 2');
  fireEvent.keyDown(plot, { key: 'End' });
  expect(container.querySelector('[aria-live]')?.textContent).toContain('Mon, Sep 7');
  expect(path.getAttribute('d')).toBe(original);
  fireEvent.keyDown(plot, { key: 'Escape' });
  expect(screen.getByText('+300 m this season')).toBeTruthy();
});
it('shows empty state with pace and own-only log action', () => {
  const { rerender, container } = view({ stats: stats({ total_m: 0, days: [] }) });
  expect(screen.getByText('0 m')).toBeTruthy();
  expect(screen.getByText('No sessions logged this season')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Log a Session' }).getAttribute('href')).toBe('/log');
  expect(container.querySelectorAll('path')).toHaveLength(2);
  rerender(
    <MemoryRouter>
      <SeasonChartView
        stats={stats({ total_m: 0, days: [] })}
        today="2026-09-07"
        currentWeekStart="2026-09-07"
        isMe={false}
      />
    </MemoryRouter>,
  );
  expect(screen.queryByRole('link', { name: 'Log a Session' })).toBeNull();
});
it('omits pace for coxswains and zero targets', () => {
  const { container, rerender } = view({ coxswain: true });
  expect(container.querySelectorAll('path')).toHaveLength(1);
  expect(screen.queryByText(/target pace/)).toBeNull();
  rerender(
    <MemoryRouter>
      <SeasonChartView
        stats={stats({ weeks: [] })}
        today="2026-09-07"
        currentWeekStart="2026-09-07"
      />
    </MemoryRouter>,
  );
  expect(container.querySelectorAll('path')).toHaveLength(1);
  expect(screen.queryByText(/target pace/)).toBeNull();
});
it('shows a flat cumulative week with zero new meters on Monday', () => {
  view();
  fireEvent.click(screen.getByRole('button', { name: '1W' }));
  expect(screen.getByText('+0 m this week')).toBeTruthy();
  expect(screen.getByText('300 m')).toBeTruthy();
});
