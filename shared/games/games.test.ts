import { describe, expect, it } from 'vitest';
import { perceptionPuzzle, scorePerception } from '../../worker/src/games/perception';
import { closeness, dailyRandom, dayNumber, hashSeed } from './daily';
import {
  ANSWER_LIST,
  dailyAnswer,
  dailyIndex,
  letterStates,
  score,
  unpack,
  verifyWordGuess,
  wordGuessShare,
} from '../../worker/src/games/wordGuess';
import { GUESSES } from './wordGuessGuesses';
import {
  PATTERN_CELLS,
  hueDistance,
  parsePerceptionAnswer,
  perceptionShare,
  perceptionTotal,
  scoreReaction,
} from './perception';
import {
  CONNECTIONS_MAX,
  MAX_MISTAKES,
  boardWords,
  connectionsScore,
  connectionsShare,
  formatConnectionsScore,
  parsePuzzle,
  puzzleIndex,
  replayConnections,
  type ConnectionsPuzzle,
} from './connections';
import {
  CONNECTIONS_PUZZLES,
  connectionsPuzzleFor,
} from '../../worker/src/games/connectionsPuzzles';

const extra = new Set(unpack(GUESSES));
const dates = Array.from({ length: 60 }, (_, i) =>
  new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10),
);

describe('daily seeds', () => {
  it('counts days from 2026-01-01', () => {
    expect(dayNumber('2026-01-01')).toBe(0);
    expect(dayNumber('2026-03-09')).toBe(67);
    expect(dayNumber('2027-01-01')).toBe(365);
  });
  it('is deterministic per game and date', () => {
    const a = dailyRandom('x', '2026-11-07');
    const b = dailyRandom('x', '2026-11-07');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(hashSeed('x:2026-11-07')).not.toBe(hashSeed('y:2026-11-07'));
    expect(dailyRandom('x', '2026-11-08')()).not.toBe(dailyRandom('x', '2026-11-07')());
  });
  it('scores closeness smoothly', () => {
    expect(closeness(0, 10)).toBe(100);
    expect(closeness(10, 10)).toBe(61);
    expect(closeness(-5, 10)).toBe(88);
    expect(closeness(1000, 10)).toBe(0);
    expect(closeness(Number.NaN, 10)).toBe(0);
  });
});

describe('word guess', () => {
  it('keeps the curated lists intact', () => {
    expect(ANSWER_LIST).toHaveLength(2000);
    expect(extra.size).toBe(9358);
    expect(ANSWER_LIST.every((w) => /^[a-z]{5}$/.test(w))).toBe(true);
  });
  it('scores duplicate letters like the original', () => {
    expect(score('crane', 'crane')).toEqual(Array(5).fill('correct'));
    expect(score('speed', 'abide')).toEqual(['absent', 'absent', 'present', 'absent', 'present']);
    expect(score('eerie', 'there')).toEqual(['present', 'absent', 'present', 'absent', 'correct']);
    expect(score('llama', 'hello')).toEqual(['present', 'present', 'absent', 'absent', 'absent']);
  });
  it('keeps the best mark per letter', () => {
    expect(letterStates(['eerie', 'there'], 'there')).toMatchObject({
      e: 'correct',
      t: 'correct',
      r: 'correct',
      i: 'absent',
    });
  });
  it('picks the same answer for everyone and cycles without early repeats', () => {
    expect(dailyAnswer('2026-11-07')).toBe(dailyAnswer('2026-11-07'));
    const seen = new Set(dates.map(dailyAnswer));
    expect(seen.size).toBe(dates.length);
    const order = Array.from({ length: 2000 }, (_, d) => dailyIndex(d, 2000));
    expect(new Set(order).size).toBe(2000);
  });
  it('verifies a solved board server-side', () => {
    const date = '2026-11-07';
    const answer = dailyAnswer(date);
    const miss = ANSWER_LIST.find((w) => w !== answer)!;
    const result = verifyWordGuess(date, [miss, answer], extra)!;
    expect(result).toMatchObject({ solved: true, tries: 2, points: 5 });
    expect(wordGuessShare(date, result).split('\n')[0]).toBe('OYO Word Guess 2026-11-07 2/6');
    expect(wordGuessShare(date, result).toLowerCase()).not.toContain(answer.toLowerCase());
  });
  it('accepts a full failed board and scores it zero', () => {
    const date = '2026-11-07';
    const answer = dailyAnswer(date);
    const misses = ANSWER_LIST.filter((w) => w !== answer).slice(0, 6);
    expect(verifyWordGuess(date, misses, extra)).toMatchObject({
      solved: false,
      tries: 6,
      points: 0,
    });
  });
  it('rejects forged or unfinished boards', () => {
    const date = '2026-11-07';
    const answer = dailyAnswer(date);
    const other = ANSWER_LIST.find((w) => w !== answer)!;
    expect(verifyWordGuess(date, [], extra)).toBeNull();
    expect(verifyWordGuess(date, ['zzzzz'], extra)).toBeNull();
    expect(verifyWordGuess(date, [answer.toUpperCase()], extra)).toBeNull();
    expect(verifyWordGuess(date, [other], extra)).toBeNull();
    expect(verifyWordGuess(date, [answer, answer], extra)).toBeNull();
    expect(verifyWordGuess(date, Array(7).fill(other), extra)).toBeNull();
    expect(verifyWordGuess(date, 'crane', extra)).toBeNull();
    expect(verifyWordGuess('2026-11-08', [answer], extra)?.solved ?? false).toBe(
      dailyAnswer('2026-11-08') === answer,
    );
  });
});

