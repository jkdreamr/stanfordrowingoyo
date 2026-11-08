import { memo, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { SeasonStats } from '../../../../shared/types';
import { api } from '../../lib/api';
import { qk, useConfig, useMe, useProfile, useSeasonStats } from '../../lib/queries';
import {
  CHART_RANGES,
  chartPath,
  cumulativeSeries,
  paceGap,
  rangeStart,
  selectRange,
  yDomain,
  type ChartRange,
} from '../../lib/season-chart';
import { formatMeters, formatShortDate } from '../../lib/format';
import { weekStart } from '../../../../shared/dates';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { LoadState } from '../shell/LoadState';

const Paths = memo(function Paths({ line, pace }: { line: string; pace: string | null }) {
  return (
    <svg
      className="season-reveal absolute inset-0 h-full w-full"
      viewBox="0 0 1000 200"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {pace && (
        <path
          d={pace}
          fill="none"
          stroke="var(--muted)"
          strokeWidth="1"
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path
        d={line}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
});
const EMPTY_HISTORY: SeasonStats[] = [];

export interface SeasonChartViewProps {
  stats: SeasonStats;
  history?: SeasonStats[];
  today: string;
  currentWeekStart: string;
  isMe?: boolean;
  coxswain?: boolean;
  createdAt?: string;
  range?: ChartRange;
  onRangeChange?: (range: ChartRange) => void;
}
export function SeasonChartView({
  stats,
  history = EMPTY_HISTORY,
  today,
  currentWeekStart,
  isMe = true,
  coxswain = false,
  createdAt,
  range: controlledRange,
  onRangeChange,
}: SeasonChartViewProps) {
  const [localRange, setRange] = useState<ChartRange>('Season');
  const range = controlledRange ?? localRange;
  const series = useMemo(
    () =>
      cumulativeSeries(range === 'All' ? [...history, stats] : [stats], today, coxswain, createdAt),
    [stats, history, today, coxswain, range, createdAt],
  );
  const start =
    range === 'All'
      ? (series.find((p) => p.day > 0)?.date ?? stats.start)
      : rangeStart(range, stats.start, today, currentWeekStart);
  const points = useMemo(() => selectRange(series, range, start), [series, range, start]);
  const startLabel = useMemo(() => formatShortDate(start), [start]);
  const todayLabel = useMemo(() => formatShortDate(today), [today]);
  const summary = useMemo(
    () =>
      `Cumulative E-meters, ${startLabel} through ${todayLabel}. ${formatMeters(points.at(-1)?.total ?? 0)}. Use Left and Right to explore.`,
    [startLabel, todayLabel, points],
  );
  const domain = useMemo(() => yDomain(points, range), [points, range]);
  const paths = useMemo(
    () => ({
      line: chartPath(points, domain),
      pace: points.some((p) => p.pace !== null) ? chartPath(points, domain, true) : null,
    }),
    [points, domain],
  );
  const [index, setIndex] = useState<number | null>(null);
  const [announcement, announce] = useState('');
  const activeIndex = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const pending = useRef<number | null>(null);
  const rect = useRef<DOMRect | null>(null);
  const dragging = useRef(false);
  const chart = useRef<HTMLDivElement>(null);
  const touchHandlers = useRef({ move: (_x: number) => {}, end: () => {} });
  useEffect(() => {
    const node = chart.current;
    if (!node) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let origin: { x: number; y: number } | null = null;
    let scrubbing = false;
    const ignoreTouch = (event: TouchEvent) =>
      dragging.current ||
      [...Array.from(event.touches), ...Array.from(event.changedTouches)].some(
        (touch) => (touch as Touch & { touchType?: string }).touchType === 'stylus',
      );
    const end = () => {
      clearTimeout(timer);
      origin = null;
      scrubbing = false;
      touchHandlers.current.end();
    };
    const start = (event: TouchEvent) => {
      if (ignoreTouch(event)) return;
      end();
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      origin = { x: touch.clientX, y: touch.clientY };
      timer = setTimeout(() => {
        scrubbing = true;
        touchHandlers.current.move(touch.clientX);
      }, 250);
    };
    const move = (event: TouchEvent) => {
      if (ignoreTouch(event)) return;
      if (!origin || event.touches.length !== 1) return end();
      const touch = event.touches[0];
      if (scrubbing) {
        event.preventDefault();
        touchHandlers.current.move(touch.clientX);
      } else if (Math.hypot(touch.clientX - origin.x, touch.clientY - origin.y) > 8) end();
    };
    const finish = (event: TouchEvent) => {
      if (!ignoreTouch(event)) end();
    };
    node.addEventListener('touchstart', start, { passive: true });
    node.addEventListener('touchmove', move, { passive: false });
    node.addEventListener('touchend', finish);
    node.addEventListener('touchcancel', finish);
    return () => {
      clearTimeout(timer);
      node.removeEventListener('touchstart', start);
      node.removeEventListener('touchmove', move);
      node.removeEventListener('touchend', finish);
      node.removeEventListener('touchcancel', finish);
    };
  }, []);
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );
  const reset = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    activeIndex.current = null;
    dragging.current = false;
    rect.current = null;
    setIndex(null);
  };
  const move = (next: number, keyboard = false) => {
    if (activeIndex.current === next || !points[next]) return;
    const previous = activeIndex.current;
    if (previous !== null && weekStart(points[previous].date) !== weekStart(points[next].date))
      navigator.vibrate?.(5);
    activeIndex.current = next;
    setIndex(next);
    if (keyboard)
      announce(`${formatShortDate(points[next].date)}, ${formatMeters(points[next].total)}`);
  };
  const pointer = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || (e.pointerType !== 'mouse' && !dragging.current)) return;
    position(e.clientX, e.currentTarget);
  };
  const position = (clientX: number, node: HTMLDivElement) => {
    const bounds = rect.current ?? node.getBoundingClientRect();
    pending.current = Math.max(
      0,
      Math.min(
        points.length - 1,
        Math.round(((clientX - bounds.left) / bounds.width) * (points.length - 1)),
      ),
    );
    if (frame.current === null)
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        if (pending.current !== null) move(pending.current);
      });
  };
  touchHandlers.current = {
    move: (clientX) => {
      if (chart.current) position(clientX, chart.current);
    },
    end: reset,
  };
  const point = points[index ?? points.length - 1];
  const last = points.at(-1);
  const gap = point ? paceGap(point) : null;
  const baseline = series.find((p) => p.date === start);
  const delta = point
    ? Math.max(0, point.total - (baseline ? baseline.total - baseline.day : 0))
    : 0;
  const empty = stats.total_m === 0 && range !== 'All';
  const x = index === null ? 0 : (index / Math.max(1, points.length - 1)) * 100;
  const y = point ? (188 - ((point.total - domain[0]) / (domain[1] - domain[0])) * 156) / 2 : 94;
  return (
    <section aria-label="Season Mileage">
      <div className="min-h-24 tabular-nums">
        <p className="text-large-title">{formatMeters(point?.total ?? 0)}</p>
        <p className="mt-1 text-subhead text-muted">
          {empty
            ? 'No sessions logged this season'
            : range === 'All'
              ? `+${formatMeters(stats.total_m)} this season`
              : `+${formatMeters(delta)} ${index !== null ? `since ${startLabel}` : range === '1W' ? 'this week' : range === '1M' ? 'past month' : range === '3M' ? 'past three months' : 'this season'}`}
        </p>
        {gap !== null && (
          <p className={`mt-1 text-footnote ${gap < 0 ? 'text-muted' : 'text-text'}`}>
            {formatMeters(Math.abs(gap))} {gap < 0 ? 'behind' : 'ahead of'} target pace
          </p>
        )}
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      <div
        ref={chart}
        role="img"
        data-no-tab-swipe
        aria-label={summary}
        tabIndex={0}
        className="relative mt-4 h-[200px] w-full select-none"
        style={{ touchAction: 'pan-y' }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (e.pointerType === 'touch') return;
          rect.current = e.currentTarget.getBoundingClientRect();
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          pointer(e);
        }}
        onPointerMove={pointer}
        onPointerUp={(e) => e.pointerType !== 'touch' && reset()}
        onPointerCancel={(e) => e.pointerType !== 'touch' && reset()}
        onPointerLeave={(e) => e.pointerType !== 'touch' && reset()}
        onBlur={reset}
        onKeyDown={(e) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(e.key)) return;
          e.preventDefault();
          if (e.key === 'Escape') {
            reset();
            announce('Showing latest total');
            return;
          }
          move(
            e.key === 'Home'
              ? 0
              : e.key === 'End'
                ? points.length - 1
                : Math.max(
                    0,
                    Math.min(
                      points.length - 1,
                      (index ?? points.length - 1) + (e.key === 'ArrowLeft' ? -1 : 1),
                    ),
                  ),
            true,
          );
        }}
      >
        <Paths key={range} {...paths} />
        {index === null && !empty && last && (
          <div
            key={`${range}:${paths.line.length}`}
            aria-hidden="true"
            className="season-end"
            style={{
              left: '100%',
              top: `${(188 - ((last.total - domain[0]) / (domain[1] - domain[0])) * 156) / 2}%`,
            }}
          />
        )}
        {index !== null && point && (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-8 bottom-0 w-px bg-muted"
              style={{ left: `${x}%` }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute size-2 rounded-full bg-accent"
              style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-0 whitespace-nowrap rounded bg-surface px-2 text-caption text-muted"
              style={{
                left: `clamp(52px, ${x}%, calc(100% - 52px))`,
                transform: 'translateX(-50%)',
              }}
            >
              {formatShortDate(point.date)}
            </span>
          </>
        )}
      </div>
      <div
        role="group"
        aria-label="Chart Range"
        className="mt-2 flex justify-between border-b border-divider"
      >
        {CHART_RANGES.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={range === r}
            className={`min-h-11 min-w-11 border-b-2 px-2 text-subhead font-medium ${range === r ? 'border-accent text-accent-ink' : 'border-transparent text-muted'}`}
            onClick={() => {
              reset();
              setRange(r);
              onRangeChange?.(r);
            }}
          >
            {r}
          </button>
        ))}
      </div>
      {empty && isMe && (
        <div className="mt-4">
          <Button to="/log" variant="secondary">
            Log a Session
          </Button>
        </div>
      )}
    </section>
  );
}

