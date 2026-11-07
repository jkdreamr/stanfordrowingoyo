import { useState } from 'react';
import { ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import { addDays } from '../../../../shared/dates';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  IconButton,
  ListGroup,
  ListRow,
  PageHeader,
  SegmentedControl,
  useToast,
} from '../../components/ui';
import { LoadState } from '../../components/shell/LoadState';
import { useCompliance, useConfig } from '../../lib/queries';
import { formatEMeters, formatNumber, formatPercent, formatShortDate } from '../../lib/format';
import { complianceSummary } from './operations';

export default function Compliance() {
  const config = useConfig();
  const [selected, setSelected] = useState<string>();
  const [sort, setSort] = useState<'percent' | 'name'>('percent');
  const week = selected ?? config.data?.current_week_start;
  const query = useCompliance(week ? { week } : {});
  const { show } = useToast();
  const summary = complianceSummary(query.data ?? [], sort);
  async function copy() {
    try {
      await navigator.clipboard.writeText(summary.notLogged.map((user) => user.name).join('\n'));
      show({ title: 'List copied' });
    } catch {
      show({ title: 'Could not copy. Select the names and copy them manually.', tone: 'error' });
    }
  }
  return (
    <>
      <PageHeader title="Compliance" back="/admin" />
      <div className="screen-stack">
        {config.data && week && (
          <div className="flex items-center justify-between gap-3">
            <IconButton
              aria-label="Previous Week"
              disabled={week <= '2000-01-03'}
              onClick={() => setSelected(addDays(week, -7))}
            >
              <ChevronLeft size={20} />
            </IconButton>
            <h2 className="text-headline">
              Week of {formatShortDate(week).replace(/^\w+,? /, '')}
            </h2>
            <IconButton
              aria-label="Next Week"
              disabled={week >= config.data.current_week_start}
              onClick={() => setSelected(addDays(week, 7))}
            >
              <ChevronRight size={20} />
            </IconButton>
          </div>
        )}
        <SegmentedControl
          label="Sort People"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'percent', label: 'Lowest %' },
            { value: 'name', label: 'Name' },
          ]}
        />
        {query.isError || config.isError ? (
          <LoadState
            error
            retry={() => {
              void query.refetch();
              void config.refetch();
            }}
          />
        ) : !query.data || !config.data ? (
          <LoadState />
        ) : (
          <>
            <p className="px-1 text-subhead text-muted" role="status">
              {formatNumber(summary.onTarget)} of {formatNumber(query.data.length)} on target this
              week
            </p>
            <Card className="space-y-3 p-4">
              <h2 className="text-headline">Not Yet Logged</h2>
              {summary.notLogged.length ? (
                <>
                  <ul
                    tabIndex={0}
                    aria-label="People Not Yet Logged"
                    className="max-h-48 space-y-2 overflow-y-auto text-callout"
                  >
                    {summary.notLogged.map((user) => (
                      <li key={user.id}>{user.name}</li>
                    ))}
                  </ul>
                  <Button variant="secondary" onClick={() => void copy()}>
                    Copy List
                  </Button>
                </>
              ) : (
                <p className="text-callout text-muted">
                  {query.data.length
                    ? 'Everyone has logged this week.'
                    : 'No active rowers this week.'}
                </p>
              )}
            </Card>
            {summary.rows.length ? (
              <ListGroup
                header={`${formatNumber(summary.rows.length)} Rowers`}
                footer="E-meters. Last log includes all weeks."
              >
                {summary.rows.map((row) => (
                  <ListRow
                    key={row.user.id}
                    title={row.user.name}
                    avatar={<Avatar name={row.user.name} imageId={row.user.avatar_image_id} />}
                    subtitle={
                      <span className="block space-y-1">
                        <span className="block">
                          {formatEMeters(row.total_m, true)} of {formatEMeters(row.target_m, true)}
                        </span>
                        <span className="block">
                          {row.last_log
                            ? `Last log ${formatShortDate(row.last_log)}`
                            : 'No logs yet'}
                        </span>
                      </span>
                    }
                    trailing={
                      <span className="text-headline tabular-nums">
                        {formatPercent(row.percent)}
                      </span>
                    }
                  />
                ))}
              </ListGroup>
            ) : (
              <EmptyState
                icon={<ClipboardList size={20} />}
                title="No Active Rowers"
                action={<Button to="/admin/roster">Open Roster</Button>}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
