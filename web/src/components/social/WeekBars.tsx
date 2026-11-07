import { useEffect, useId, useRef, useState } from 'react';
import type { WeekSummary } from '../../../../shared/types';
import { formatEMeters, formatMeters, formatShortDate } from '../../lib/format';
import { Disclosure } from '../ui';

export function WeekBars({ weeks }: { weeks: WeekSummary[] }) {
  const title = useId();
  const desc = useId();
  const recent = [...weeks].sort((a, b) => a.week_start.localeCompare(b.week_start)).slice(-12);
  const [chosen, setChosen] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const latest = recent.at(-1)?.week_start;
  useEffect(() => {
    if (track.current) track.current.scrollLeft = track.current.scrollWidth;
  }, [latest]);
  const selected = recent.find((w) => w.week_start === chosen) ?? recent.at(-1);
  const best = recent.reduce<WeekSummary | undefined>(
    (a, b) => (!a || b.total_m > a.total_m ? b : a),
    undefined,
  );
  const ceiling = Math.max(0, ...recent.flatMap((w) => [w.total_m, w.target_m]));
  const baseline = 180;
  const y = (value: number) => baseline - (ceiling ? value / ceiling : 0) * 140;
  const step = 600 / Math.max(1, recent.length);
  return (
    <section aria-label="Weekly Training" className="space-y-3">
      <h2 className="text-title3">Weekly Training</h2>
      {recent.length > 0 && (
        <p className="text-footnote text-muted">
          Last {recent.length} Weeks<span className="sm:hidden"> · Scroll for earlier weeks</span>
        </p>
      )}
      <div className="rounded-xl border border-divider bg-surface p-4">
        {recent.length ? (
          <>
            <div ref={track} className="overflow-x-auto">
              <svg
                viewBox="0 0 680 220"
                className="w-full min-w-[640px]"
                aria-labelledby={`${title} ${desc}`}
              >
                <title id={title}>Last {recent.length} Weeks</title>
                <desc id={desc}>
                  E-meters from zero. Cardinal bars show totals; dashed segments show each weekly
                  target. The orange marker denotes the best week. Select a week for exact values.
                </desc>
                <text x="0" y="18" fill="var(--muted)" fontSize="13">
                  E-meters
                </text>
                <text x="0" y={baseline + 4} fill="var(--muted)" fontSize="13">
                  0
                </text>
                <line x1="40" x2="660" y1={baseline} y2={baseline} stroke="var(--divider)" />
                {recent.map((w, i) => {
                  const x = 50 + i * step;
                  const width = Math.min(32, step - 12);
                  const label = formatShortDate(w.week_start).split(', ')[1];
                  return (
                    <g key={w.week_start} className="social-week-column">
                      <rect
                        x={x}
                        y={y(w.total_m)}
                        width={width}
                        height={baseline - y(w.total_m)}
                        fill="var(--accent)"
                      />
                      {w.target_m > 0 && (
                        <line
                          x1={x - 3}
                          x2={x + width + 3}
                          y1={y(w.target_m)}
                          y2={y(w.target_m)}
                          stroke="var(--text)"
                          strokeWidth="1.5"
                          strokeDasharray="4 4"
                        />
                      )}
                      {best === w && w.total_m > 0 && (
                        <circle
                          cx={x + width / 2}
                          cy={y(w.total_m) - 8}
                          r="4"
                          fill="var(--highlight-ink)"
                        />
                      )}
                      <rect
                        x={x - 5}
                        y="26"
                        width={Math.max(48, width + 10)}
                        height="162"
                        fill="transparent"
                        className="social-week-hit"
                        role="button"
                        tabIndex={0}
                        aria-pressed={selected === w}
                        aria-label={`Week of ${formatShortDate(w.week_start)}: ${formatEMeters(w.total_m)}, ${w.target_m > 0 ? `target ${formatMeters(w.target_m)}` : 'no target'}`}
                        onClick={() => setChosen(w.week_start)}
                        onMouseEnter={() => setChosen(w.week_start)}
                        onFocus={() => setChosen(w.week_start)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setChosen(w.week_start);
                          }
                        }}
                      />
                      <text
                        x={x + width / 2}
                        y="210"
                        textAnchor="middle"
                        fill="var(--muted)"
                        fontSize="13"
                      >
                        {label}
                      </text>
                      {selected === w && (
                        <line
                          className="social-week-selection"
                          x1={x - 3}
                          x2={x + width + 3}
                          y1="218"
                          y2="218"
                          stroke="var(--accent)"
                          strokeWidth="2"
                        />
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
            <p className="text-caption text-muted">
              Dashed line: Weekly Target · Orange marker: Best Week
            </p>
            <p role="status" className="mt-3 min-h-11 text-subhead tabular-nums">
              {selected && (
                <>
                  Week of {formatShortDate(selected.week_start)} · {formatEMeters(selected.total_m)}{' '}
                  ·{' '}
                  {selected.target_m > 0
                    ? `Target ${formatMeters(selected.target_m)}`
                    : 'No target'}
                </>
              )}
            </p>
          </>
        ) : (
          <p className="text-subhead text-muted">No weekly data yet</p>
        )}
      </div>
      <Disclosure title="View Data" open={table} onChange={setTable}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-footnote tabular-nums">
            <caption className="sr-only">Weekly E-Meters and Targets</caption>
            <thead>
              <tr>
                <th scope="col" className="p-2">
                  Week Of
                </th>
                <th scope="col" className="p-2">
                  E-Meters
                </th>
                <th scope="col" className="p-2">
                  Target
                </th>
              </tr>
            </thead>
            <tbody>
              {recent.map((w) => (
                <tr key={w.week_start} className="border-t border-divider">
                  <th scope="row" className="p-2 font-normal">
                    {formatShortDate(w.week_start)}
                  </th>
                  <td className="p-2">{formatMeters(w.total_m)}</td>
                  <td className="p-2">{w.target_m > 0 ? formatMeters(w.target_m) : 'No target'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Disclosure>
    </section>
  );
}
