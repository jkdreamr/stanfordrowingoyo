import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { api, ApiClientError } from '../lib/api';
import { qk, useConfig } from '../lib/queries';
import { Avatar, EmptyState, ListGroup, ListRow } from '../components/ui';
import { LoadState } from '../components/shell/LoadState';
import { GAMES } from './registry';

export function GameDayBoard({ gameId, date }: { gameId: string; date: string }) {
  const config = useConfig();
  const board = useQuery({
    queryKey: [...qk.root('games'), 'day', gameId, date, config.data?.today],
    queryFn: ({ signal }) =>
      api('GET /api/games/:game/leaderboard', {
        params: { game: gameId },
        query: { date },
        signal,
      }),
    retry: (count, error) =>
      !(error instanceof ApiClientError && error.status === 403) && count < 2,
    refetchInterval: date === config.data?.today ? 30000 : false,
  });
  const definition = GAMES.find((game) => game.id === gameId);
  if (board.error instanceof ApiClientError && board.error.detail.code === 'PLAY_FIRST')
    return (
      <section aria-label={`${definition?.title ?? gameId} Day Board`}>
        <h2 className="text-headline">{definition?.title ?? gameId}</h2>
        <p className="py-6 text-subhead text-muted">
          {date === config.data?.today
            ? 'Play To See Today’s Board'
            : 'Play To See This Day’s Board'}
        </p>
      </section>
    );
  if (!board.data) return <LoadState error={board.isError} retry={() => void board.refetch()} />;
  return (
    <section aria-label={`${definition?.title ?? gameId} Day Board`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-headline">{definition?.title ?? gameId}</h2>
        <span className="text-footnote text-muted">
          {board.data.final ? 'Final' : 'Live'} · {board.data.players}{' '}
          {board.data.players === 1 ? 'Player' : 'Players'}
        </span>
      </div>
      {board.data.rows.length ? (
        <ListGroup>
          {board.data.rows.map((row) => (
            <ListRow
              key={row.user.id}
              title={`${row.rank}. ${row.user.name}${row.me ? ' · You' : ''}`}
              to={`/users/${row.user.id}`}
              avatar={<Avatar name={row.user.name} imageId={row.user.avatar_image_id} size="sm" />}
              trailing={definition?.formatScore(row.score) ?? String(row.score)}
            />
          ))}
        </ListGroup>
      ) : (
        <EmptyState icon={<Trophy size={20} strokeWidth={1.75} />} title="No Results Yet" />
      )}
    </section>
  );
}
