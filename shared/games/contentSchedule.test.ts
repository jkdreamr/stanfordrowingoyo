import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { dayNumber } from './daily';
import { GUESSES } from './wordGuessGuesses';
import {
  puzzleIndex,
  parsePuzzle,
  replayConnections,
  boardWords,
  connectionsShare,
} from './connections';
import {
  ALL_ANSWERS,
  ANSWER_LIST,
  NEW_ANSWER_LIST,
  dailyAnswer,
  dailyIndex,
  unpack,
  verifyWordGuess,
  wordGuessShare,
} from '../../worker/src/games/wordGuess';
import {
  ALL_CONNECTIONS_PUZZLES,
  CONNECTIONS_PUZZLES,
  connectionsPuzzleFor,
} from '../../worker/src/games/connectionsPuzzles';
import {
  CONTENT_CUTOVER,
  REPLAY_DATE,
  REPLAY_SOURCE,
  contentRotation,
} from '../../worker/src/games/contentSchedule';

const dateAt = (day: number) => new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
const cutover = dayNumber(CONTENT_CUTOVER);
const puzzleKey = (date: string) => JSON.stringify(connectionsPuzzleFor(date));
const extra = new Set(unpack(GUESSES));

describe('frozen daily content', () => {
  it('freezes the v2 banks until another explicitly versioned cutover', () => {
    expect(NEW_ANSWER_LIST).toHaveLength(259);
    expect(ALL_CONNECTIONS_PUZZLES).toHaveLength(199);
    expect(createHash('sha256').update(JSON.stringify(ALL_ANSWERS)).digest('hex')).toBe(
      '7d8216bc95838ab9b185bbb920ad699b5bfdf8b59fdcb4b6d27b39d156bfa42e',
    );
    expect(createHash('sha256').update(JSON.stringify(ALL_CONNECTIONS_PUZZLES)).digest('hex')).toBe(
      '97896146795eed0e9cb1651104cc1449d206047b95013adcffc32d0ecd8ace3c',
    );
  });

  it('keeps the original banks and every pre-cutover day on their original lengths', () => {
    expect(ANSWER_LIST).toHaveLength(2000);
    expect(CONNECTIONS_PUZZLES).toHaveLength(96);
    expect(createHash('sha256').update(JSON.stringify(ANSWER_LIST)).digest('hex')).toBe(
      '59468757dbdc841760ea3157d208cf35875f1c6baf180f12d444e5cc71d7188e',
    );
    expect(createHash('sha256').update(JSON.stringify(CONNECTIONS_PUZZLES)).digest('hex')).toBe(
      '24d63ce22dafc21bd9a741c96e7ff375fe7378a07ab80f554deaa7e7b4b39bc0',
    );
    for (let day = -ANSWER_LIST.length; day < cutover; day++) {
      const date = dateAt(day);
      if (date === REPLAY_DATE) continue;
      expect(dailyAnswer(date)).toBe(ANSWER_LIST[dailyIndex(day, 2000)]);
      expect(connectionsPuzzleFor(date)).toEqual(
        parsePuzzle(CONNECTIONS_PUZZLES[puzzleIndex(date, 96)]),
      );
    }
  });

  it('matches a prefix digest captured from origin/main before changing selectors', () => {
    const rows = Array.from({ length: 347 }, (_, i) => dateAt(i))
      .filter((date) => date !== REPLAY_DATE)
      .map((date) => [date, dailyAnswer(date), connectionsPuzzleFor(date)]);
    expect(createHash('sha256').update(JSON.stringify(rows)).digest('hex')).toBe(
      '070e4ea69d01657c8fb89b9c8bbc00daa34212639e42d4d56a9281868caa50b9',
    );
  });

  it.each([
    ['1900-01-01', 'angst', 'Gemstones'],
    ['2025-12-31', 'blimp', 'Synonyms For Ghost'],
    ['2026-01-01', 'tweak', 'Addams Family Characters'],
    ['2026-03-18', 'reply', 'Two-Wheelers'],
    ['2026-11-06', 'worth', 'Chili Peppers'],
    ['2026-11-08', 'patio', 'Office Supplies'],
    ['2026-11-09', 'sewer', 'Bands Named After Places'],
    ['2026-12-02', 'rival', 'The Goonies Characters'],
    ['2026-12-04', 'swung', 'Lab Equipment'],
    ['2026-12-13', 'armor', 'Boxing Punches'],
  ])('pins the captured %s selections', (date, answer, category) => {
    expect(dailyAnswer(date)).toBe(answer);
    expect(connectionsPuzzleFor(date).groups[0].name).toBe(category);
  });

  it('replays exactly the original answer and all original groups without remapping the play date', () => {
    expect(dailyAnswer(REPLAY_DATE)).toBe('patio');
    const puzzle = connectionsPuzzleFor(REPLAY_DATE);
    expect(puzzle).toEqual(connectionsPuzzleFor(REPLAY_SOURCE));
    expect(puzzle.groups).toEqual([
      { level: 0, name: 'Office Supplies', words: ['Stapler', 'Binder', 'Folder', 'Eraser'] },
      {
        level: 1,
        name: 'Committee Officers',
        words: ['Secretary', 'Treasurer', 'Clerk', 'President'],
      },
      { level: 2, name: 'Bicycle Parts', words: ['Chain', 'Pedal', 'Spoke', 'Saddle'] },
      {
        level: 3,
        name: 'Drop The First Letter For A Body Part',
        words: ['Ship', 'Chair', 'Clip', 'Gear'],
      },
    ]);
    expect([...boardWords(REPLAY_DATE, puzzle)].sort()).toEqual(
      [...boardWords(REPLAY_SOURCE, puzzle)].sort(),
    );
    const result = verifyWordGuess(REPLAY_DATE, ['patio'], extra)!;
    expect(result).toMatchObject({ solved: true, points: 6, marks: [Array(5).fill('correct')] });
    expect(verifyWordGuess(REPLAY_DATE, ['tribe'], extra)).toBeNull();
    const replay = replayConnections(
      puzzle,
      puzzle.groups.map((group) => group.words),
    )!;
    expect(replay).toMatchObject({ won: true, finished: true, mistakes: 0 });
    for (const share of [
      wordGuessShare(REPLAY_DATE, result),
      connectionsShare(REPLAY_DATE, 8, replay.grid),
    ]) {
      expect(share).toContain(REPLAY_DATE);
      expect(share).not.toContain(REPLAY_SOURCE);
      expect(share.toLowerCase()).not.toContain('patio');
    }
  });

  it('starts new content only at cutover and gives the replay override priority', () => {
    expect(NEW_ANSWER_LIST).toContain(dailyAnswer(CONTENT_CUTOVER));
    const added = ALL_CONNECTIONS_PUZZLES.slice(CONNECTIONS_PUZZLES.length).map((p) =>
      JSON.stringify(parsePuzzle(p)),
    );
    expect(added).toContain(puzzleKey(CONTENT_CUTOVER));
    const synthetic = contentRotation('fixture', 2, 4, (day) => ((day % 2) + 2) % 2);
    expect(synthetic(REPLAY_DATE)).toBe(synthetic(REPLAY_SOURCE));
  });
});

