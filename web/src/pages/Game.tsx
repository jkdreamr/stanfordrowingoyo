import { Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { PageHeader, EmptyState, Button } from '../components/ui';
import { LoadState } from '../components/shell/LoadState';
import { GAMES } from '../games/registry';

export default function Game() {
  const { id } = useParams();
  const game = GAMES.find((item) => item.id === id);
  return (
    <>
      <PageHeader title={game?.title ?? 'Not Found'} back="/games" />
      <div className="p-4 lg:p-6">
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
