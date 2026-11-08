import { useState } from 'react';
import { addDays, weekStart } from '../../../shared/dates';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader, IconButton } from '../components/ui';
import { LoadState } from '../components/shell/LoadState';
import { useConfig } from '../lib/queries';
import { GameWeekBoard } from '../games/GameWeekBoard';
import { GameDayBoard } from '../games/GameDayBoard';
import { GAMES } from '../games/registry';
import { formatShortDate } from '../lib/format';

function weekLabel(date: string) {
  const start = weekStart(date),
    end = addDays(start, 6);
  const first = new Date(`${start}T12:00:00Z`),
    last = new Date(`${end}T12:00:00Z`);
  const month = (value: Date) =>
    value.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${month(first)} ${first.getUTCDate()} – ${first.getUTCMonth() === last.getUTCMonth() ? '' : month(last) + ' '}${last.getUTCDate()}${first.getUTCFullYear() !== last.getUTCFullYear() ? `, ${last.getUTCFullYear()}` : ''}`;
}

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
            <nav aria-label="Board Day" className="flex items-center justify-between gap-4">
              <IconButton aria-label="Previous Day" onClick={() => setSelected(addDays(date, -1))}>
                <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
              </IconButton>
              <p className="text-headline" aria-live="polite">
                {date === config.data?.today ? 'Today' : formatShortDate(date)}
              </p>
              <IconButton
                aria-label="Next Day"
                disabled={date >= (config.data?.today ?? date)}
                onClick={() => setSelected(addDays(date, 1))}
              >
                <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
              </IconButton>
            </nav>
            <h2 className="text-subhead text-muted">{weekLabel(date)}</h2>
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
