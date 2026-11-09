import { Check, X } from 'lucide-react';
import {
  HIGHERLOWER_ID,
  formatHigherLowerScore,
  higherLowerShare,
} from '../../../../shared/games/higherlower';
import type { HigherLowerItem, GameResult } from '../../../../shared/types';
import { DailyGameFrame } from '../DailyGameFrame';
import { HigherLowerPlay } from './HigherLowerPlay';
import './higherlower.css';

export function summarizeHigherLower(result: GameResult) {
  const payload = result.payload as {
    items: HigherLowerItem[];
    results: boolean[];
    perfect: boolean;
  };
  return {
    headline: formatHigherLowerScore(result.score),
    detail: payload.perfect
      ? 'Perfect Run'
      : `Missed on ${payload.items.at(-1)?.name ?? 'the Next Item'}`,
    body: (
      <ol className="hl-chain" aria-label="Revealed Chain">
        {payload.items.map((item, i) => (
          <li key={i}>
            <span className="hl-mark">
              {i === 0 ? (
                <span className="hl-start">Start</span>
              ) : payload.results[i - 1] ? (
                <Check aria-label="Correct" size={18} />
              ) : (
                <X aria-label="Miss" size={18} />
              )}
            </span>
            <span className="hl-chain-name">
              {item.name}
              {item.detail && <small>{item.detail}</small>}
            </span>
            <span className="hl-chain-value">{item.display}</span>
          </li>
        ))}
      </ol>
    ),
    share: higherLowerShare(result.date, result.score, payload.results),
  };
}
export default function HigherLowerGame() {
  return (
    <DailyGameFrame<Record<string, never>>
      gameId={HIGHERLOWER_ID}
      title="Higher or Lower"
      serverComplete
      play={(props) => <HigherLowerPlay key={props.date} {...props} />}
      summarize={summarizeHigherLower}
    />
  );
}
