import { PageHeader, Button, ListGroup, ListRow } from '../components/ui';
import { LoadState } from '../components/shell/LoadState';
import { useGamesToday } from '../games/useGameAccess';
import { GameLocked } from '../games/GameLocked';
import { GameWeekBoard } from '../games/GameWeekBoard';
import { GAMES } from '../games/registry';

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
      <div className="space-y-8 p-4 lg:p-6">
        {!games.data ? (
          <LoadState error={games.isError} retry={() => void games.refetch()} />
        ) : (
          <>
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
