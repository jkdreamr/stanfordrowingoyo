import {
  memo,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
  type PointerEvent,
  type RefObject,
} from 'react';
import { useQueries } from '@tanstack/react-query';
import type { SeasonStats } from '../../../../shared/types';
import { api } from '../../lib/api';
import { qk, useConfig, useMe, useProfile, useSeasonStats } from '../../lib/queries';
import {
  CHART_RANGES,
  FLOOR,
  areaPath,
  cumulativeSeries,
  curveAt,
  curvePath,
  easeOut,
  formatDelta,
  morphCurve,
  paceGap,
  paceLabel,
  plotCurve,
  rangeStart,
  resample,
  selectRange,
  yDomain,
  type ChartRange,
} from '../../lib/season-chart';
import { formatMeters, formatShortDate } from '../../lib/format';
import { prefersReducedMotion } from '../../lib/motion';
import { TIME_ZONE, weekStart } from '../../../../shared/dates';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { LoadState } from '../shell/LoadState';
import './season-chart.css';

const MORPH_MS = 420;
const RELEASE_MS = 420;
const LABEL_HALF = 40;
const REST_CLIP = 1040;
const RANGE_WORDS: Record<ChartRange, string> = {
  '1W': 'this week',
  '1M': 'past month',
  '3M': 'past three months',
  Season: 'this season',
  All: 'this season',
};
const axisDate = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  month: 'short',
  day: 'numeric',
});
const monthDay = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) ? axisDate.format(new Date(`${date}T12:00:00Z`)) : '—';

interface PathRefs {
  line: SVGPathElement | null;
  area: SVGPathElement | null;
  pace: SVGPathElement | null;
}
/**
 * The drawn layers. They re-render only when the range or data change; the scrub cursor, the
 * past/future split and the range morph all write to these nodes directly.
 */
