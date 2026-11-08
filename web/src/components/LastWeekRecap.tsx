import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, X } from 'lucide-react';
import type { Config, User } from '../../../shared/types';
import { addDays } from '../../../shared/dates';
import { raceOutcome, recapKey, recapRange, recapVisible } from '../lib/recap';
import { useWeeklyRecap } from '../lib/queries';
import { formatMeters, formatNumber, formatPercent } from '../lib/format';
import { Card, IconButton } from './ui';
import { Ticker } from './ui/Ticker';

function Figure({ label, children, tone }: { label: string; children: ReactNode; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col-reverse gap-1">
      <dt className="text-footnote text-muted">{label}</dt>
      <dd className={`text-title2 tabular-nums ${tone ?? ''}`}>{children}</dd>
    </div>
  );
}

export function LastWeekRecap({ user, config }: { user: User; config: Config }) {
  const week = addDays(config.current_week_start, -7),
    key = recapKey(user.id, week);
  const [dismissed, setDismissed] = useState<string>();
  const visible = dismissed !== key && recapVisible(user, config);
  const recap = useWeeklyRecap(week, visible);
  if (!visible || recap.isError || !recap.data) return null;
  const data = recap.data;
  const race = data.race && raceOutcome(data.race);
  return (
    <Card className="recap-card relative" role="region" aria-label="Last Week">
      <Link
        to={`/recap?week=${week}`}
        className="block min-h-11 rounded-lg focus-visible:outline-accent"
        aria-label="View Last Week Recap"
      >
        <h2 className="pr-12 text-headline">Last Week</h2>
        <p className="text-footnote text-muted tabular-nums">{recapRange(week)}</p>
        <dl className="mt-4 grid grid-cols-3 gap-3">
          <Figure label="E-meters">
            <Ticker
              id={`recap:${week}:home`}
              value={data.total_m}
              format={(n) => formatMeters(n, true)}
            />
          </Figure>
          {data.rank !== null ? (
            <Figure label="Team Rank">#{formatNumber(data.rank)}</Figure>
          ) : (
            <Figure label="Workouts">{formatNumber(data.entry_count)}</Figure>
          )}
          {race ? (
            <Figure
              label="vs Berkeley"
              tone={race.leader === 'stanford' ? 'text-accent-ink' : undefined}
            >
              {race.word}
            </Figure>
          ) : (
            <Figure label="Of Target">{formatPercent(data.percent)}</Figure>
          )}
        </dl>
        <div className="mt-3 flex items-center justify-between text-footnote text-muted">
          <span>
            {formatPercent(data.percent)} · {formatNumber(data.entry_count)}{' '}
            {data.entry_count === 1 ? 'Workout' : 'Workouts'}
          </span>
          <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
        </div>
      </Link>
      <div className="absolute right-2 top-2">
        <IconButton
          aria-label="Dismiss Last Week Recap"
          onClick={() => {
            setDismissed(key);
            try {
              localStorage.setItem(key, '1');
            } catch {
              /* Storage can be unavailable */
            }
          }}
        >
          <X size={20} strokeWidth={1.75} />
        </IconButton>
      </div>
    </Card>
  );
}
