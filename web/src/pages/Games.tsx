import { PageHeader, Button, ListGroup, ListRow } from '../components/ui';
import { LoadState } from '../components/shell/LoadState';
import { useGamesToday } from '../games/useGameAccess';
import { GameLocked } from '../games/GameLocked';
import { GameWeekBoard } from '../games/GameWeekBoard';
import { GAMES } from '../games/registry';
import { Flame } from 'lucide-react';

export default function Games() {
  const games = useGamesToday();
  return (
    <>
      <PageHeader
        title="Daily Games"
        back="/"
        trailing={
          <Button to="/games/leaderboard" variant="plain">
            Boards
          </Button>
        }
      />
      <div className="space-y-6 px-[var(--gutter)] py-4 lg:py-6">
        {!games.data ? (
          <LoadState error={games.isError} retry={() => void games.refetch()} />
        ) : (
          <>
            {(games.data.streak.current > 0 || games.data.streak.best > 0) && (
              <p className="flex items-center gap-2 text-subhead text-muted">
                {games.data.streak.current > 0 && (
                  <Flame size={20} color="#FC5200" aria-hidden="true" />
                )}
                {games.data.streak.current} Day Streak · Best {games.data.streak.best}
              </p>
            )}
            {!games.data.access.unlocked && <GameLocked />}
            <ListGroup>
              {GAMES.filter((game) => games.data.games.some((info) => info.id === game.id)).map(
                (game) => {
                  const result = games.data.results.find((row) => row.game_id === game.id);
                  return (
                    <ListRow
                      key={game.id}
                      title={game.title}
                      to={`/games/${game.id}`}
                      leading={
                        <game.icon size={20} strokeWidth={1.75} style={{ color: game.accent }} />
                      }
                      trailing={
                        result
                          ? game.formatScore(result.score)
                          : games.data.access.unlocked
                            ? 'Play'
                            : 'Locked'
                      }
                    />
                  );
                },
              )}
            </ListGroup>
            <GameWeekBoard />
          </>
        )}
      </div>
    </>
  );
}
