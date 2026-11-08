// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { SeasonStats, WeekSummary } from '../../../shared/types';
import { addDays } from '../../../shared/dates';
import {
  FLOOR,
  MORPH_SAMPLES,
  areaPath,
  chartPath,
  cumulativeSeries,
  curveAt,
  curvePath,
  easeOut,
  formatDelta,
  morphCurve,
  monotoneTangents,
  paceGap,
  paceLabel,
  plotCurve,
  resample,
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
    expect(chartPath(selected, yDomain(selected, '1W'))).toMatch(/ 1000,[\d.]+$/);
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
  const path = container.querySelector('.sc-past .sc-line')!;
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
  expect(container.querySelectorAll('.sc-pace')).toHaveLength(1);
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
  expect(container.querySelectorAll('.sc-pace')).toHaveLength(0);
  expect(screen.queryByText(/pace/)).toBeNull();
  rerender(
    <MemoryRouter>
      <SeasonChartView
        stats={stats({ weeks: [] })}
        today="2026-09-07"
        currentWeekStart="2026-09-07"
      />
    </MemoryRouter>,
  );
  expect(container.querySelectorAll('.sc-pace')).toHaveLength(0);
  expect(screen.queryByText(/pace/)).toBeNull();
});
it('shows a flat cumulative week with zero new meters on Monday', () => {
  view();
  fireEvent.click(screen.getByRole('button', { name: '1W' }));
  expect(screen.getByText('+0 m this week')).toBeTruthy();
  expect(screen.getByText('300 m')).toBeTruthy();
});

/** Every point the emitted path draws, read back from its cubic Bézier segments. */
function tracePath(d: string, steps = 24) {
  const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const out: { x: number; y: number }[] = [];
  let x0 = numbers[0];
  let y0 = numbers[1];
  out.push({ x: x0, y: y0 });
  for (let i = 2; i + 5 < numbers.length; i += 6) {
    const [x1, y1, x2, y2, x3, y3] = numbers.slice(i, i + 6);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const u = 1 - t;
      out.push({
        x: u ** 3 * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * x3,
        y: u ** 3 * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y3,
      });
    }
    x0 = x3;
    y0 = y3;
  }
  return out;
}
const rising = (values: number[]) =>
  values.map((total, i) => ({ date: addDays('2026-09-01', i), total, day: 0, pace: null }));