const Plot = memo(function Plot({
  id,
  line,
  area,
  pace,
  refs,
  clip,
}: {
  id: string;
  line: string;
  area: string;
  pace: string | null;
  refs: MutableRefObject<PathRefs>;
  clip: RefObject<SVGRectElement>;
}) {
  return (
    <svg
      className="sc-svg sc-draw"
      viewBox="0 0 1000 200"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="sc-stop-top" />
          <stop offset="1" className="sc-stop-floor" />
        </linearGradient>
        <clipPath id={`${id}-past`}>
          <rect ref={clip} x="-20" y="-20" width={REST_CLIP} height="240" />
        </clipPath>
      </defs>
      {pace && (
        <path
          ref={(node) => {
            refs.current.pace = node;
          }}
          className="sc-pace"
          d={pace}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <g className="sc-future">
        <path className="sc-area" d={area} fill={`url(#${id}-fill)`} />
        <path className="sc-line" d={line} vectorEffect="non-scaling-stroke" />
      </g>
      <g className="sc-past" clipPath={`url(#${id}-past)`}>
        <path
          ref={(node) => {
            refs.current.area = node;
          }}
          className="sc-area sc-fill-in"
          d={area}
          fill={`url(#${id}-fill)`}
        />
        <path
          ref={(node) => {
            refs.current.line = node;
          }}
          className="sc-line"
          d={line}
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
});
const EMPTY_HISTORY: SeasonStats[] = [];
const haptic = () => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator && !prefersReducedMotion())
    navigator.vibrate(5);
};
const fade = (node: Element | null) => {
  if (node && typeof node.animate === 'function')
    node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'linear' });
};

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
  const startAxis = useMemo(() => monthDay(start), [start]);
  const todayLabel = useMemo(() => formatShortDate(today), [today]);
  const summary = useMemo(
    () =>
      `Cumulative E-meters, ${startLabel} through ${todayLabel}. ${formatMeters(points.at(-1)?.total ?? 0)}. Use Left and Right to explore.`,
    [startLabel, todayLabel, points],
  );
  const domain = useMemo(() => yDomain(points, range), [points, range]);
  // Smoothing, paths and the morph samples are computed once per range (and data change).
  const geometry = useMemo(() => {
    const line = plotCurve(points, domain);
    const pace = points.some((p) => p.pace !== null) ? plotCurve(points, domain, true) : null;
    const linePath = curvePath(line);
    return {
      line,
      linePath,
      areaPath: areaPath(linePath),
      pacePath: pace ? curvePath(pace) : null,
      samples: resample(line),
      paceSamples: pace ? resample(pace) : null,
      endY: line.ys.at(-1) ?? FLOOR,
    };
  }, [points, domain]);
  const baseline = series.find((p) => p.date === start);
  const base = baseline ? baseline.total - baseline.day : 0;
  const last = points.at(-1);
  const empty = stats.total_m === 0 && range !== 'All';
  const lastGap = last ? paceGap(last) : null;
  const rest = {
    figure: formatMeters(last?.total ?? 0),
    total: last?.total ?? 0,
    delta: empty
      ? 'No sessions logged this season'
      : `+${formatDelta(range === 'All' ? stats.total_m : Math.max(0, (last?.total ?? 0) - base))} ${RANGE_WORDS[range]}`,
    pace: paceLabel(lastGap),
    ahead: lastGap !== null && lastGap >= 0,
  };
  const restRef = useRef(rest);
  restRef.current = rest;

  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [scrubbing, setScrubbing] = useState(false);
  const [announcement, announce] = useState('');
  const [bleed, setBleed] = useState({ left: 0, right: 0 });
  const section = useRef<HTMLElement>(null);
  const chart = useRef<HTMLDivElement>(null);
  const svgPaths = useRef<PathRefs>({ line: null, area: null, pace: null });
  const clip = useRef<SVGRectElement>(null);
  const endDot = useRef<HTMLDivElement>(null);
  const figure = useRef<HTMLParagraphElement>(null);
  const deltaText = useRef<HTMLParagraphElement>(null);
  const paceText = useRef<HTMLParagraphElement>(null);
  const hair = useRef<HTMLSpanElement>(null);
  const dot = useRef<HTMLSpanElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const scrub = useRef<{ frac: number; index: number } | null>(null);
  const shownFigure = useRef(rest.total);
  const figureFrame = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const pending = useRef<number | null>(null);
  const rect = useRef<DOMRect | null>(null);
  const dragging = useRef(false);
  const shown = useRef<{ line: number[]; pace: number[] | null } | null>(null);
  const target = useRef<{ line: number[]; pace: number[] | null } | null>(null);
  const morph = useRef<{ frame: number; finish: () => void } | null>(null);
  const touchHandlers = useRef({ move: (_x: number) => {}, end: () => {} });

  // The line runs to the page edges: measure the gutter it bleeds through, so text and
  // controls keep it while the plot does not.
  useLayoutEffect(() => {
    const parent = section.current?.parentElement;
    if (!parent) return;
    const measure = () => {
      const style = getComputedStyle(parent);
      const left = parseFloat(style.paddingLeft) || 0;
      const right = parseFloat(style.paddingRight) || 0;
      setBleed((b) => (b.left === left && b.right === right ? b : { left, right }));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Range change: morph the previous shape into the new one (both resampled to the same
  // x positions), with the fill and today's dot following. Interruptions start from the
  // shape on screen. Reduced motion swaps instantly behind a 120 ms fade.
  useLayoutEffect(() => {
    const to = { line: geometry.samples, pace: geometry.paceSamples };
    const previous = target.current;
    // Equal data recomputed by a parent render keeps any morph in flight.
    if (
      previous &&
      previous.line.every((y, i) => y === to.line[i]) &&
      (previous.pace === null) === (to.pace === null) &&
      (previous.pace ?? []).every((y, i) => y === to.pace?.[i])
    )
      return;
    target.current = to;
    const from = shown.current;
    if (morph.current) cancelAnimationFrame(morph.current.frame);
    morph.current = null;
    shown.current = to;
    const { line, area, pace } = svgPaths.current;
    if (!from || !line || !area) return;
    if (prefersReducedMotion()) {
      fade(line.ownerSVGElement);
      return;
    }
    const fromPace = from.pace ?? from.line;
    const paint = (t: number) => {
      const curve = morphCurve(from.line, to.line, t);
      const d = curvePath(curve);
      line.setAttribute('d', d);
      area.setAttribute('d', areaPath(d));
      let paceYs: number[] | null = null;
      if (pace && to.pace) {
        const paceCurve = morphCurve(fromPace, to.pace, t);
        paceYs = paceCurve.ys;
        pace.setAttribute('d', curvePath(paceCurve));
      }
      if (endDot.current) endDot.current.style.translate = `0 ${curve.ys.at(-1)}px`;
      shown.current = { line: curve.ys, pace: paceYs };
    };
    const finish = () => {
      if (morph.current) cancelAnimationFrame(morph.current.frame);
      morph.current = null;
      line.setAttribute('d', geometry.linePath);
      area.setAttribute('d', geometry.areaPath);
      if (pace && geometry.pacePath) pace.setAttribute('d', geometry.pacePath);
      if (endDot.current) endDot.current.style.translate = `0 ${geometry.endY}px`;
      shown.current = to;
    };
    paint(0);
    const began = performance.now();
    const step = (now: number) => {
      const progress = (now - began) / MORPH_MS;
      if (progress >= 1) return finish();
      paint(easeOut(progress));
      if (morph.current) morph.current.frame = requestAnimationFrame(step);
    };
    morph.current = { frame: requestAnimationFrame(step), finish };
  }, [geometry]);

  // The resting figure follows new data; a pending spring-back gives way to it.
  useLayoutEffect(() => {
    if (scrub.current) return;
    if (figureFrame.current !== null) cancelAnimationFrame(figureFrame.current);
    figureFrame.current = null;
    shownFigure.current = rest.total;
    if (figure.current) figure.current.textContent = rest.figure;
  }, [rest.total, rest.figure]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (figureFrame.current !== null) cancelAnimationFrame(figureFrame.current);
      if (morph.current) cancelAnimationFrame(morph.current.frame);
    },
    [],
  );

  useEffect(() => {
    const node = chart.current;
    if (!node) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let origin: { x: number; y: number } | null = null;
    let holding = false;
    const ignoreTouch = (event: TouchEvent) =>
      dragging.current ||
      [...Array.from(event.touches), ...Array.from(event.changedTouches)].some(
        (touch) => (touch as Touch & { touchType?: string }).touchType === 'stylus',
      );
    const end = () => {
      clearTimeout(timer);
      origin = null;
      holding = false;
      touchHandlers.current.end();
    };
    const start = (event: TouchEvent) => {
      if (ignoreTouch(event)) return;
      end();
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      origin = { x: touch.clientX, y: touch.clientY };
      timer = setTimeout(() => {
        holding = true;
        touchHandlers.current.move(touch.clientX);
      }, 250);
    };
    const move = (event: TouchEvent) => {
      if (ignoreTouch(event)) return;
      if (!origin || event.touches.length !== 1) return end();
      const touch = event.touches[0];
      if (holding) {
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

  /** Plot width in px, excluding the right gutter the line stops at. */
  const plotWidth = (bounds: { width: number }) => Math.max(1, bounds.width - bleed.right);
  const paintCursor = () => {
    const at = scrub.current;
    if (!at) return;
    const width = plotWidth(rect.current ?? chart.current?.getBoundingClientRect() ?? { width: 1 });
    const x = at.frac * width;
    const vx = at.frac * 1000;
    const y = curveAt(geometry.line, vx);
    if (hair.current) hair.current.style.translate = `${x}px 0`;
    if (dot.current) dot.current.style.translate = `${x}px ${y}px`;
    if (label.current)
      label.current.style.translate = `${Math.max(bleed.left + LABEL_HALF, Math.min(width - LABEL_HALF, x))}px 0`;
    clip.current?.setAttribute('width', String(vx + 20));
  };
  const paintText = (index: number) => {
    const p = points[index];
    if (!p) return;
    shownFigure.current = p.total;
    if (figure.current) figure.current.textContent = formatMeters(p.total);
    if (deltaText.current)
      deltaText.current.textContent = `+${formatDelta(Math.max(0, p.total - base))} since ${startAxis}`;
    if (paceText.current) {
      const gap = paceGap(p);
      paceText.current.textContent = paceLabel(gap);
      paceText.current.classList.toggle('is-ahead', gap !== null && gap >= 0);
    }
    if (label.current) label.current.textContent = formatShortDate(p.date);
  };
  useLayoutEffect(() => {
    if (!scrubbing || !scrub.current) return;
    paintText(scrub.current.index);
    paintCursor();
  });

  /** Release: the cursor leaves at once and the figure springs back to today's total. */
  const reset = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    dragging.current = false;
    rect.current = null;
    if (!scrub.current) return;
    scrub.current = null;
    setScrubbing(false);
    clip.current?.setAttribute('width', String(REST_CLIP));
    const now = restRef.current;
    if (deltaText.current) deltaText.current.textContent = now.delta;
    if (paceText.current) {
      paceText.current.textContent = now.pace;
      paceText.current.classList.toggle('is-ahead', now.ahead);
    }
    const node = figure.current;
    const from = shownFigure.current;
    if (!node) return;
    if (from === now.total || prefersReducedMotion()) {
      shownFigure.current = now.total;
      node.textContent = now.figure;
      return;
    }
    const began = performance.now();
    const step = (time: number) => {
      const progress = Math.min(1, (time - began) / RELEASE_MS);
      const target = restRef.current;
      shownFigure.current =
        progress === 1 ? target.total : from + (target.total - from) * easeOut(progress);
      node.textContent = progress === 1 ? target.figure : formatMeters(shownFigure.current);
      figureFrame.current = progress < 1 ? requestAnimationFrame(step) : null;
    };
    figureFrame.current = requestAnimationFrame(step);
  };
  const show = (frac: number, keyboard = false) => {
    if (!points.length) return;
    const index = Math.max(0, Math.min(points.length - 1, Math.round(frac * (points.length - 1))));
    const previous = scrub.current;
    if (!previous) {
      morph.current?.finish();
      if (figureFrame.current !== null) cancelAnimationFrame(figureFrame.current);
      figureFrame.current = null;
      if (!rect.current && chart.current) rect.current = chart.current.getBoundingClientRect();
    } else if (
      !keyboard &&
      previous.index !== index &&
      weekStart(points[previous.index].date) !== weekStart(points[index].date)
    )
      haptic();
    scrub.current = { frac, index };
    if (!previous) setScrubbing(true);
    if (!previous || previous.index !== index) paintText(index);
    paintCursor();
    if (keyboard)
      announce(`${formatShortDate(points[index].date)}, ${formatMeters(points[index].total)}`);
  };
  const pointer = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || (e.pointerType !== 'mouse' && !dragging.current)) return;
    position(e.clientX, e.currentTarget);
  };
  const position = (clientX: number, node: HTMLDivElement) => {
    const bounds = rect.current ?? node.getBoundingClientRect();
    rect.current = bounds;
    pending.current = Math.max(0, Math.min(1, (clientX - bounds.left) / plotWidth(bounds)));
    if (frame.current === null)
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        if (pending.current !== null) show(pending.current);
      });
  };
  touchHandlers.current = {
    move: (clientX) => {
      if (chart.current) position(clientX, chart.current);
    },
    end: reset,
  };
  const selected = CHART_RANGES.indexOf(range);
  return (
    <section
      ref={section}
      aria-label="Season Mileage"
      className="sc"
      data-ahead={lastGap !== null && lastGap > 0 ? '' : undefined}
      style={
        {
          '--sc-bleed-l': `${bleed.left}px`,
          '--sc-bleed-r': `${bleed.right}px`,
        } as CSSProperties
      }
    >
      <div className="sc-head">
        <p ref={figure} className="sc-figure">
          {rest.figure}
        </p>
        <p ref={deltaText} className="sc-delta">
          {rest.delta}
        </p>
        {rest.pace && (
          <p ref={paceText} className={`sc-pace-text${rest.ahead ? ' is-ahead' : ''}`}>
            {rest.pace}
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
        className="sc-plot"
        data-scrubbing={scrubbing ? '' : undefined}
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
          const keyIndex = scrub.current?.index ?? points.length - 1;
          const next =
            e.key === 'Home'
              ? 0
              : e.key === 'End'
                ? points.length - 1
                : Math.max(
                    0,
                    Math.min(points.length - 1, keyIndex + (e.key === 'ArrowLeft' ? -1 : 1)),
                  );
          show(next / Math.max(1, points.length - 1), true);
        }}
      >
        <div aria-hidden="true" className="sc-baseline" />
        <div className="sc-canvas">
          <Plot
            id={id}
            line={geometry.linePath}
            area={geometry.areaPath}
            pace={geometry.pacePath}
            refs={svgPaths}
            clip={clip}
          />
          {!empty && last && (
            <div
              ref={endDot}
              aria-hidden="true"
              className="sc-end"
              style={{ translate: `0 ${geometry.endY}px` }}
            />
          )}
          {scrubbing && (
            <>
              <span ref={hair} aria-hidden="true" className="sc-hair" />
              <span ref={dot} aria-hidden="true" className="sc-dot" />
              <span ref={label} aria-hidden="true" className="sc-label" />
            </>
          )}
        </div>
      </div>
      <div aria-hidden="true" className="sc-axis">
        <span>{startAxis}</span>
        <span>Today</span>
      </div>
      <div role="group" aria-label="Chart Range" className="sc-ranges">
        <span
          aria-hidden="true"
          className="sc-pill"
          style={{ translate: `${selected * 100}% 0` }}
        />
        {CHART_RANGES.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={range === r}
            className="sc-range"
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
