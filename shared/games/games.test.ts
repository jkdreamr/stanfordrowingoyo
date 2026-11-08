import { describe, expect, it } from 'vitest';
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
} from './wordGuess';
import { GUESSES } from './wordGuessGuesses';
import {
  PATTERN_CELLS,
  hueDistance,
  parsePerceptionAnswer,
  perceptionPuzzle,
  perceptionShare,
  perceptionTotal,
  scorePerception,
  scoreReaction,
} from './perception';
import {
  CUED_STROKES,
  PIECES,
  STROKES_PER_PIECE,
  intervalMs,
  parseRateHoldTaps,
  rateHoldRates,
  rateHoldShare,
  scoreRateHold,
} from './rateHold';

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

describe('rate hold', () => {
  const steady = (rate: number, jitter = 0) =>
    Array.from({ length: STROKES_PER_PIECE }, (_, i) =>
      Math.round(i * intervalMs(rate) + (i % 2 ? jitter : 0)),
    );
  it('builds a stepped daily piece', () => {
    for (const date of dates) {
      const rates = rateHoldRates(date);
      expect(rates).toHaveLength(PIECES);
      expect(rates[1] - rates[0]).toBe(4);
      expect(rates[0]).toBeGreaterThanOrEqual(18);
      expect(rates[0]).toBeLessThanOrEqual(24);
      expect(rateHoldRates(date)).toEqual(rates);
    }
  });
  it('scores perfect timing at 100 and drift lower', () => {
    const date = '2026-11-07';
    const rates = rateHoldRates(date);
    const perfect = scoreRateHold(
      date,
      rates.map((r) => steady(r)),
    );
    expect(perfect.total).toBe(100);
    expect(perfect.held).toEqual(rates);
    expect(rateHoldShare(date, perfect)).toContain('100/100');
    const slow = scoreRateHold(
      date,
      rates.map((r) => steady(r - 3)),
    );
    expect(slow.total).toBeLessThan(60);
    expect(slow.held[0]).toBeCloseTo(rates[0] - 3, 0);
  });
  it('only scores the held strokes', () => {
    const date = '2026-11-07';
    const rates = rateHoldRates(date);
    const taps = rates.map((r) => {
      const t = steady(r);
      t[0] = t[1] - 2000;
      return t.map((x) => x + 2000);
    });
    expect(CUED_STROKES).toBeGreaterThan(1);
    expect(scoreRateHold(date, taps).total).toBe(100);
  });
  it('rejects implausible taps', () => {
    const good = [steady(20), steady(24), steady(28)];
    expect(parseRateHoldTaps(good)).toEqual(good);
    expect(parseRateHoldTaps(good.slice(0, 2))).toBeNull();
    expect(parseRateHoldTaps([good[0].slice(1), good[1], good[2]])).toBeNull();
    expect(parseRateHoldTaps([good[0].map((_, i) => i * 100), good[1], good[2]])).toBeNull();
    expect(parseRateHoldTaps([[...good[0]].reverse(), good[1], good[2]])).toBeNull();
    expect(parseRateHoldTaps([good[0].map((t) => t + 0.5), good[1], good[2]])).toBeNull();
  });
});
