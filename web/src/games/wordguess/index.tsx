import {
  TRIES,
  WORD_GUESS_ID,
  type Mark,
  wordGuessShare,
} from '../../../../shared/games/wordGuess';
import { DailyGameFrame } from '../DailyGameFrame';
import { WordGuessPlay, type WordGuessPayload } from './WordGuessPlay';

interface Stored {
  guesses: string[];
  solved: boolean;
  tries: number;
  answer: string;
  marks: Mark[][];
}

export default function WordGuessGame() {
  return (
    <DailyGameFrame<WordGuessPayload>
      gameId={WORD_GUESS_ID}
      title="Word Guess"
      serverComplete
      play={(props) => <WordGuessPlay key={props.date} {...props} />}
      summarize={(result) => {
        const { solved, tries, answer, marks } = result.payload as Stored;
        return {
          headline: `${solved ? tries : 'X'} / ${TRIES}`,
          detail: `Answer · ${answer[0].toUpperCase()}${answer.slice(1)}`,
          share: wordGuessShare(result.date, { solved, tries, points: result.score, marks }),
        };
      }}
    />
  );
}
