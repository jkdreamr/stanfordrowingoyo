import { TRIES, WORLDLE_ID, worldleShare } from '../../../../shared/games/worldle';
import type { WorldleGuess } from '../../../../shared/types';
import { DailyGameFrame } from '../DailyGameFrame';
import { WorldlePlay, WorldleResult, type WorldlePayload } from './WorldlePlay';

interface Stored {
  solved: boolean;
  tries: number;
  rows: Pick<WorldleGuess, 'km' | 'direction' | 'proximity'>[];
}

export default function WorldleGame() {
  return (
    <DailyGameFrame<WorldlePayload>
      gameId={WORLDLE_ID}
      title="Worldle"
      serverComplete
      play={(props) => <WorldlePlay key={props.date} {...props} />}
      summarize={(result) => {
        const { solved, tries, rows } = result.payload as Stored;
        return {
          headline: solved ? `Solved in ${tries}/${TRIES}` : 'Out of guesses',
          body: <WorldleResult date={result.date} />,
          share: worldleShare(
            result.date,
            rows.map((row) => ({ ...row, correct: row.km === 0 })),
            solved,
            tries,
          ),
        };
      }}
    />
  );
}
