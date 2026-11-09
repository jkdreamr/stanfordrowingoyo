import { Gamepad2 } from 'lucide-react';
import { ListGroup, ListRow } from '../components/ui';
import { GameLocked } from './GameLocked';
import { useEffect, useRef } from 'react';
import { useGamesToday } from './useGameAccess';
import { useSavedSession } from '../lib/saveCelebration';

export function GamesCard() {
  const games = useGamesToday();
  const access = games.data?.access;
  const streak = games.data?.streak.current ?? 0;
  const savedSession = useSavedSession();
  const icon = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (access?.reason === 'locked') {
      sessionStorage.setItem('oyo-games-locked', access.date);
    } else if (
      access?.unlocked &&
      !savedSession &&
      sessionStorage.getItem('oyo-games-locked') === access.date
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
  }, [access, savedSession]);
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
          access?.unlocked
            ? `Play Today's Games${streak > 0 ? ` · ${streak} Day Streak` : ''}`
            : streak > 0
              ? `${streak} Day Streak`
              : undefined
        }
      />
      {access?.reason === 'locked' && <GameLocked />}
    </ListGroup>
  );
}
