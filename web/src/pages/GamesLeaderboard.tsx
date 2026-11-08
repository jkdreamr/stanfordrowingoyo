import { useState } from 'react';
import { addDays, weekStart } from '../../../shared/dates';
import { PageHeader, TextField } from '../components/ui';
import { LoadState } from '../components/shell/LoadState';
import { useConfig } from '../lib/queries';
import { GameWeekBoard } from '../games/GameWeekBoard';
import { GameDayBoard } from '../games/GameDayBoard';
import { GAMES } from '../games/registry';

export default function GamesLeaderboard() {
  const config = useConfig();
  const [selected, setSelected] = useState('');
  const date = selected || config.data?.today;
  return (
    <>
      <PageHeader title="Games Leaderboard" back="/games" />
      <div className="space-y-8 p-4 lg:p-6">
        {!date ? (
          <LoadState error={config.isError} retry={() => void config.refetch()} />
        ) : (
          <>
            <TextField
              label="Day"
              type="date"
              value={date}
              max={config.data?.today}
              onChange={(e) => {
                if (e.target.value && e.target.value <= (config.data?.today ?? ''))
                  setSelected(e.target.value);
              }}
            />
            <p className="text-footnote text-muted">
              Week Of {weekStart(date)} – {addDays(weekStart(date), 6)}
            </p>
            <GameWeekBoard week={weekStart(date)} />
            {GAMES.map((game) => (
              <GameDayBoard key={game.id} gameId={game.id} date={date} />
            ))}
          </>
        )}
      </div>
    </>
  );
}