describe('smooth line, morph and figure', () => {
  it('never dips below an earlier value for non-decreasing data, and passes through every day', () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let run = 0; run < 40; run++) {
      let total = 0;
      const points = rising(
        Array.from({ length: 2 + Math.floor(random() * 60) }, () => {
          const r = random();
          total += r < 0.45 ? 0 : r < 0.9 ? random() * 12000 : random() * 60000;
          return total;
        }),
      );
      const domain = yDomain(points, run % 2 ? 'Season' : '1M');
      const curve = plotCurve(points, domain);
      const traced = tracePath(curvePath(curve));
      for (let i = 1; i < traced.length; i++) {
        expect(traced[i].x).toBeGreaterThanOrEqual(traced[i - 1].x - 1e-6);
        // SVG y grows downward, so a rising total never makes y grow.
        expect(traced[i].y).toBeLessThanOrEqual(traced[i - 1].y + 0.01);
      }
      curve.xs.forEach((x, i) => expect(curveAt(curve, x)).toBeCloseTo(curve.ys[i], 6));
      for (let x = 0; x < 1000; x += 7) {
        expect(curveAt(curve, x + 7)).toBeLessThanOrEqual(curveAt(curve, x) + 1e-9);
      }
    }
  });
  it('keeps flat runs flat and stays within the plot', () => {
    const points = rising([0, 0, 0, 5000, 5000, 5000, 9000]);
    const curve = plotCurve(points, yDomain(points, 'Season'));
    const m = monotoneTangents(curve.xs, curve.ys);
    expect(m.slice(0, 2).every((v) => v === 0)).toBe(true);
    expect(m[4]).toBe(0);
    const traced = tracePath(curvePath(curve));
    expect(traced.every((p) => p.y <= FLOOR + 1e-9 && p.y >= 0)).toBe(true);
    expect(
      traced.filter((p) => p.x <= curve.xs[2]).every((p) => Math.abs(p.y - curve.ys[0]) < 1e-9),
    ).toBe(true);
    expect(areaPath(curvePath(curve))).toMatch(new RegExp(`L1000,${FLOOR}L0,${FLOOR}Z$`));
    expect(areaPath('')).toBe('');
  });
  it('resamples any range to the same x positions and morphs between them monotonically', () => {
    const week = plotCurve(rising([100, 100, 900, 2000]), [0, 2200]);
    const season = plotCurve(rising(Array.from({ length: 70 }, (_, i) => i * i * 10)), [0, 50000]);
    const a = resample(week);
    const b = resample(season);
    expect(a).toHaveLength(MORPH_SAMPLES);
    expect(b).toHaveLength(MORPH_SAMPLES);
    expect(a[0]).toBeCloseTo(week.ys[0]);
    expect(a.at(-1)).toBeCloseTo(week.ys.at(-1)!);
    expect(b.at(-1)).toBeCloseTo(season.ys.at(-1)!);
    expect(morphCurve(a, b, 0).ys).toEqual(a);
    expect(morphCurve(a, b, 1).ys).toEqual(b);
    for (const t of [0.25, 0.5, 0.8]) {
      const frame = morphCurve(a, b, t);
      expect(frame.xs.at(-1)).toBe(1000);
      const traced = tracePath(curvePath(frame), 6);
      for (let i = 1; i < traced.length; i++)
        expect(traced[i].y).toBeLessThanOrEqual(traced[i - 1].y + 0.01);
      frame.ys.forEach((y, i) => {
        expect(y).toBeLessThanOrEqual(Math.max(a[i], b[i]) + 1e-9);
        expect(y).toBeGreaterThanOrEqual(Math.min(a[i], b[i]) - 1e-9);
      });
    }
    expect(resample(plotCurve([], [0, 1]))).toEqual(Array(MORPH_SAMPLES).fill(FLOOR));
  });
  it('eases like --ease-out and formats the figure lines', () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5)).toBeGreaterThan(0.85);
    expect(easeOut(0.3)).toBeLessThan(easeOut(0.31));
    expect(formatDelta(0)).toBe('0 m');
    expect(formatDelta(300)).toBe('300 m');
    expect(formatDelta(-5)).toBe('0 m');
    expect(formatDelta(12_400)).toBe('12.4k');
    expect(formatDelta(1_840_000)).toBe('1.84M');
    expect(paceLabel(null)).toBe('');
    expect(paceLabel(0)).toBe('On pace');
    expect(paceLabel(3100)).toBe('Ahead of pace by 3.1k');
    expect(paceLabel(-450)).toBe('Behind pace by 450 m');
  });
});
it('morphs the line to the new range and lands exactly on its path', () => {
  vi.useFakeTimers();
  let now = 0;
  vi.stubGlobal('performance', { now: () => now });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => callback((now += 16)), 16),
  );
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  const { container, rerender } = view({ today: '2026-09-09', currentWeekStart: '2026-09-07' });
  const line = container.querySelector('.sc-past .sc-line')!;
  const area = container.querySelector('.sc-past .sc-area')!;
  const season = line.getAttribute('d');
  fireEvent.click(screen.getByRole('button', { name: '1W' }));
  const week = container.querySelector('.sc-future .sc-line')!.getAttribute('d');
  expect(week).not.toBe(season);
  // The first frame starts from the old shape, resampled.
  expect(line.getAttribute('d')).not.toBe(week);
  act(() => vi.advanceTimersByTime(200));
  const mid = line.getAttribute('d');
  expect(mid).not.toBe(week);
  expect(area.getAttribute('d')).toBe(areaPath(mid!));
  // A parent render with equal data (new object identities) keeps the morph in flight.
  rerender(
    <MemoryRouter>
      <SeasonChartView
        stats={stats()}
        today="2026-09-09"
        currentWeekStart="2026-09-07"
        range="1W"
      />
    </MemoryRouter>,
  );
  expect(line.getAttribute('d')).toBe(mid);
  act(() => vi.advanceTimersByTime(32));
  expect(line.getAttribute('d')).not.toBe(week);
  act(() => vi.advanceTimersByTime(400));
  expect(line.getAttribute('d')).toBe(week);
  expect(area.getAttribute('d')).toBe(areaPath(week!));
  expect(screen.getByRole('button', { name: '1W' }).getAttribute('aria-pressed')).toBe('true');
});
it('swaps ranges instantly under reduced motion', () => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
  const { container } = view({ today: '2026-09-09', currentWeekStart: '2026-09-07' });
  fireEvent.click(screen.getByRole('button', { name: '1W' }));
  const line = container.querySelector('.sc-past .sc-line')!;
  expect(line.getAttribute('d')).toBe(
    container.querySelector('.sc-future .sc-line')!.getAttribute('d'),
  );
});
it('shows the scrubbed value, dims the future and springs back to today on release', () => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 16),
  );
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  const { container } = view();
  const plot = screen.getByRole('img');
  const figure = container.querySelector('.sc-figure')!;
  expect(figure.textContent).toBe('300 m');
  fireEvent.keyDown(plot, { key: 'Home' });
  expect(figure.textContent).toBe('100 m');
  expect(screen.getByText('+100 m since Sep 1')).toBeTruthy();
  expect(screen.getByText('On pace')).toBeTruthy();
  expect(plot.hasAttribute('data-scrubbing')).toBe(true);
  expect(container.querySelector('clipPath rect')!.getAttribute('width')).toBe('20');
  expect(plot.querySelectorAll('span')).toHaveLength(3);
  fireEvent.keyDown(plot, { key: 'Escape' });
  expect(plot.hasAttribute('data-scrubbing')).toBe(false);
  expect(plot.querySelectorAll('span')).toHaveLength(0);
  expect(container.querySelector('clipPath rect')!.getAttribute('width')).toBe('1040');
  expect(screen.getByText('Behind pace by 500 m')).toBeTruthy();
  act(() => vi.advanceTimersByTime(600));
  expect(figure.textContent).toBe('300 m');
});
it('buzzes once per week boundary crossed while scrubbing, unless motion is reduced', () => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(callback, 16),
  );
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  const vibrate = vi.fn();
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
  view();
  const plot = screen.getByRole('img');
  vi.spyOn(plot, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 300 } as DOMRect);
  const touch = (x: number) => [{ clientX: x, clientY: 100 }];
  fireEvent.touchStart(plot, { touches: touch(0) });
  act(() => vi.advanceTimersByTime(270));
  fireEvent.touchMove(plot, { touches: touch(240), cancelable: true });
  act(() => vi.advanceTimersByTime(20));
  expect(vibrate).not.toHaveBeenCalled();
  fireEvent.touchMove(plot, { touches: touch(300), cancelable: true });
  act(() => vi.advanceTimersByTime(20));
  expect(vibrate).toHaveBeenCalledWith(5);
  fireEvent.touchEnd(plot, { touches: [] });
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
  vibrate.mockClear();
  fireEvent.touchStart(plot, { touches: touch(0) });
  act(() => vi.advanceTimersByTime(270));
  fireEvent.touchMove(plot, { touches: touch(300), cancelable: true });
  act(() => vi.advanceTimersByTime(20));
  expect(vibrate).not.toHaveBeenCalled();
  delete (navigator as { vibrate?: unknown }).vibrate;
});
