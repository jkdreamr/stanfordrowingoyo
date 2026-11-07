import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { addDays } from '../../../../shared/dates';
import { useMyPlan } from '../../lib/queries';
import { covers, planLogLink } from '../../lib/myPlan';
import { Card, ListGroup, ListRow, ZoneChip } from '../ui';
import { ModalityIcon } from '../shell/ModalityIcon';
import { formatMeters } from '../../lib/format';

export function TodaysPlan({ today }: { today: string }) {
  const { data: plan } = useMyPlan();
  if (!plan || !covers(plan, today)) return null;
  const offset = Math.round(
    (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${plan.start_date}T12:00:00Z`)) / 86400000,
  );
  const week = offset < 7 ? 1 : 2;
  const day = offset % 7;
  const rest = plan.rest_days.some((row) => row.week === week && row.day === day);
  const sessions = plan.sessions.filter(
    (row) => addDays(plan.start_date, (row.week - 1) * 7 + row.day) === today,
  );
  return (
    <Card>
      <h2 className="mb-3 text-headline">
        <Link className="inline-flex min-h-11 items-center text-text" to="/plan?tab=mine">
          Today's Plan
        </Link>
      </h2>
      {rest ? (
        <p>Rest Day</p>
      ) : sessions.length ? (
        <ListGroup>
          {sessions.map((row) => (
            <ListRow
              key={row.slot}
              to={row.completed_entry_id ? `/entries/${row.completed_entry_id}` : planLogLink(row)}
              title={
                row.note ||
                `${row.modality === 'erg' ? 'Erg' : row.modality === 'bike' ? 'Bike' : 'Run'} ${row.slot}`
              }
              leading={<ModalityIcon modality={row.modality} />}
              subtitle={
                <span className="flex items-center gap-2">
                  <ZoneChip zone={row.zone} />
                  {row.distance_m !== null && (
                    <span className="tabular-nums">{formatMeters(row.distance_m)}</span>
                  )}
                </span>
              }
              trailing={
                row.completed_entry_id ? (
                  <Check size={20} strokeWidth={1.75} aria-label="Completed" />
                ) : undefined
              }
            />
          ))}
        </ListGroup>
      ) : (
        <Link className="inline-flex min-h-11 items-center text-text" to="/plan?tab=mine">
          Nothing Planned
        </Link>
      )}
    </Card>
  );
}
