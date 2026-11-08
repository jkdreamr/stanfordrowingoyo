import {
  TRIES,
  WORD_GUESS_ID,
  dailyAnswer,
  score,
  wordGuessShare,
} from '../../../../shared/games/wordGuess';
import { DailyGameFrame } from '../DailyGameFrame';
import { WordGuessPlay, type WordGuessPayload } from './WordGuessPlay';

interface Stored {
  guesses: string[];
  solved: boolean;
  tries: number;
}

export default function WordGuessGame() {
  return (
    <DailyGameFrame<WordGuessPayload>
      gameId={WORD_GUESS_ID}
      title="Word Guess"
      play={(props) => <WordGuessPlay {...props} />}
      summarize={(result) => {
        const { guesses, solved, tries } = result.payload as Stored;
        const answer = dailyAnswer(result.date);
        const marks = guesses.map((g) => score(g, answer));
        return {
          headline: `${solved ? tries : 'X'} / ${TRIES}`,
          detail: answer.toUpperCase(),
          share: wordGuessShare(result.date, { solved, tries, points: result.score, marks }),
        };
      }}
    />
  );
}