export function SeasonChart({ userId, isMe = !userId }: { userId?: string; isMe?: boolean }) {
  return <ConnectedSeasonChart key={userId ?? 'me'} userId={userId} isMe={isMe} />;
}
function ConnectedSeasonChart({ userId, isMe }: { userId?: string; isMe: boolean }) {
  const config = useConfig();
  const me = useMe();
  const profile = useProfile(userId ?? '');
  const stats = useSeasonStats({ user: userId });
  const [range, setRange] = useState<ChartRange>('Season');
  const year = Number(stats.data?.start.slice(0, 4) ?? 2024);
  const history = useQueries({
    queries: Array.from({ length: Math.max(0, year - 2024) }, (_, i) => {
      const query = { season: year - i - 1, user: userId };
      return {
        queryKey: qk.request('GET /api/stats/season', { query }),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          api('GET /api/stats/season', { query, signal }),
        enabled: range === 'All' && !!stats.data,
      };
    }),
  });
  const historyData = useMemo(() => history.flatMap((h) => (h.data ? [h.data] : [])), [history]);
  const subject = userId ? profile.data?.user : me.data;
  if (
    stats.isError ||
    config.isError ||
    (userId ? profile.isError : me.isError) ||
    (range === 'All' && history.some((h) => h.isError))
  )
    return (
      <LoadState
        error
        retry={() => {
          void stats.refetch();
          void config.refetch();
          if (userId) void profile.refetch();
          else void me.refetch();
          history.forEach((h) => {
            void h.refetch();
          });
        }}
      />
    );
  if (
    !stats.data ||
    !config.data ||
    !subject ||
    (range === 'All' && history.some((h) => h.isPending))
  )
    return (
      <div role="status" aria-label="Loading Mileage Chart">
        <Skeleton className="h-[380px]" />
      </div>
    );
  return (
    <SeasonChartView
      stats={stats.data}
      history={historyData}
      today={config.data.today}
      currentWeekStart={config.data.current_week_start}
      isMe={isMe}
      coxswain={subject?.role === 'coxswain'}
      createdAt={subject.created_at}
      range={range}
      onRangeChange={setRange}
    />
  );
}
