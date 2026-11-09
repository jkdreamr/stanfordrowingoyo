import { formatPinpointScore, pinpointShare } from '../../../../shared/games/pinpoint';
import type { PinpointDay } from '../../../../shared/types';
import { DailyGameFrame } from '../DailyGameFrame';
import { PinpointPlay, Clues, Category, type PinpointPayload } from './PinpointPlay';
import './pinpoint.css';

type Stored = Pick<PinpointDay, 'guesses' | 'won' | 'cluesUsed' | 'category' | 'clues'>;

export default function PinpointGame() {
  return (
    <DailyGameFrame<PinpointPayload>
      gameId="pinpoint"
      title="Pinpoint"
      serverComplete
      play={(props) => <PinpointPlay key={props.date} {...props} />}
      summarize={(result) => {
        const stored = result.payload as Stored;
        return {
          headline: formatPinpointScore(result.score),
          detail: stored.won ? 'Category Found' : 'Category Revealed',
          body: (
            <div className="pp pp-result">
              <Category category={stored.category!} won={stored.won} />
              <Clues clues={stored.clues} />
            </div>
          ),
          share: pinpointShare(result.date, stored.won, stored.cluesUsed),
        };
      }}
    />
  );
}
