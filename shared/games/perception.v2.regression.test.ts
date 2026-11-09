import { expect, it } from 'vitest';
import { perceptionPuzzle, scorePerception } from '../../worker/src/games/perception';
import { perceptionLineup, perceptionV2Puzzle } from '../../worker/src/games/perceptionV2';
import type { PerceptionRoundAnswer } from './perceptionV2';

it.each(['2026-11-10', '2026-11-11'])(
  'pins the pre-v3 lineup, stimuli and scores on %s',
  (date) => {
    const p = perceptionV2Puzzle(date);
    const rounds = perceptionLineup(date);
    const stimuli = {
      clock: { clockMs: p.clockMs },
      color: { hue: p.hue },
      dot: { dot: p.dot },
      pattern: { cells: p.cells },
      reaction: { reactionDelayMs: p.reactionDelayMs },
      angle: { angle: p.angle, rotation: p.rotation },
      length: { length: p.length },
      count: { countDots: p.countDots },
      span: { digits: p.digits },
      shade: { shade: p.shade, shadeBackgrounds: p.shadeBackgrounds },
      bisect: { endpoints: p.endpoints },
      contact: { contact: p.contact },
    };
    const answer: PerceptionRoundAnswer = {
      clockMs: 5000,
      hue: 180,
      dot: [500, 500],
      cells: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      reactionMs: 260,
      angle: 90,
      length: 500,
      count: 50,
      digits: '123456789',
      shade: 50,
      bisect: [500, 500],
      contactMs: 1000,
    };
    expect(perceptionPuzzle(date)).toEqual(p);
    expect({
      rounds,
      puzzle: p,
      stimuli: rounds.map((round) => ({ round, stimulus: stimuli[round as keyof typeof stimuli] })),
      scores: scorePerception(date, answer),
    }).toMatchSnapshot();
  },
);
