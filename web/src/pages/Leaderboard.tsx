import { useLayoutEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../lib/motion';
import { PullToRefresh } from '../components/social/PullToRefresh';
import { useRefreshVisible } from '../lib/useRefreshVisible';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Flame, Gamepad2, Trophy } from 'lucide-react';
import { addDays } from '../../../shared/dates';
import { floorPercent } from '../../../shared/math';
import type { Config, LeaderboardRow } from '../../../shared/types';
import { HeaderActions } from '../components/shell/HeaderActions';
import { LoadState } from '../components/shell/LoadState';
import { BerkeleyRace } from '../components/BerkeleyRace';
import {
  Avatar,
  Button,
  EmptyState,
  IconButton,
  PageHeader,
  SegmentedControl,
  Skeleton,
} from '../components/ui';
import { cn } from '../lib/cn';
import { formatNumber } from '../lib/format';
import {
  formatWeekRange,
  hitTarget,
  LEADERBOARD_METRICS,
  parseMetric,
  parseWeek,
  profilePath,
  progressValue,
  rowFigures,
  rowLabel,
  seasonLabel,
  type LeaderboardMetric,
} from '../lib/leaderboard';
import { useConfig, useLeaderboard, useMe } from '../lib/queries';

const icon = { size: 16, strokeWidth: 1.75, 'aria-hidden': true } as const;

