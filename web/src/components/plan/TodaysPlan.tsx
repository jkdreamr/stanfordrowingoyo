import { Link } from 'react-router-dom';
import { CalendarDays, Check } from 'lucide-react';
import { addDays } from '../../../../shared/dates';
import { useMyPlan } from '../../lib/queries';
import { covers, planLogLink } from '../../lib/myPlan';
import { Button, Card, EmptyState, ListGroup, ListRow, ZoneChip } from '../ui';
import { ModalityIcon } from '../shell/ModalityIcon';
import { formatMeters } from '../../lib/format';

export function TodaysPlan({ today }: { today: string }) {
  const query = useMyPlan();
  const plan = query.data;
  if (!plan || !covers(plan, today))
    return (
      <Card>
        <h2 className="mb-3 text-headline">Today's Plan</h2>
        {query.isError && (
          <div role="alert" className="mb-3">
            <p className="text-subhead text-muted">Could Not Load Your Plan</p>
            <Button variant="plain" onClick={() => void query.refetch()}>
              Try Again
            </Button>
          </div>
        )}
        <ListGroup>
          <ListRow title="Sample Fortnight" to="/plan" />
          <ListRow title="My Fortnight" to="/plan?tab=mine" />
        </ListGroup>
      </Card>
    );
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
      <h2 className={rest || sessions.length ? 'mb-3 text-headline' : 'text-headline'}>
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
        <EmptyState
          className="today-plan-empty"
          icon={<CalendarDays size={20} />}
          title="Nothing Planned"
          action={<Button to="/plan?tab=mine">Edit Plan</Button>}
        />
      )}
    </Card>
  );
}
