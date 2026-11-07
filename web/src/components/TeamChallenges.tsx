import type { TeamChallenge } from '../../../shared/types';
import { useChallenges } from '../lib/queries';
import { formatEMeters, formatNumber, formatShortDate } from '../lib/format';
import { Card } from './ui';

export function challengeMeters(row: TeamChallenge, value: number) {
  return row.unit === 'km'
    ? formatNumber(value / 1000, Number.isInteger(value / 1000) ? 0 : 1)
    : formatEMeters(value);
}
export function ChallengeProgress({ challenge: row }: { challenge: TeamChallenge }) {
  const reached = row.progress_m >= row.goal_m;
  return (
    <>
      <div
        role="progressbar"
        aria-label={row.title}
        aria-valuemin={0}
        aria-valuemax={row.goal_m}
        aria-valuenow={Math.min(row.goal_m, Math.max(0, row.progress_m))}
        aria-valuetext={`${challengeMeters(row, row.progress_m)} / ${challengeMeters(row, row.goal_m)}${row.unit === 'km' ? ' km' : ''}`}
        className="h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, Math.max(0, row.percent))}%`,
            background: reached ? 'var(--highlight)' : 'var(--accent)',
          }}
        />
      </div>
      <p className="text-subhead tabular-nums">
        {challengeMeters(row, row.progress_m)} / {challengeMeters(row, row.goal_m)}
        {row.unit === 'km' ? ' km' : ''}
      </p>
    </>
  );
}
export function ChallengeDates({ challenge: row }: { challenge: TeamChallenge }) {
  return (
    <p className="text-footnote text-muted">
      {formatShortDate(row.start_date)} – {formatShortDate(row.end_date)}
      {row.modality && ` · ${{ erg: 'Erg', bike: 'Bike', run: 'Run' }[row.modality]}`}
    </p>
  );
}
export function TeamChallenges({ today }: { today: string }) {
  const query = useChallenges();
  const active = query.data?.filter((row) => row.status === 'active') ?? [];
  if (query.isError || !active.length) return null;
  return (
    <section aria-label="Team Challenges" className="space-y-3">
      {active.map((row) => {
        const days = Math.max(
          0,
          Math.round(
            (Date.parse(row.end_date + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 86400000,
          ),
        );
        return (
          <Card key={row.id} className="space-y-3">
            <h2 className="text-headline">{row.title}</h2>
            <ChallengeProgress challenge={row} />
            <p className="text-footnote text-muted">
              {days === 0 ? 'Last Day' : `${days} ${days === 1 ? 'Day' : 'Days'} Left`}
            </p>
          </Card>
        );
      })}
    </section>
  );
}
