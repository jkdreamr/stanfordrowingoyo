// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ANSWER_LIST, dailyAnswer, verifyWordGuess, unpack } from '../../../shared/games/wordGuess';
import { GUESSES } from '../../../shared/games/wordGuessGuesses';
import { parsePerceptionAnswer, perceptionPuzzle } from '../../../shared/games/perception';
import { parseRateHoldTaps, rateHoldRates, intervalMs } from '../../../shared/games/rateHold';
import { WordGuessPlay } from './wordguess/WordGuessPlay';
import { PerceptionPlay } from './perception/PerceptionPlay';
import { RateHoldPlay } from './ratehold/RateHoldPlay';

const DATE = '2026-11-07';
beforeAll(() => {
  window.matchMedia ??= ((q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as never;
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});

describe('WordGuessPlay', () => {
  it('plays a physical-keyboard game and submits a verifiable board', async () => {
    const onComplete = vi.fn();
    render(<WordGuessPlay date={DATE} onComplete={onComplete} />);
    const answer = dailyAnswer(DATE);
    const miss = ANSWER_LIST.find((w) => w !== answer)!;
    const type = (word: string) => {
      for (const k of word) fireEvent.keyDown(window, { key: k });
      fireEvent.keyDown(window, { key: 'Enter' });
    };
    await waitFor(() => {
      type('qqqqq');
      expect(screen.getByRole('status').textContent).toBe('Not in Word List');
    });
    for (let i = 0; i < 5; i++) fireEvent.keyDown(window, { key: 'Backspace' });
    type(miss);
    expect(screen.getByRole('row', { name: 'Guess 1' })).toBeTruthy();
    for (const k of answer)
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${k.toUpperCase()}(,|$)`) }));
    fireEvent.click(screen.getByRole('button', { name: 'Enter' }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 3000 });
    const payload = onComplete.mock.calls[0][0] as { guesses: string[] };
    expect(payload.guesses).toEqual([miss, answer]);
    expect(verifyWordGuess(DATE, payload.guesses, new Set(unpack(GUESSES)))?.points).toBe(5);
  });
  it('resumes an unfinished board for the same day', () => {
    const miss = ANSWER_LIST.find((w) => w !== dailyAnswer(DATE))!;
    localStorage.setItem(`oyo:games:wordguess:${DATE}`, JSON.stringify([miss]));
    render(<WordGuessPlay date={DATE} onComplete={() => {}} />);
    expect(screen.getByRole('row', { name: 'Guess 1' }).textContent).toBe(miss.toUpperCase());
  });
});

describe('PerceptionPlay', () => {
  it('runs every round and returns a well-formed answer', async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const p = perceptionPuzzle(DATE);
    render(
      <MemoryRouter>
        <PerceptionPlay date={DATE} onComplete={onComplete} />
      </MemoryRouter>,
    );
    const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
    click('Ready');
    const hold = screen.getByRole('button', { name: 'Press and Hold' });
    fireEvent.keyDown(hold, { key: ' ' });
    act(() => vi.advanceTimersByTime(p.clockMs));
    fireEvent.keyUp(hold, { key: ' ' });
    click('Next');
    click('Start');
    act(() => vi.advanceTimersByTime(2000));
    click('Lock In');
    click('Next');
    click('Start');
    act(() => vi.advanceTimersByTime(1000));
    const board = screen.getByTestId('spot-board');
    board.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
    fireEvent.pointerDown(board, { clientX: 50, clientY: 50 });
    click('Lock In');
    click('Next');
    click('Start');
    act(() => vi.advanceTimersByTime(2000));
    for (const c of p.cells) click(`Square ${c + 1}`);
    click('Lock In');
    expect(screen.getByText('100')).toBeTruthy();
    click('Next');
    click('Start');
    act(() => vi.advanceTimersByTime(p.reactionDelayMs + 5));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Tap' }));
    click('See Result');
    const answer = onComplete.mock.calls[0][0];
    expect(parsePerceptionAnswer(answer)).toEqual(answer);
    expect([...answer.cells].sort((a: number, b: number) => a - b)).toEqual(p.cells);
    expect(answer.dot).toEqual([500, 500]);
  });
});

describe('RateHoldPlay', () => {
  it('records three pieces of plausible taps', () => {
    const onComplete = vi.fn();
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    render(
      <MemoryRouter>
        <RateHoldPlay date={DATE} onComplete={onComplete} />
      </MemoryRouter>,
    );
    for (const [i, rate] of rateHoldRates(DATE).entries()) {
      fireEvent.click(screen.getByRole('button', { name: 'Start Piece' }));
      const pad = screen.getByTestId('catch-pad');
      for (let s = 0; s < 8; s++) {
        clock += s === 0 ? 0 : intervalMs(rate);
        fireEvent.pointerDown(pad);
      }
      expect(screen.getByText(rate.toFixed(1))).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: i === 2 ? 'See Result' : 'Next Piece' }));
    }
    const { taps } = onComplete.mock.calls[0][0];
    expect(parseRateHoldTaps(taps)).toEqual(taps);
    vi.restoreAllMocks();
  });
});
