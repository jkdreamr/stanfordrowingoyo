import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, X } from 'lucide-react';
import type { Config, User } from '../../../shared/types';
import { addDays } from '../../../shared/dates';
import { recapKey, recapVisible } from '../lib/recap';
import { useWeeklyRecap } from '../lib/queries';
import { formatEMeters, formatNumber, formatPercent } from '../lib/format';
import { Card, IconButton } from './ui';

export function LastWeekRecap({ user, config }: { user: User; config: Config }) {
  const week = addDays(config.current_week_start, -7),
    key = recapKey(user.id, week);
  const [dismissed, setDismissed] = useState<string>();
  const visible = dismissed !== key && recapVisible(user, config);
  const recap = useWeeklyRecap(week, visible);
  if (!visible || recap.isError || !recap.data) return null;
  const data = recap.data;
  return (
    <Card className="relative" role="region" aria-label="Last Week">
      <Link
        to={`/recap?week=${week}`}
        className="block min-h-11 rounded-lg focus-visible:outline-accent"
        aria-label="View Last Week Recap"
      >
        <h2 className="pr-12 text-headline">Last Week</h2>
        <p className="mt-3 text-title2 tabular-nums">
          {formatEMeters(data.total_m, true)}{' '}
          <span className="text-subhead font-normal text-muted">
            / {formatEMeters(data.target_m, true)} E-meters
          </span>
        </p>
        <div className="mt-2 flex items-center justify-between text-footnote text-muted">
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
