import { Gamepad2 } from 'lucide-react';
import { ListGroup, ListRow } from '../components/ui';
import { GameLocked } from './GameLocked';
import { useEffect, useRef } from 'react';
import { useGameAccess } from './useGameAccess';
import { useSavedSession } from '../lib/saveCelebration';

export function GamesCard() {
  const access = useGameAccess();
  const savedSession = useSavedSession();
  const icon = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (access.data?.reason === 'locked') {
      sessionStorage.setItem('oyo-games-locked', access.data.date);
    } else if (
      access.data?.unlocked &&
      !savedSession &&
      sessionStorage.getItem('oyo-games-locked') === access.data.date
    ) {
      sessionStorage.removeItem('oyo-games-locked');
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
        icon.current?.animate(
          [
            { transform: 'scale(.85)', opacity: 0.5 },
            { transform: 'scale(1)', opacity: 1 },
          ],
          { duration: 220, easing: 'ease-out' },
        );
    }
  }, [access.data, savedSession]);
  return (
    <ListGroup>
      <ListRow
        title="Daily Games"
        to="/games"
        leading={
          <span ref={icon}>
            <Gamepad2 size={20} strokeWidth={1.75} />
          </span>
        }
        subtitle={
          access.data ? (access.data.unlocked ? "Play Today's Games" : undefined) : undefined
        }
      />
      {access.data?.reason === 'locked' && <GameLocked />}
    </ListGroup>
  );
}