describe('expansion integrity and long-horizon rotation', () => {
  it('serves every expansion entry before any unused legacy content', () => {
    const newAnswers = Array.from({ length: NEW_ANSWER_LIST.length }, (_, i) =>
      dailyAnswer(dateAt(cutover + i)),
    );
    expect(new Set(newAnswers)).toEqual(new Set(NEW_ANSWER_LIST));
    const newPuzzles = ALL_CONNECTIONS_PUZZLES.slice(CONNECTIONS_PUZZLES.length).map((raw) =>
      JSON.stringify(parsePuzzle(raw)),
    );
    const firstPuzzles = Array.from({ length: newPuzzles.length }, (_, i) =>
      puzzleKey(dateAt(cutover + i)),
    );
    expect(new Set(firstPuzzles)).toEqual(new Set(newPuzzles));
  });

  it('adds only new dictionary-accepted five-letter answers', () => {
    expect(NEW_ANSWER_LIST).toHaveLength(259);
    expect(new Set(NEW_ANSWER_LIST).size).toBe(NEW_ANSWER_LIST.length);
    expect(new Set(ALL_ANSWERS).size).toBe(new Set(ANSWER_LIST).size + NEW_ANSWER_LIST.length);
    // The frozen legacy bank contains mango twice; deduplicate only the new rotation.
    expect(ANSWER_LIST.filter((word, index) => ANSWER_LIST.indexOf(word) !== index)).toEqual([
      'mango',
    ]);
    for (const word of NEW_ANSWER_LIST) {
      expect(word).toMatch(/^[a-z]{5}$/);
      expect(extra.has(word), word).toBe(true);
    }
    expect(ALL_CONNECTIONS_PUZZLES.length - CONNECTIONS_PUZZLES.length).toBeGreaterThanOrEqual(100);
  });

  it('rejects exact or near-duplicate expansion groups against every other puzzle', () => {
    const puzzles = ALL_CONNECTIONS_PUZZLES.map(parsePuzzle);
    const groups = puzzles.flatMap((puzzle, puzzleIndex) =>
      puzzle.groups.map((group) => ({
        puzzleIndex,
        name: group.name,
        words: new Set(group.words.map((word) => word.toLowerCase())),
      })),
    );
    const duplicates: string[] = [];
    for (let i = 0; i < groups.length; i++) {
      if (groups[i].puzzleIndex < CONNECTIONS_PUZZLES.length) continue;
      for (let j = 0; j < i; j++) {
        if (groups[i].puzzleIndex === groups[j].puzzleIndex) continue;
        const overlap = [...groups[i].words].filter((word) => groups[j].words.has(word));
        if (overlap.length >= 3)
          duplicates.push(`${groups[i].name} / ${groups[j].name}: ${overlap.join(', ')}`);
      }
    }
    expect(duplicates).toEqual([]);
  });

  for (const game of [
    { name: 'Word Guess', pick: dailyAnswer, count: () => new Set(ALL_ANSWERS).size },
    { name: 'Connections', pick: puzzleKey, count: () => ALL_CONNECTIONS_PUZZLES.length },
  ]) {
    it(`${game.name} exhausts every never-served entry before repeats, then cycles without early repeats`, () => {
      const served = new Set(Array.from({ length: cutover }, (_, i) => game.pick(dateAt(i))));
      const total = game.count();
      const fresh = total - served.size;
      const rotation = Array.from({ length: total }, (_, i) => game.pick(dateAt(cutover + i)));
      expect(new Set(rotation).size).toBe(total);
      expect(rotation.slice(0, fresh).some((key) => served.has(key))).toBe(false);
      expect(served.has(rotation[fresh])).toBe(true);
      const last = new Map<string, number>();
      for (let day = 0; day < 10000; day++) {
        const key = game.pick(dateAt(cutover + day));
        expect(key).toBe(rotation[day % total]);
        const previous = last.get(key);
        if (previous !== undefined) expect(day - previous).toBe(total);
        last.set(key, day);
      }
    });
  }
});