describe('perception', () => {
  it('builds a stable, valid puzzle per date', () => {
    for (const date of dates) {
      const p = perceptionPuzzle(date);
      expect(p).toEqual(perceptionPuzzle(date));
      expect(p.clockMs).toBeGreaterThanOrEqual(2500);
      expect(p.clockMs).toBeLessThanOrEqual(6000);
      expect(new Set(p.cells).size).toBe(PATTERN_CELLS);
      expect(p.reactionDelayMs).toBeGreaterThanOrEqual(1500);
    }
    expect(perceptionPuzzle('2026-11-07')).not.toEqual(perceptionPuzzle('2026-11-08'));
  });
  it('scores a perfect run at 500', () => {
    const date = '2026-11-07';
    const p = perceptionPuzzle(date);
    const scores = scorePerception(date, {
      clockMs: p.clockMs,
      hue: p.hue,
      dot: p.dot,
      cells: p.cells,
      reactionMs: 150,
    });
    expect(perceptionTotal(scores)).toBe(500);
    expect(perceptionShare(date, scores)).toContain('500/500');
    expect(perceptionShare(date, scores).split('\n').slice(1)).toHaveLength(5);
    expect(perceptionShare(date, { ...scores, clock: 62 })).toContain('Clock 🟩🟩🟩⬜⬜ 62');
  });
  it('falls off with distance and penalises false starts', () => {
    expect(hueDistance(350, 10)).toBe(20);
    expect(scoreReaction(-1)).toBe(0);
    expect(scoreReaction(60)).toBe(0);
    expect(scoreReaction(250)).toBe(88);
    const date = '2026-11-07';
    const p = perceptionPuzzle(date);
    const off = scorePerception(date, {
      clockMs: p.clockMs + 600,
      hue: (p.hue + 25) % 360,
      dot: [p.dot[0], p.dot[1] > 500 ? p.dot[1] - 80 : p.dot[1] + 80],
      cells: [
        ...p.cells.slice(0, 5),
        ...Array.from({ length: 25 }, (_, i) => i)
          .filter((c) => !p.cells.includes(c))
          .slice(0, 2),
      ],
      reactionMs: 350,
    });
    expect(off).toEqual({ clock: 61, color: 61, dot: 61, pattern: 61, reaction: 61 });
  });
  it('rejects malformed answers', () => {
    const ok = {
      clockMs: 3000,
      hue: 10,
      dot: [500, 500],
      cells: [0, 1, 2, 3, 4, 5, 6],
      reactionMs: 220,
    };
    expect(parsePerceptionAnswer(ok)).toEqual(ok);
    expect(parsePerceptionAnswer({ ...ok, reactionMs: -1 })).not.toBeNull();
    expect(parsePerceptionAnswer({ ...ok, hue: 360 })).toBeNull();
    expect(parsePerceptionAnswer({ ...ok, clockMs: 1.5 })).toBeNull();
    expect(parsePerceptionAnswer({ ...ok, dot: [500] })).toBeNull();
    expect(parsePerceptionAnswer({ ...ok, cells: [0, 0, 1, 2, 3, 4, 5] })).toBeNull();
    expect(parsePerceptionAnswer({ ...ok, cells: [0, 1, 2, 3, 4, 5, 25] })).toBeNull();
    expect(parsePerceptionAnswer({ ...ok, reactionMs: 99999 })).toBeNull();
    expect(parsePerceptionAnswer(null)).toBeNull();
  });
});

