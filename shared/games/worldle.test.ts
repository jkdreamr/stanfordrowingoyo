import { expect, it } from 'vitest';
import { worldleShare } from './worldle';
import { wordGuessShare } from './wordGuess';

it('matches Word Guess header dates and shares five proximity squares plus arrows without names', () => {
  const share = worldleShare(
    '2026-11-16',
    [
      { proximity: 0, direction: 'N', correct: false },
      { proximity: 29, direction: 'NE', correct: false },
      { proximity: 30, direction: 'E', correct: false },
      { proximity: 99, direction: 'SW', correct: false },
      { proximity: 100, direction: 'N', correct: true },
    ],
    true,
    5,
  );
  const wordHeader = wordGuessShare('2026-11-16', {
    solved: true,
    tries: 5,
    points: 2,
    marks: [],
  }).split('\n')[0];
  expect(share.split('\n')[0]).toBe(wordHeader.replace('Word Guess', 'Worldle'));
  expect(share).toBe(
    'OYO Worldle 2026-11-16 5/6\n\n⬜⬜⬜⬜⬜⬆️\n🟩⬜⬜⬜⬜↗️\n🟩🟨⬜⬜⬜➡️\n🟩🟩🟩🟩🟨↙️\n🟩🟩🟩🟩🟩🎉',
  );
});

it('supports empty/lost shares and each compass arrow', () => {
  expect(worldleShare('2026-11-16', [], false, 0)).toBe('OYO Worldle 2026-11-16 X/6\n');
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
  expect(
    worldleShare(
      '2026-11-16',
      directions.map((direction) => ({ proximity: 50, direction, correct: false })),
      false,
      6,
    ),
  ).toBe(
    'OYO Worldle 2026-11-16 X/6\n\n' +
      ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'].map((a) => '🟩🟩🟨⬜⬜' + a).join('\n'),
  );
});
