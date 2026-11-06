import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Flame, Trophy } from 'lucide-react';
import { addDays } from '../../../shared/dates';
import type { Config, LeaderboardRow } from '../../../shared/types';
import { HeaderActions } from '../components/shell/HeaderActions';
import { LoadState } from '../components/shell/LoadState';
import {
  Avatar,
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
      aria-valuenow={Math.floor(value)}
      className="leaderboard-bar"
    >
      <span style={{ width: `${value}%` }} />
    </span>
  );
}
function Badges({ row }: { row: LeaderboardRow }) {
  const streak = row.streak >= 2;
  const hit = hitTarget(row);
  if (!streak && !hit) return null;
  return (
    <span className="leaderboard-badges">
      {streak && (
        <span className="leaderboard-streak">
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
  return <span className="leaderboard-you">You</span>;
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
        'leaderboard-row grid min-h-16 grid-cols-[28px_36px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3',
        me && 'is-me [background:var(--oyo-selected)]',
        pinned && 'is-pinned',
      )}
    >
      <span className="leaderboard-rank" aria-hidden="true">
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
        <span className="block text-footnote text-muted tabular-nums">{figures.secondary}</span>
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
    <ol className="grid grid-cols-3 gap-2" aria-label="Top Three">
      {rows.map((row) => {
        const me = row.user.id === meId;
        const figures = rowFigures(row, metric);
        return (
          <li key={row.user.id} value={row.rank} className="min-w-0">
            <Link
              ref={me ? rowRef : undefined}
              to={profilePath(row, meId)}
              aria-label={rowLabel(row, metric, me)}
              className={cn(
                'leaderboard-podium min-w-0 rounded-xl border border-divider p-3',
                row.rank === 1 && 'border-t-2 border-t-accent',
                me ? 'is-me [background:var(--oyo-selected)]' : 'bg-surface',
              )}
            >
              <span
                className="text-footnote font-semibold tabular-nums text-muted"
                aria-hidden="true"
              >
                {formatNumber(row.rank)}
              </span>
              <Avatar name={row.user.name} imageId={row.user.avatar_image_id} />
              <span className="leaderboard-podium-name">{row.user.name}</span>
              {me && <You />}
              <span className="text-headline tabular-nums" aria-hidden="true">
                {figures.main}
              </span>
              <Progress row={row} />
              <Badges row={row} />
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
function usePinned(node: HTMLElement | null) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    if (!node) return;
    const top = document.querySelector('.ui-page-nav')?.getBoundingClientRect().height ?? 0;
    const bar = document.querySelector('.shell-tabbar')?.getBoundingClientRect().height ?? 0;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.intersectionRatio >= 0.98),
      {
        rootMargin: `-${Math.round(top)}px 0px -${Math.round(bar)}px 0px`,
        threshold: [0, 0.98, 1],
      },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return !visible;
}

export default function Leaderboard() {
  const configQuery = useConfig();
  const header = <PageHeader title="Leaderboard" trailing={<HeaderActions />} />;
  return (
    <>
      {header}
      {configQuery.data ? (
        <Board config={configQuery.data} />
      ) : (
        <LoadState error={configQuery.isError} retry={() => void configQuery.refetch()} />
      )}
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
  const showPinned = usePinned(myRow);

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
  const podium = rows && rows.length >= 3 ? rows.slice(0, 3) : [];
  const rest = rows ? rows.slice(podium.length) : [];
  const mine = rows?.find((r) => r.user.id === me?.id);
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
        <p className="leaderboard-scope">
          <span className="text-headline">{seasonLabel(config.today, config.season_start)}</span>
          <span className="text-footnote text-muted">Season So Far</span>
        </p>
      ) : (
        <div className="leaderboard-week">
          <IconButton
            aria-label="Previous Week"
            onClick={() => update({ week: addDays(week, -7) })}
          >
            <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
          </IconButton>
          <p className="leaderboard-scope" aria-live="polite">
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
      {query.isError ? (
        <LoadState error retry={() => void query.refetch()} />
      ) : !rows ? (
        <SkeletonRows />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Trophy size={20} strokeWidth={1.75} />}
          title="No Rankings Yet"
          body="Rankings appear after eligible teammates log workouts."
        />
      ) : (
        <section aria-label="Rankings" className="space-y-4">
          {podium.length > 0 && (
            <Podium rows={podium} metric={metric} meId={me?.id} rowRef={setMyRow} />
          )}
          {rest.length > 0 && (
            <ol start={podium.length + 1} className="ui-list leaderboard-list">
              {rest.map((row) => (
                <li
                  key={row.user.id}
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
          <p className="px-1 text-footnote text-muted">
            {metric === 'season'
              ? 'Season percent compares each rower’s season total with the sum of their own weekly targets so far.'
              : 'Percent compares each rower’s total with their own weekly target, so every group ranks fairly.'}
          </p>
        </section>
      )}
      {mine && (
        <div
          className={cn('leaderboard-pin', showPinned && 'is-visible')}
          aria-hidden={!showPinned}
        >
          <div className="ui-list">
            <Row row={mine} metric={metric} meId={me?.id} pinned />
          </div>
        </div>
      )}
    </div>
  );
}