describe('connections', () => {
  const puzzles = CONNECTIONS_PUZZLES.map(parsePuzzle);
  const norm = (w: string) => w.toLowerCase();

  /**
   * Counts partitions into four groups of four where each group fits a distinct category,
   * treating every red herring as a member of its decoy group too.
   */
  function solutions(p: ConnectionsPuzzle) {
    const fits = p.groups.map((g, i) => {
      const set = new Set(g.words);
      for (const h of p.herrings) if (h.group === i) set.add(h.word);
      return set;
    });
    const words = p.groups.flatMap((g) => g.words);
    let count = 0;
    const assign = (k: number, used: number[]) => {
      if (k === words.length) return void count++;
      for (let c = 0; c < 4; c++)
        if (used[c] < 4 && fits[c].has(words[k])) {
          used[c]++;
          assign(k + 1, used);
          used[c]--;
        }
    };
    assign(0, [0, 0, 0, 0]);
    return count;
  }

  it('has at least 90 well-formed original puzzles', () => {
    expect(puzzles.length).toBeGreaterThanOrEqual(90);
    const boards = new Set<string>();
    for (const p of puzzles) {
      expect(p.groups).toHaveLength(4);
      expect(p.groups.map((g) => g.level)).toEqual([0, 1, 2, 3]);
      const words = p.groups.flatMap((g) => g.words);
      for (const g of p.groups) {
        expect(g.name.length).toBeGreaterThan(1);
        expect(g.words).toHaveLength(4);
      }
      expect(words).toHaveLength(16);
      expect(new Set(words.map(norm)).size).toBe(16);
      for (const w of words) {
        expect(w).toMatch(/^[A-Za-z][A-Za-z' .-]*$/);
        for (const part of w.split(' ')) expect(part.length).toBeLessThanOrEqual(9);
        expect(p.groups.filter((g) => g.words.includes(w))).toHaveLength(1);
      }
      boards.add([...words].map(norm).sort().join());
    }
    expect(boards.size).toBe(puzzles.length);
  });

  it('gives every puzzle at least three red herrings across two groups and one solution', () => {
    for (const p of puzzles) {
      expect(p.herrings.length).toBeGreaterThanOrEqual(3);
      expect(new Set(p.herrings.map((h) => h.group)).size).toBeGreaterThanOrEqual(2);
      expect(new Set(p.herrings.map((h) => `${h.word}>${h.group}`)).size).toBe(p.herrings.length);
      for (const h of p.herrings) {
        const own = p.groups.findIndex((g) => g.words.includes(h.word));
        expect(own).toBeGreaterThanOrEqual(0);
        expect(h.group).not.toBe(own);
        expect(h.group).toBeGreaterThanOrEqual(0);
        expect(h.group).toBeLessThan(4);
      }
      // Exhaustive: no swap cycle of decoys may produce a second valid board.
      expect(solutions(p)).toBe(1);
    }
  });

  it('never repeats a category name across puzzles', () => {
    const names = puzzles.flatMap((p) => p.groups.map((g) => g.name.toLowerCase()));
    expect(new Set(names).size).toBe(names.length);
  });

  it('picks one shared puzzle per date with no repeat inside 60 days', () => {
    const n = CONNECTIONS_PUZZLES.length;
    const year = Array.from({ length: 400 }, (_, i) =>
      new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    );
    const picks = year.map((d) => puzzleIndex(d, n));
    for (let i = 0; i < picks.length; i++)
      expect(picks.slice(Math.max(0, i - 59), i)).not.toContain(picks[i]);
    expect(new Set(picks.slice(0, n)).size).toBe(n);
    expect(connectionsPuzzleFor('2026-11-07')).toBe(connectionsPuzzleFor('2026-11-07'));
    const board = boardWords('2026-11-07', connectionsPuzzleFor('2026-11-07'));
    expect(boardWords('2026-11-07', connectionsPuzzleFor('2026-11-07'))).toEqual(board);
    expect([...board].sort()).toEqual(
      connectionsPuzzleFor('2026-11-07')
        .groups.flatMap((g) => g.words)
        .sort(),
    );
  });

  const p = puzzles[0];
  const [a, b, c, d] = p.groups.map((g) => g.words);
  const oneAway = [a[0], a[1], a[2], b[0]];
  const wrong = [a[0], a[1], b[0], b[1]];

  it('replays solves, One Away and mistakes', () => {
    const r = replayConnections(p, [oneAway, d, wrong, a, b, c])!;
    expect(r.outcomes).toEqual(['one_away', 'correct', 'wrong', 'correct', 'correct', 'correct']);
    expect(r).toMatchObject({ solved: [3, 0, 1, 2], mistakes: 2, finished: true, won: true });
    expect(connectionsScore(r)).toBe(6);
    expect(formatConnectionsScore(6)).toBe('4 / 4 · 2 Mistakes');
    const share = connectionsShare('2026-11-07', 6, r.grid).toLowerCase();
    for (const group of p.groups) {
      expect(share).not.toContain(group.name.toLowerCase());
      for (const word of group.words) expect(share).not.toContain(word.toLowerCase());
    }
    expect(connectionsShare('2026-11-07', 6, r.grid).split('\n')).toEqual([
      'OYO Connections 2026-11-07 4/4',
      '',
      '\u{1F7E8}\u{1F7E8}\u{1F7E8}\u{1F7E9}',
      '\u{1F7EA}\u{1F7EA}\u{1F7EA}\u{1F7EA}',
      '\u{1F7E8}\u{1F7E8}\u{1F7E9}\u{1F7E9}',
      '\u{1F7E8}\u{1F7E8}\u{1F7E8}\u{1F7E8}',
      '\u{1F7E9}\u{1F7E9}\u{1F7E9}\u{1F7E9}',
      '\u{1F7E6}\u{1F7E6}\u{1F7E6}\u{1F7E6}',
    ]);
  });

  it('ranks every win above every loss and fewer mistakes higher', () => {
    expect(connectionsScore(replayConnections(p, [a, b, c, d])!)).toBe(CONNECTIONS_MAX);
    const misses = [wrong, oneAway, [a[0], b[0], c[0], d[0]], [a[1], b[1], c[1], d[1]]];
    const lost = replayConnections(p, [
      a,
      [b[0], b[1], c[0], c[1]],
      [b[0], b[1], b[2], c[0]],
      [b[0], c[0], d[0], d[1]],
      [b[1], c[1], d[1], d[2]],
    ])!;
    expect(lost).toMatchObject({ finished: true, won: false, mistakes: MAX_MISTAKES });
    expect(connectionsScore(lost)).toBe(1);
    expect(formatConnectionsScore(1)).toBe('1 / 4 · 4 Mistakes');
    const scores = [0, 1, 2, 3].map((m) =>
      connectionsScore(replayConnections(p, [...misses.slice(0, m), a, b, c, d])!),
    );
    expect(scores).toEqual([8, 7, 6, 5]);
  });

  it('rejects boards a real game cannot produce', () => {
    expect(replayConnections(p, 'nope')).toBeNull();
    expect(replayConnections(p, [[a[0], a[1], a[2]]])).toBeNull();
    expect(replayConnections(p, [[a[0], a[0], a[1], a[2]]])).toBeNull();
    expect(replayConnections(p, [[a[0], a[1], a[2], 'Zzz']])).toBeNull();
    expect(replayConnections(p, [a, a])).toBeNull();
    expect(replayConnections(p, [wrong, [...wrong].reverse()])).toBeNull();
    expect(replayConnections(p, [a, b, c, d, wrong])).toBeNull();
    expect(replayConnections(p, Array(9).fill(wrong))).toBeNull();
    expect(replayConnections(p, [a, [a[0], b[0], b[1], b[2]]])).toBeNull();
  });
});
