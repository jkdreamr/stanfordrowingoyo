import { useEffect, useState } from 'react';
import type { RaceWeek, TeamRace } from '../../../shared/types';
import { ghostMeters, raceLeader } from '../../../shared/race';
import { formatCompactMeters } from '../lib/format';
import { useRace } from '../lib/queries';
import { Card, Skeleton } from './ui';

const TICK_MS = 60_000;

/** Berkeley's position now, advanced locally from the server's `as_of`. */
export function raceAt(week: RaceWeek, now: number) {
  const final = week.status === 'final' || now >= Date.parse(week.ends_at);
  const berkeley = final
    ? week.berkeley_total_m
    : ghostMeters(week.berkeley_total_m, Date.parse(week.starts_at), Date.parse(week.ends_at), now);
  return { final, berkeley, stanford: week.stanford_m };
}
export function raceResult(stanford: number, berkeley: number, final: boolean) {
  const leader = raceLeader(stanford, berkeley);
  if (leader === 'tied') return { leader, text: 'Tied' };
  const name = leader === 'stanford' ? 'Stanford' : 'Berkeley';
  return {
    leader,
    text: `${name} ${final ? 'Won' : 'Ahead'} by ${formatCompactMeters(Math.abs(stanford - berkeley))} E-meters`,
  };
}
function useNow(race: TeamRace | undefined, updatedAt: number) {
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  return race ? Date.parse(race.as_of) + Math.max(0, clock - updatedAt) : clock;
}
function Lane({
  name,
  value,
  max,
  tone,
}: {
  name: string;
  value: number;
  max: number;
  tone: 'stanford' | 'berkeley';
}) {
  return (
    <div className="race-lane">
      <span className="text-subhead">{name}</span>
      <span className="race-track" aria-hidden="true">
        <span
          className={`race-fill race-fill-${tone} drive-bar drive-bar-once block`}
          style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
        />
      </span>
      <span className="text-subhead tabular-nums">{formatCompactMeters(value)}</span>
    </div>
  );
}
export function BerkeleyRace({ week }: { week: string }) {
  const query = useRace({ week });
  const now = useNow(query.data, query.dataUpdatedAt);
  if (query.isError) return null;
  const race = query.data;
  if (!race)
    return (
      <Card className="race-module space-y-3" aria-busy="true">
        <Skeleton className="h-11 w-48 rounded-md" />
        <Skeleton className="h-5 rounded-md" />
        <Skeleton className="h-5 rounded-md" />
      </Card>
    );
  if (race.week.rowers === 0) return null;
  const current = raceAt(race.week, now);
  const result = raceResult(current.stanford, current.berkeley, current.final);
  const max = Math.max(race.week.berkeley_total_m, current.stanford, current.berkeley, 1);
  const last = race.previous.rowers > 0 ? raceAt(race.previous, now) : undefined;
  return (
    <Card className="race-module space-y-3">
      <section aria-label="Stanford vs Berkeley" className="space-y-3">
        <div>
          <h2 className="text-headline">Stanford vs Berkeley</h2>
          <p
            className={`text-subhead font-semibold tabular-nums ${
              result.leader === 'stanford' ? 'text-accent-ink' : ''
            }`}
          >
            {result.text}
          </p>
        </div>
        <div className="space-y-2">
          <Lane name="Stanford" value={current.stanford} max={max} tone="stanford" />
          <Lane name="Berkeley" value={current.berkeley} max={max} tone="berkeley" />
        </div>
        {last && !current.final && (
          <p className="text-footnote text-muted">
            Last Week: {raceResult(last.stanford, last.berkeley, true).text}
          </p>
        )}
      </section>
    </Card>
  );
}
