import { DEAL_ID, dealShare, formatDealTime } from '../../../../shared/games/deal';
import type { GameResult } from '../../../../shared/types';
import { DailyGameFrame, type GameSummary } from '../DailyGameFrame';
import { DealPlay } from './DealPlay';
export interface DealPayload {
  rounds: {
    cards: { value: number }[];
    goal: number;
    timeMs: number;
    skipped: boolean;
    parMs: number;
  }[];
}
export function summarizeDeal(result: GameResult): GameSummary {
  const { rounds } = result.payload as DealPayload;
  return {
    headline: formatDealTime(result.score * 100),
    detail: `${rounds.filter((r) => !r.skipped).length} of 5 Solved · ${rounds.filter((r) => !r.skipped && r.timeMs <= r.parMs).length} Under Par`,
    share: dealShare(result.date, rounds),
    body: (
      <ol className="deal-result-list" aria-label="Round Results">
        {rounds.map((r, i) => (
          <li key={i}>
            <span>
              Round {i + 1}
              <small>Goal {r.goal}</small>
            </span>
            <span>{r.skipped ? 'Skipped' : formatDealTime(r.timeMs)}</span>
          </li>
        ))}
      </ol>
    ),
  };
}
export default function DealGame() {
  return (
    <DailyGameFrame<void>
      gameId={DEAL_ID}
      title="Deal"
      serverComplete
      play={(props) => <DealPlay key={props.date} {...props} />}
      summarize={summarizeDeal}
    />
  );
}
