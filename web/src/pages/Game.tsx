import { Suspense } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { PageHeader, EmptyState, Button } from '../components/ui';
import { LoadState } from '../components/shell/LoadState';
import { GAMES } from '../games/registry';
import { useGamesToday } from '../games/useGameAccess';

export default function Game() {
  const { id } = useParams();
  const game = GAMES.find((item) => item.id === id);
  const games = useGamesToday();
  if (game && !games.data)
    return <LoadState error={games.isError} retry={() => void games.refetch()} />;
  if (game && !games.data?.games.some((info) => info.id === game.id))
    return <Navigate to="/games" replace />;
  return (
    <>
      <PageHeader title={game?.title ?? 'Not Found'} back="/games" />
      <div className="px-[var(--gutter)] py-4 lg:py-6">
        {game ? (
          <Suspense fallback={<LoadState />}>
            <game.component />
          </Suspense>
        ) : (
          <EmptyState
            icon={<Search size={20} strokeWidth={1.75} />}
            title="Game Not Found"
            action={<Button to="/games">Daily Games</Button>}
          />
        )}
      </div>
    </>
  );
}
