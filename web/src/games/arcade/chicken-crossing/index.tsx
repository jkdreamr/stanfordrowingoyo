import { ArcadeDailyFrame } from '../ArcadeDailyFrame';
import type { ChickenStats } from '../../../../../shared/games/chickenCrossing';
import { CHICKEN_ID } from '../../../../../shared/games/chickenCrossing';
import Play from './Play';

export default function ChickenCrossing() {
  return (
    <ArcadeDailyFrame<ChickenStats>
      gameId={CHICKEN_ID}
      title="Chicken Crossing"
      howTo={[
        'Hop for 1 point per row. Coins add 3 points.',
        'Avoid traffic, trees and trains. Ride logs across rivers.',
        'Keep moving or the hawk will catch you.',
        'Tap to hop, swipe to steer. Desktop: arrows or WASD.',
      ]}
      formatScore={(score) => `${score} pts`}
      renderPlay={(props) => <Play {...props} />}
    />
  );
}
