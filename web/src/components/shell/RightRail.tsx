import { Link } from 'react-router-dom';
import { useAnnouncements, useConfig, useWeekStats } from '../../lib/queries';
import { formatEMeters, formatEntryDate } from '../../lib/format';
import { addDays } from '../../../../shared/dates';
import { Card, ProgressRing, Skeleton } from '../ui';
export function RightRail() {
  const { data: week, isError } = useWeekStats();
  const { data: config } = useConfig();
  const { data: announcements = [] } = useAnnouncements();
  const daysLeft = config
    ? Math.max(
        0,
        Math.round(
          (Date.parse(addDays(config.current_week_start, 7)) - Date.parse(config.today)) / 86400000,
        ),
      )
    : null;
  return (
    <aside className="shell-rail" aria-label="Team Overview">
      <Card>
        <h2 className="text-headline">This Week</h2>
        {week ? (
          <>
            <div className="my-6 flex justify-center">
              <ProgressRing value={week.total_m} max={week.target_m} label="Weekly Target">
                <span className="text-title1">{Math.round(week.percent)}%</span>
                <span className="text-caption text-muted">Of Target</span>
              </ProgressRing>
            </div>
            <p className="text-center text-subhead">
              {formatEMeters(week.total_m, true)} / {formatEMeters(week.target_m, true)}
            </p>
            <p className="mt-1 text-center text-footnote text-muted">
              E-meters
              {daysLeft !== null ? ` · ${daysLeft} ${daysLeft === 1 ? 'Day' : 'Days'} Left` : ''}
            </p>
            <Link
              to="/"
              className="mt-4 flex min-h-11 items-center justify-center text-subhead font-medium"
            >
              View Your Week
            </Link>
          </>
        ) : isError ? (
          <p className="mt-4 text-subhead text-muted">Weekly progress is unavailable</p>
        ) : (
          <Skeleton className="mt-6 h-48" />
        )}
      </Card>
      <section className="mt-8">
        <h2 className="mb-4 px-1 text-headline">Pinned Announcements</h2>
        {announcements
          .filter((a) => a.pinned)
          .map((a) => (
            <article key={a.id} className="border-b border-divider px-1 pb-5">
              <h3 className="text-subhead font-medium">{a.title}</h3>
              <p className="mt-2 line-clamp-3 text-footnote text-muted">{a.body}</p>
              <p className="mt-3 text-caption text-muted">
                {a.author.name} · {formatEntryDate(a.created_at.slice(0, 10))}
              </p>
            </article>
          ))}
      </section>
    </aside>
  );
}
