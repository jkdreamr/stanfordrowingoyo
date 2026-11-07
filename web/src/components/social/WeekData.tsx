import { useState } from 'react';
import type { WeekSummary } from '../../../../shared/types';
import { formatMeters, formatShortDate } from '../../lib/format';
import { CalendarDays } from 'lucide-react';
import { Disclosure, EmptyState } from '../ui';

export function WeekData({ weeks }: { weeks: WeekSummary[] }) {
  const [open, setOpen] = useState(false);
  const recent = [...weeks].sort((a, b) => a.week_start.localeCompare(b.week_start)).slice(-12);
  return (
    <Disclosure title="View Data" open={open} onChange={setOpen}>
      {recent.length ? (
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
              {recent.map((week) => (
                <tr key={week.week_start} className="border-t border-divider">
                  <th scope="row" className="p-2 font-normal">
                    {formatShortDate(week.week_start)}
                  </th>
                  <td className="p-2">{formatMeters(week.total_m)}</td>
                  <td className="p-2">
                    {week.target_m > 0 ? formatMeters(week.target_m) : 'No target'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={<CalendarDays size={20} />} title="No Weekly Data Yet" />
      )}
    </Disclosure>
  );
}
