import {
  PERCEPTION_ID,
  PERCEPTION_MAX,
  perceptionShare,
  type PerceptionScores,
} from '../../../../shared/games/perception';
import { DailyGameFrame } from '../DailyGameFrame';
import { PerceptionPlay } from './PerceptionPlay';

export default function PerceptionGame() {
  return (
    <DailyGameFrame<void>
      gameId={PERCEPTION_ID}
      title="Perception"
      serverComplete
      play={({ date, onComplete }) => (
        <PerceptionPlay key={date} date={date} onComplete={onComplete} />
      )}
      summarize={(result) => {
        const { scores } = result.payload as { scores: PerceptionScores };
        const share = perceptionShare(result.date, scores);
        return {
          headline: `${result.score} / ${PERCEPTION_MAX}`,
          detail: `Clock ${scores.clock} · Color ${scores.color} · Spot ${scores.dot} · Pattern ${scores.pattern} · React ${scores.reaction}`,
          share,
        };
      }}
    />
  );
}
