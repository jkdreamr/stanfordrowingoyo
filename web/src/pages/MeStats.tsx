import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CircleCheck, Flame } from 'lucide-react';
import type { SeasonStats } from '../../../shared/types';
import { addDays } from '../../../shared/dates';
import { ZONES } from '../../../shared/math';
import { Disclosure, ZoneChip } from '../components/ui';
import { formatMeters, formatNumber, formatShortDate } from '../lib/format';

const weekLabel = (date: string) =>
  `${formatShortDate(date)} – ${formatShortDate(addDays(date, 6))}`;
function WeeklyChart({ stats }: { stats: SeasonStats }) {
  const [selected, select] = useState(Math.max(0, stats.weeks.length - 1));
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(320);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => setAvailableWidth(entry.contentRect.width));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const weeks = stats.weeks;
  const current = weeks[Math.min(selected, weeks.length - 1)];
  const max = Math.max(1, ...weeks.flatMap((w) => [w.total_m, w.target_m])) * 1.1;
  const width = Math.max(availableWidth, weeks.length * 14 + 64);
  const step = (width - 64) / Math.max(1, weeks.length);
  const y = (n: number) => 188 - (n / max) * 156;
  return (
    <section className="mt-6" aria-label="Weekly E-meters">
      <h3 className="text-headline">Weekly Volume</h3>
      <p className="mt-1 text-footnote text-muted">
        E-meters · Dashed segments show each week’s target
      </p>
      <div
        ref={container}
        className="mt-4 overflow-x-auto rounded-xl border border-divider bg-surface p-4"
      >
        <svg
          role="img"
          tabIndex={0}
          aria-label={`Weekly volume. ${current ? `${weekLabel(current.week_start)}: ${formatMeters(current.total_m)}. ` : ''}Use Left and Right to select a week.`}
          width={width}
          height="232"
          className="max-w-none [&[data-pointer-focus]]:outline-none"
          onPointerDown={(e) => e.currentTarget.setAttribute('data-pointer-focus', '')}
          onBlur={(e) => e.currentTarget.removeAttribute('data-pointer-focus')}
          onClick={(e) => {
            const bounds = e.currentTarget.getBoundingClientRect();
            select(
              Math.max(
                0,
                Math.min(weeks.length - 1, Math.floor((e.clientX - bounds.left - 32) / step)),
              ),
            );
          }}
          onKeyDown={(e) => {
            e.currentTarget.removeAttribute('data-pointer-focus');
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
            e.preventDefault();
            select(
              e.key === 'Home'
                ? 0
                : e.key === 'End'
                  ? weeks.length - 1
                  : Math.max(
                      0,
                      Math.min(weeks.length - 1, selected + (e.key === 'ArrowLeft' ? -1 : 1)),
                    ),
            );
          }}
        >
          <title>Weekly E-meters and Versioned Targets</title>
          <desc>
            Cardinal bars show training volume. Dashed segments show weekly targets. Orange dots
            mark target-hit weeks.
          </desc>
          <line x1="32" x2={width - 32} y1="188" y2="188" stroke="var(--divider)" />
          <text x="0" y="192" fill="var(--muted)" fontSize="12">
            0
          </text>
          <text x="0" y="20" fill="var(--muted)" fontSize="12">
            {formatMeters(max, true)}
          </text>
          {weeks.map((w, i) => {
            const x = 32 + i * step;
            return (
              <g key={w.week_start}>
                {i === selected && (
                  <rect x={x} y="28" width={step} height="164" fill="var(--surface-2)" />
                )}
                <rect
                  x={x + 2}
                  y={y(w.total_m)}
                  width={Math.max(2, step - 4)}
                  height={188 - y(w.total_m)}
                  rx="1"
                  fill="var(--accent)"
                />
                {w.target_m > 0 && (
                  <line
                    x1={x}
                    x2={x + step}
                    y1={y(w.target_m)}
                    y2={y(w.target_m)}
                    stroke="var(--text)"
                    strokeDasharray="3 3"
                  />
                )}
                {w.hit_target && (
                  <circle cx={x + step / 2} cy={y(w.total_m) - 6} r="2.5" fill="var(--highlight)" />
                )}
                {(i === weeks.length - 1 ||
                  (i % 8 === 0 && (weeks.length - 1 - i) * step >= 64)) && (
                  <text
                    x={x}
                    y="216"
                    fill="var(--muted)"
                    fontSize="12"
                    textAnchor={i === weeks.length - 1 ? 'end' : 'start'}
                  >
                    {new Date(w.week_start + 'T12:00Z').toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      timeZone: 'UTC',
                    })}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div aria-live="polite" className="h-24 py-3 text-subhead tabular-nums">
        {current ? (
          <>
            <p className="font-medium">{weekLabel(current.week_start)}</p>
            <p className="mt-1">
              {formatMeters(current.total_m)} E-meters{' '}
              <span className="text-muted">· Target {formatMeters(current.target_m)}</span>
            </p>
            {current.hit_target && (
              <p className="mt-1 flex items-center gap-1 text-highlight-ink">
                <CircleCheck size={16} strokeWidth={1.75} aria-hidden="true" />
                Target Hit
              </p>
            )}
          </>
        ) : (
          <p className="text-muted">No weeks in this period</p>
        )}
      </div>
      <Disclosure title="View Data" open={open} onChange={setOpen}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-footnote tabular-nums">
            <caption className="sr-only">Weekly E-meters and Targets</caption>
            <thead>
              <tr>
                <th scope="col" className="py-3 pr-4">
                  Week
                </th>
                <th scope="col" className="pr-4">
                  E-meters
                </th>
                <th scope="col" className="pr-4">
                  Target
                </th>
                <th scope="col">Target Hit</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.week_start} className="border-t border-divider">
                  <th scope="row" className="whitespace-nowrap py-3 pr-4 font-normal">
                    {weekLabel(w.week_start)}
                  </th>
                  <td className="pr-4">{formatMeters(w.total_m)}</td>
                  <td className="pr-4">{formatMeters(w.target_m)}</td>
                  <td>{w.hit_target ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Disclosure>
    </section>
  );
}
export function MeStats({ stats, today }: { stats: SeasonStats; today: string }) {
  const elapsed = stats.weeks.filter((w) => w.week_start <= today).length;
  const best = stats.best_week;
  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-6 py-2 tabular-nums">
        <div>
          <dt className="text-footnote text-muted">Total E-meters</dt>
          <dd className="mt-1 text-title1">{formatMeters(stats.total_m)}</dd>
        </div>
        <div>
          <dt className="text-footnote text-muted">Current Streak</dt>
          <dd className="mt-1 flex items-center gap-1 text-title1">
            {stats.streak >= 2 && (
              <Flame
                className="text-highlight-ink"
                size={24}
                strokeWidth={1.75}
                aria-hidden="true"
              />
            )}
            {formatNumber(stats.streak)} <span className="text-subhead text-muted">weeks</span>
          </dd>
        </div>
        <div>
          <dt className="text-footnote text-muted">Best Week</dt>
          <dd className="mt-1 text-title2">
            {best && best.total_m > 0 && (
              <span
                aria-hidden="true"
                className="mr-2 inline-block size-2 rounded-full bg-highlight"
              />
            )}
            {formatMeters(best?.total_m ?? 0)}
            <span className="mt-1 block text-caption text-muted">
              {best && best.total_m > 0 ? weekLabel(best.week_start) : 'No sessions yet'}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-footnote text-muted">Average Per Week</dt>
          <dd className="mt-1 text-title2">
            {formatMeters(elapsed ? stats.total_m / elapsed : 0)}
            <span className="mt-1 block text-caption text-muted">
              Across {formatNumber(elapsed)} elapsed weeks
            </span>
          </dd>
        </div>
      </dl>
      <WeeklyChart key={stats.start} stats={stats} />
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section>
          <h3 className="text-headline">By Modality</h3>
          <div className="mt-4 space-y-4">
            {(['erg', 'bike', 'run'] as const).map((mode) => (
              <Breakdown
                key={mode}
                label={mode === 'erg' ? 'Erg' : mode === 'bike' ? 'Bike' : 'Run'}
                value={stats.by_modality[mode]}
                total={stats.total_m}
              />
            ))}
          </div>
        </section>
        <section>
          <h3 className="text-headline">By Zone</h3>
          <div className="mt-4 space-y-4">
            {ZONES.filter((z) => stats.by_zone[z] > 0).map((z) => (
              <Breakdown
                key={z}
                label={
                  <span className="inline-flex items-center gap-2">
                    Zone <ZoneChip zone={z} />
                  </span>
                }
                value={stats.by_zone[z]}
                total={stats.total_m}
              />
            ))}
            {stats.total_m === 0 && (
              <p className="text-subhead text-muted">
                Zone breakdown appears after your first session
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
function Breakdown({ label, value, total }: { label: ReactNode; value: number; total: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2 text-footnote">
        <span>{label}</span>
        <span className="text-muted tabular-nums">{formatMeters(value)}</span>
      </div>
      <div className="h-1 overflow-hidden rounded bg-surface-2">
        <div
          className="h-full bg-accent"
          style={{ width: `${total ? (value / total) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}
