import {
  CROSSWORD_ID,
  crosswordShare,
  formatCrosswordTime,
  type CrosswordResult,
} from '../../../../shared/games/crossword';
import { DailyGameFrame } from '../DailyGameFrame';
import { CrosswordPlay } from './CrosswordPlay';
import { CrosswordGrid } from './Grid';
import './crossword.css';

export default function CrosswordGame() {
  return (
    <DailyGameFrame<CrosswordResult>
      gameId={CROSSWORD_ID}
      title="Mini Crossword"
      serverComplete
      play={(props) => <CrosswordPlay key={props.date} {...props} />}
      summarize={(result) => {
        const payload = result.payload as CrosswordResult;
        return {
          headline: formatCrosswordTime(result.score),
          detail: payload.penalty
            ? `${formatCrosswordTime(payload.seconds)} Solve + ${payload.penalty}s Penalty`
            : 'Clean Solve',
          body: (
            <div className="xw xw-result">
              <CrosswordGrid
                cells={payload.solution}
                blocks={payload.solution.flatMap((c, i) => (c ? [] : [i]))}
                solved
              />
              <p>
                {payload.checks} {payload.checks === 1 ? 'Check' : 'Checks'} · {payload.reveals}{' '}
                {payload.reveals === 1 ? 'Reveal' : 'Reveals'}
              </p>
            </div>
          ),
          share: crosswordShare(result.date, payload),
        };
      }}
    />
  );
}