function Progress({ row }: { row: LeaderboardRow }) {
  const value = progressValue(row);
  return (
    <span
      role="progressbar"
      aria-label={`${row.user.name} progress toward target`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={floorPercent(value)}
      className="mt-1.5 block h-1 w-full overflow-hidden rounded-sm bg-surface-2"
    >
      <span
        className="drive-bar block h-full rounded-[inherit] bg-accent"
        style={{ width: `${value}%` }}
      />
    </span>
  );
}
function Badges({ row, centered = false }: { row: LeaderboardRow; centered?: boolean }) {
  const streak = row.streak >= 2;
  const hit = hitTarget(row);
  if (!streak && !hit) return null;
  return (
    <span
      className={cn(
        'mt-1.5 flex flex-wrap gap-x-2.5 gap-y-1 text-caption font-medium',
        centered ? 'justify-center' : '[justify-content:inherit]',
      )}
    >
      {streak && (
        <span className="inline-flex items-center gap-0.5 text-highlight-ink tabular-nums">
          <Flame {...icon} size={14} className="text-highlight" />
          <span aria-hidden="true">{formatNumber(row.streak)}</span>
          <span className="sr-only">{formatNumber(row.streak)} week streak</span>
        </span>
      )}
      {hit && (
        <span className="target-hit inline-flex items-center gap-0.5">
          <Check {...icon} size={14} />
          Target Hit
        </span>
      )}
    </span>
  );
}
function You() {
  return (
    <span className="inline-block whitespace-nowrap text-footnote font-semibold text-accent-ink">
      You
    </span>
  );
}
function Row({
  row,
  metric,
  meId,
  rowRef,
  pinned = false,
}: {
  row: LeaderboardRow;
  metric: LeaderboardMetric;
  meId?: string;
  rowRef?: (node: HTMLAnchorElement | null) => void;
  pinned?: boolean;
}) {
  const me = row.user.id === meId;
  const figures = rowFigures(row, metric);
  return (
    <Link
      ref={rowRef}
      to={profilePath(row, meId)}
      aria-label={rowLabel(row, metric, me)}
      className={cn(
        'grid min-h-16 grid-cols-[20px_36px_minmax(0,1fr)_88px] items-center gap-2 px-3 py-3 text-inherit transition-colors duration-fast ease-out focus-visible:outline-offset-[-3px] active:bg-divider motion-reduce:transition-none sm:grid-cols-[28px_36px_minmax(0,1fr)_112px] sm:gap-3 sm:px-4',
        !me && '[@media(hover:hover)_and_(pointer:fine)]:hover:bg-hover',
        me && 'is-me [background:var(--oyo-selected)]',
        pinned && 'is-pinned',
      )}
    >
      <span
        className="text-center text-subhead font-semibold tabular-nums text-muted"
        aria-hidden="true"
      >
        {formatNumber(row.rank)}
      </span>
      <Avatar name={row.user.name} imageId={row.user.avatar_image_id} size="sm" />
      <span className="min-w-0">
        <span className="block break-words text-callout font-medium">
          {row.user.name}
          {me && (
            <>
              {' '}
              <You />
            </>
          )}
        </span>
        <Progress row={row} />
        <Badges row={row} />
      </span>
      <span className="text-right" aria-hidden="true">
        <span className="block text-headline tabular-nums">{figures.main}</span>
        <span className="block text-caption text-muted tabular-nums">{figures.secondary}</span>
      </span>
    </Link>
  );
}
function Podium({
  rows,
  metric,
  meId,
  rowRef,
}: {
  rows: LeaderboardRow[];
  metric: LeaderboardMetric;
  meId?: string;
  rowRef: (node: HTMLAnchorElement | null) => void;
}) {
  return (
    <ol className="grid grid-cols-3 items-end gap-2" aria-label="Top Three">
      {rows.map((row, index) => {
        const me = row.user.id === meId;
        const figures = rowFigures(row, metric);
        return (
          <li
            key={row.user.id}
            value={row.rank}
            className="row-start-1 min-w-0"
            style={{ gridColumn: [2, 1, 3][index] }}
          >
            <Link
              ref={me ? rowRef : undefined}
              to={profilePath(row, meId)}
              aria-label={rowLabel(row, metric, me)}
              data-medal={(['gold', 'silver', 'bronze'] as const)[row.rank - 1]}
              style={{ minHeight: 256 - Math.min(2, row.rank - 1) * 28 }}
              className={cn(
                'podium-card flex h-full min-w-0 flex-col items-center justify-start gap-1 rounded-xl border border-divider p-3 text-center text-inherit transition-colors duration-fast ease-out active:bg-divider motion-reduce:transition-none',
                !me && '[@media(hover:hover)_and_(pointer:fine)]:hover:bg-hover',
                me && 'is-me',
              )}
            >
              <span
                className="podium-rank text-footnote font-semibold tabular-nums"
                aria-hidden="true"
              >
                {formatNumber(row.rank)}
              </span>
              <Avatar name={row.user.name} imageId={row.user.avatar_image_id} />
              <span className="line-clamp-2 max-w-full text-subhead font-medium [overflow-wrap:anywhere]">
                {row.user.name}
              </span>
              {me && <You />}
              <span className="text-headline tabular-nums" aria-hidden="true">
                {figures.main}
              </span>
              <Progress row={row} />
              <Badges row={row} centered />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
function SkeletonRows() {
  return (
    <div role="status" aria-label="Loading Rankings" className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[180px] rounded-card" />
        ))}
      </div>
      <div className="ui-list">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="grid min-h-16 grid-cols-[28px_36px_minmax(0,1fr)_auto] items-center gap-3 border-b border-divider px-4 py-3 last:border-b-0"
          >
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <span className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-1 w-full" />
            </span>
            <Skeleton className="h-5 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
/**
 * Shows the pinned You row only while your real row is off screen, and never over the podium:
 * a second observer watches the strip of viewport the pin occupies and holds the pin back
 * while any of the top three sits in it.
 */
function usePinned(node: HTMLElement | null, pin: HTMLElement | null) {
  const [visible, setVisible] = useState(true);
  const [blocked, setBlocked] = useState(true);
  useLayoutEffect(() => {
    setVisible(true);
    setBlocked(true);
    if (!node || !pin) return;
    let observers: IntersectionObserver[] = [];
    const observe = () => {
      observers.forEach((observer) => observer.disconnect());
      const top = document.querySelector('.ui-page-nav')?.getBoundingClientRect().height ?? 0;
      const pinHeight = pin.getBoundingClientRect().height;
      const bottom = (parseFloat(getComputedStyle(pin).bottom) || 0) + pinHeight;
      observers = [];
      // The podium strip first, so the row's observer is the latest (remeasured) one.
      const podium = pin.parentElement?.querySelector('[aria-label="Top Three"]');
      setVisible(true);
      setBlocked(!!podium);
      if (podium) {
        const strip = new IntersectionObserver(([entry]) => setBlocked(entry.isIntersecting), {
          rootMargin: `-${Math.max(0, Math.round(innerHeight - bottom))}px 0px -${Math.round(bottom - pinHeight)}px 0px`,
        });
        strip.observe(podium);
        observers.push(strip);
      }
      const row = new IntersectionObserver(([entry]) => setVisible(entry.intersectionRatio > 0), {
        rootMargin: `-${Math.round(top)}px 0px -${Math.round(bottom - pinHeight)}px 0px`,
        threshold: [0],
      });
      row.observe(node);
      observers.push(row);
    };
    observe();
    const resize = new ResizeObserver(observe);
    resize.observe(pin);
    resize.observe(node);
    window.addEventListener('resize', observe);
    return () => {
      window.removeEventListener('resize', observe);
      observers.forEach((observer) => observer.disconnect());
      resize.disconnect();
    };
  }, [node, pin]);
  return !visible && !blocked;
}

/**
 * FLIP reorder: when the metric or week changes, rows that stay on the board glide from their
 * old place to their new one (transform only, 420 ms on the drive curve), so a rank change
 * reads as movement rather than a reshuffle. Reduced motion: rows simply appear in place.
 */
function useRankFlip(list: HTMLElement | null, rows: LeaderboardRow[] | undefined) {
  const places = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    if (!list) return;
    const next = new Map<string, number>();
    const reduced = prefersReducedMotion();
    for (const item of list.querySelectorAll<HTMLElement>('[data-rank-id]')) {
      const id = item.dataset.rankId!;
      const top = item.offsetTop;
      const before = places.current.get(id);
      next.set(id, top);
      if (before === undefined || reduced || Math.abs(before - top) < 1) continue;
      item.animate?.(
        [{ transform: `translate3d(0, ${before - top}px, 0)` }, { transform: 'none' }],
        {
          duration: 420,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        },
      );
    }
    places.current = next;
  }, [list, rows]);
}

export default function Leaderboard() {
  const refresh = useRefreshVisible();
  const configQuery = useConfig();
  const header = (
    <PageHeader
      title="Leaderboard"
      trailing={
        <div className="flex items-center gap-1">
          <Link className="ui-icon-button" to="/games/leaderboard" aria-label="Games">
            <Gamepad2 size={20} strokeWidth={1.75} aria-hidden="true" />
          </Link>
          <HeaderActions />
        </div>
      }
    />
  );
  return (
    <>
      {header}
      <PullToRefresh label="Leaderboard" onRefresh={refresh}>
        {configQuery.data ? (
          <Board config={configQuery.data} />
        ) : (
          <LoadState error={configQuery.isError} retry={() => void configQuery.refetch()} />
        )}
      </PullToRefresh>
    </>
  );
}
function Board({ config }: { config: Config }) {
  const [params, setParams] = useSearchParams();
  const me = useMe().data;
  const currentWeek = config.current_week_start;
  const metric = parseMetric(params.get('metric'));
  const week = parseWeek(params.get('week'), currentWeek);
  const query = useLeaderboard(metric === 'season' ? { metric } : { week, metric });
  const [myRow, setMyRow] = useState<HTMLAnchorElement | null>(null);
  const [pin, setPin] = useState<HTMLDivElement | null>(null);
  const showPinned = usePinned(myRow, pin);
  const [rankList, setRankList] = useState<HTMLOListElement | null>(null);

  const update = (next: { metric?: LeaderboardMetric; week?: string }) => {
    const search = new URLSearchParams(params);
    const m = next.metric ?? metric;
    const w = next.week ?? week;
    if (m === 'percent') search.delete('metric');
    else search.set('metric', m);
    if (w === currentWeek) search.delete('week');
    else search.set('week', w);
    setParams(search, { replace: true, preventScrollReset: true });
  };

  const rows = query.data;
  const podium = rows ? rows.slice(0, 3) : [];
  const rest = rows ? rows.slice(podium.length) : [];
  const mine = rows?.find((r) => r.user.id === me?.id);
  useRankFlip(rankList, rows);
  const isCurrent = week === currentWeek;

  return (
    <div className="screen-stack leaderboard">
      <SegmentedControl
        label="Leaderboard Metric"
        value={metric}
        onChange={(m) => update({ metric: m })}
        options={LEADERBOARD_METRICS}
      />
      {metric === 'season' ? (
        <p className="flex min-h-11 flex-col items-center justify-center text-center">
          <span className="text-headline">{seasonLabel(config.today, config.season_start)}</span>
          <span className="text-footnote text-muted">Season So Far</span>
        </p>
      ) : (
        <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
          <IconButton
            aria-label="Previous Week"
            onClick={() => update({ week: addDays(week, -7) })}
          >
            <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
          </IconButton>
          <p
            className="flex min-h-11 flex-col items-center justify-center text-center"
            aria-live="polite"
          >
            <span className="text-headline tabular-nums">{formatWeekRange(week, currentWeek)}</span>
            <span className="text-footnote text-muted">
              {isCurrent
                ? 'This Week'
                : week === addDays(currentWeek, -7)
                  ? 'Last Week'
                  : 'Past Week'}
            </span>
          </p>
          <IconButton
            aria-label="Next Week"
            disabled={isCurrent}
            onClick={() => update({ week: addDays(week, 7) })}
          >
            <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
          </IconButton>
        </div>
      )}
      {metric !== 'season' && <BerkeleyRace week={week} />}
      {query.isError ? (
        <LoadState error retry={() => void query.refetch()} />
      ) : !rows ? (
        <SkeletonRows />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Trophy size={20} strokeWidth={1.75} />}
          title="No Rankings Yet"
          action={<Button to="/log">Log Workout</Button>}
        />
      ) : (
        <section aria-label="Rankings" className="space-y-4">
          {podium.length > 0 && (
            <Podium rows={podium} metric={metric} meId={me?.id} rowRef={setMyRow} />
          )}
          {rest.length > 0 && (
            <ol ref={setRankList} start={podium.length + 1} className="ui-list m-0 list-none p-0">
              {rest.map((row) => (
                <li
                  key={row.user.id}
                  data-rank-id={row.user.id}
                  value={row.rank}
                  className="border-b border-divider last:border-b-0"
                >
                  <Row
                    row={row}
                    metric={metric}
                    meId={me?.id}
                    rowRef={row.user.id === me?.id ? setMyRow : undefined}
                  />
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
      {mine && rest.some((row) => row.user.id === mine.user.id) && (
        <div
          ref={setPin}
          className={cn(
            'leaderboard-pin sticky bottom-[calc(80px+env(safe-area-inset-bottom))] z-10 lg:bottom-4',
            showPinned ? 'is-visible visible' : 'invisible',
          )}
          aria-hidden={!showPinned}
        >
          <div className="ui-list bg-surface">
            <Row row={mine} metric={metric} meId={me?.id} pinned />
          </div>
        </div>
      )}
    </div>
  );
}
