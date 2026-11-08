import { Waves } from 'lucide-react';
import { ListGroup, ListRow } from '../components/ui';
import { useGameAccess } from './useGameAccess';

export function GamesCard() {
  const access = useGameAccess();
  return (
    <ListGroup>
      <ListRow
        title="Daily Games"
        to="/games"
        leading={<Waves size={20} strokeWidth={1.75} />}
        subtitle={
          access.data
            ? access.data.unlocked
              ? "Play Today's Games"
              : 'Log a workout to unlock'
            : undefined
        }
      />
    </ListGroup>
  );
}
