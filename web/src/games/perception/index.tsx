import {
  PERCEPTION_ID,
  PERCEPTION_MAX,
  perceptionShare,
  PERCEPTION_ROUNDS,
} from '../../../../shared/games/perception';
import type { PerceptionRoundId } from '../../../../shared/games/perceptionV2';
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
        const { scores, rounds = PERCEPTION_ROUNDS } = result.payload as {
          scores: Partial<Record<PerceptionRoundId, number>>;
          rounds?: PerceptionRoundId[];
        };
        const share = perceptionShare(result.date, scores, rounds);
        return {
          headline: `${result.score} / ${PERCEPTION_MAX}`,
          detail: share
            .split('\n')
            .slice(1)
            .map((line) => line.replace(/[🟩⬜]/gu, '').replace(/\s+/g, ' '))
            .join(' · '),
          share,
        };
      }}
    />
  );
}
