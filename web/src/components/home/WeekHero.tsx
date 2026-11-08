import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Check, Flame } from 'lucide-react';
import type { WeekStats } from '../../../../shared/types';
import { formatEMeters, formatMeters, formatNumber, formatPercent } from '../../lib/format';
import { ProgressRing } from '../ui/ProgressRing';
import { Ticker } from '../ui/Ticker';

const dayLetter = (date: string) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'narrow', timeZone: 'UTC' }).format(
    new Date(date + 'T12:00:00Z'),
  );

export function WeekHero({
  week,
  today,
  days,
  personal,
  streak,
  previous,
  finishing,
}: {
  week: WeekStats;
  today: string;
  days: number;
  personal: boolean;
  streak?: number;
  previous?: number;
  finishing?: boolean;
}) {
  const remaining = Math.max(0, week.target_m - week.total_m);
  const peak = Math.max(1, ...week.by_day.map((d) => d.equiv_m));
  return (
    <Link to="/me/target" aria-label="Weekly Progress. Change Your Target" className="drive-hero">
      <div className="flex items-center justify-between gap-3">
        <span className="text-subhead font-semibold drive-hero-soft">
          {personal ? 'Personal Target' : 'Weekly Target'}
        </span>
        {!!streak && (
          <span className="drive-chip drive-chip-streak">
            <Flame size={14} strokeWidth={2} aria-hidden="true" />
            {formatNumber(streak)} Week Streak
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-display">
            <Ticker
              id="week-total"
              value={week.total_m}
              from={previous}
              format={(n) => formatMeters(n, true)}
            />
          </p>
          <p className="mt-2 text-subhead drive-hero-soft">
            of {formatMeters(week.target_m, true)} E-meters
          </p>
        </div>
        <ProgressRing
          size={104}
          value={week.total_m}
          previousValue={previous}
          id="week"
          max={week.target_m}
          label="Weekly Target"
        >
          <span className="text-title3 tabular-nums">{formatPercent(week.percent)}</span>
        </ProgressRing>
      </div>
      <div className="drive-week" aria-hidden="true">
        {week.by_day.map((d, i) => (
          <span
            key={d.date}
            className={`drive-day ${d.date === today ? 'is-today' : ''} ${d.date > today ? 'is-future' : ''}`}
          >
            <span className="drive-day-track">
              <span
                className="drive-day-fill"
                style={
                  {
                    '--fill': d.equiv_m ? Math.max(0.12, d.equiv_m / peak) : 0,
                    '--i': i,
                  } as CSSProperties
                }
              />
            </span>
            {dayLetter(d.date)}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-footnote font-semibold">
        {week.hit_target ? (
          <span className="drive-chip">
            <Check
              size={14}
              strokeWidth={2.5}
              aria-hidden="true"
              className={finishing ? 'ui-finish-tick' : ''}
            />
            Target Hit
          </span>
        ) : (
          <span className="drive-chip">{formatEMeters(remaining)} remaining</span>
        )}
        <span className="drive-hero-soft">
          {days === 1 ? 'Last Day' : `${formatNumber(days)} Days Left`}
        </span>
      </div>
    </Link>
  );
}
