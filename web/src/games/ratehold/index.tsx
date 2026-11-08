import {
  RATE_HOLD_ID,
  rateHoldShare,
  type RateHoldResult,
} from '../../../../shared/games/rateHold';
import { DailyGameFrame } from '../DailyGameFrame';
import { RateHoldPlay, type RateHoldPayload } from './RateHoldPlay';

export default function RateHoldGame() {
  return (
    <DailyGameFrame<RateHoldPayload>
      gameId={RATE_HOLD_ID}
      title="Rate Hold"
      play={(props) => <RateHoldPlay {...props} />}
      summarize={(result) => {
        const stored = result.payload as Omit<RateHoldResult, 'total'>;
        const share = rateHoldShare(result.date, { ...stored, total: result.score });
        return { headline: `${result.score} / 100`, detail: share.split('\n')[1], share };
      }}
    />
  );
}
