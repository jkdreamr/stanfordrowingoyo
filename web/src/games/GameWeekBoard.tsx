import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { api } from '../lib/api';
import { qk, useConfig } from '../lib/queries';
import { EmptyState, ListGroup, ListRow } from '../components/ui';
import { LoadState } from '../components/shell/LoadState';
import { formatNumber } from '../lib/format';

export function GameWeekBoard({ week }: { week?: string }) {
  const config = useConfig();
  const board = useQuery({
    queryKey: [...qk.root('games'), 'week', week, config.data?.today],
    queryFn: ({ signal }) => api('GET /api/games/leaderboard', { query: { week }, signal }),
  });
  if (!board.data) return <LoadState error={board.isError} retry={() => void board.refetch()} />;
  return (
    <section aria-label="Weekly Games Board">
      <h2 className="mb-3 text-headline">Weekly Overall</h2>
      {board.data.rows.length ? (
        <ListGroup>
          {board.data.rows.map((row) => (
            <ListRow
              key={row.user.id}
              title={`${row.rank}. ${row.user.name}${row.me ? ' · You' : ''}`}
              to={`/users/${row.user.id}`}
              subtitle={`${row.days} ${row.days === 1 ? 'Day' : 'Days'}`}
              trailing={`${formatNumber(row.points)} ${row.points === 1 ? 'pt' : 'pts'}`}
            />
          ))}
        </ListGroup>
      ) : (
        <EmptyState icon={<Trophy size={20} strokeWidth={1.75} />} title="No Games Played Yet" />
      )}
    </section>
  );
}
