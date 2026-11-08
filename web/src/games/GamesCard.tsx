import { Gamepad2 } from 'lucide-react';
import { ListGroup, ListRow } from '../components/ui';
import { useGamesToday } from './useGameAccess';

export function GamesCard() {
  const games = useGamesToday();
  const access = games.data?.access;
  const streak = games.data?.streak.current ?? 0;
  return (
    <ListGroup>
      <ListRow
        title="Daily Games"
        to="/games"
        leading={<Gamepad2 size={20} strokeWidth={1.75} />}
        subtitle={
          access
            ? `${access.unlocked ? "Play Today's Games" : 'Log A Workout To Unlock'}${streak > 0 ? ` · ${streak} Day Streak` : ''}`
            : undefined
        }
      />
    </ListGroup>
  );
}
