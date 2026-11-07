import {
  Users,
  ClipboardCheck,
  Settings,
  SlidersHorizontal,
  CalendarDays,
  Megaphone,
  Download,
  History,
  Flag,
} from 'lucide-react';
import { useCompliance } from '../lib/queries';
import { formatNumber } from '../lib/format';
import { Button, Card, ListGroup, ListRow, PageHeader } from '../components/ui';
import { LoadState } from '../components/shell/LoadState';

const links = [
  ['Roster', '/admin/roster', Users],
  ['Compliance', '/admin/compliance', ClipboardCheck],
  ['Team Settings', '/admin/settings', Settings],
  ['Presets', '/admin/presets', SlidersHorizontal],
  ['Plan Editor', '/admin/plan', CalendarDays],
  ['Announcements', '/admin/announcements', Megaphone],
  ['Challenges', '/admin/challenges', Flag],
  ['Export', '/admin/export', Download],
  ['Audit Log', '/admin/audit', History],
] as const;
export default function Admin() {
  const compliance = useCompliance();
  const rows = compliance.data;
  return (
    <>
      <PageHeader title="Admin" />
      <div className="screen-stack">
        {rows ? (
          <Card className="space-y-2 p-4">
            <h2 className="text-headline">This Week</h2>
            <p className="text-title2 tabular-nums">
              {formatNumber(rows.filter((r) => r.percent >= 100).length)} of{' '}
              {formatNumber(rows.length)} on target
            </p>
            <p className="text-subhead text-muted">
              {formatNumber(rows.filter((r) => r.entry_count === 0).length)} haven't logged
            </p>
            <Button variant="plain" className="!px-0" to="/admin/compliance">
              View Compliance
            </Button>
          </Card>
        ) : (
          <LoadState error={compliance.isError} retry={() => void compliance.refetch()} />
        )}
        <ListGroup>
          {links.map(([title, to, Icon]) => (
            <ListRow
              key={to}
              title={title}
              to={to}
              leading={<Icon size={20} strokeWidth={1.75} />}
            />
          ))}
        </ListGroup>
      </div>
    </>
  );
}
