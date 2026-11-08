// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  ANSWER_LIST,
  dailyAnswer,
  verifyWordGuess,
  unpack,
  score,
  isAllowedWord,
} from '../../../worker/src/games/wordGuess';
import { GUESSES } from '../../../shared/games/wordGuessGuesses';
import { parsePerceptionAnswer, perceptionPuzzle } from '../../../shared/games/perception';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { boardWords, replayConnections } from '../../../shared/games/connections';
import { connectionsPuzzleFor } from '../../../worker/src/games/connectionsPuzzles';
import { WordGuessPlay } from './wordguess/WordGuessPlay';
import { PerceptionPlay } from './perception/PerceptionPlay';
import { ConnectionsPlay } from './connections/ConnectionsPlay';

vi.mock('../lib/api', async (original) => {
  const actual = await original<typeof import('../lib/api')>();
  return {
    ...actual,
    api: vi.fn(async (route: string, init?: { body?: { guesses?: unknown; guess?: string } }) => {
      if (route.includes('/wordguess/')) {
        if (route.startsWith('POST')) {
          const word = init?.body?.guess ?? '';
          if (!isAllowedWord(word, new Set(unpack(GUESSES)))) throw new Error('Not in Word List');
          wordGuesses.push(word);
        }
        const answer = dailyAnswer(DATE);
        const won = wordGuesses.at(-1) === answer;
        const done = won || wordGuesses.length === 6;
        return {
          date: DATE,
          access: { unlocked: true },
          guesses: wordGuesses.map((word) => ({ word, marks: score(word, answer) })),
          done,
          won,
          answer: done ? answer : null,
        };
      }
      const puzzle = connectionsPuzzleFor(DATE);
      if (route === 'GET /api/games/connections/today')
        return { date: DATE, access: {}, words: boardWords(DATE, puzzle) };
      const replay = replayConnections(puzzle, init?.body?.guesses)!;
      return {
        outcome: replay.outcomes.at(-1),
        mistakes: replay.mistakes,
        finished: replay.finished,
        won: replay.won,
        solved: replay.solved.map((l) => puzzle.groups[l]),
        groups: replay.finished ? puzzle.groups : null,
      };
    }),
  };
});

const DATE = '2026-11-07';
let wordGuesses: string[] = [];
function mountWord(onComplete = () => {}) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <WordGuessPlay date={DATE} onComplete={onComplete} />
    </QueryClientProvider>,
  );
}
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
  wordGuesses = [];
  vi.useRealTimers();
});

describe('WordGuessPlay', () => {
  it('plays a physical-keyboard game and submits a verifiable board', async () => {
    const onComplete = vi.fn();
    mountWord(onComplete);
    await screen.findByRole('grid');
    const answer = dailyAnswer(DATE);
    const miss = ANSWER_LIST.find((w) => w !== answer)!;
    const type = (word: string) => {
      for (const k of word) fireEvent.keyDown(window, { key: k });
      fireEvent.keyDown(window, { key: 'Enter' });
    };
    type('qqqqq');
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Not in Word List'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Enter' }).hasAttribute('disabled')).toBe(false),
    );
    for (let i = 0; i < 5; i++) fireEvent.keyDown(window, { key: 'Backspace' });
    type(miss);
    await screen.findByRole('row', { name: 'Guess 1' });
    for (const k of answer)
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${k.toUpperCase()}(,|$)`) }));
    fireEvent.click(screen.getByRole('button', { name: 'Enter' }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 3000 });
    const payload = onComplete.mock.calls[0][0] as { guesses: string[] };
    expect(payload.guesses).toEqual([miss, answer]);
    expect(verifyWordGuess(DATE, payload.guesses, new Set(unpack(GUESSES)))?.points).toBe(5);
  });
  it('resumes server progress and ignores a forged local draft', async () => {
    const miss = ANSWER_LIST.find((w) => w !== dailyAnswer(DATE))!;
    wordGuesses = [miss];
    localStorage.setItem(`oyo:games:wordguess:${DATE}`, JSON.stringify([dailyAnswer(DATE)]));
    mountWord();
    expect((await screen.findByRole('row', { name: 'Guess 1' })).textContent).toBe(
      miss.toUpperCase(),
    );
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

describe('ConnectionsPlay', () => {
  const groups = connectionsPuzzleFor(DATE).groups;
  const view = (onComplete = vi.fn()) =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ConnectionsPlay date={DATE} onComplete={onComplete} />
      </QueryClientProvider>,
    );
  const tile = (word: string) => screen.getByRole('button', { name: word });
  const pick = (words: string[]) => words.forEach((w) => fireEvent.click(tile(w)));

  it('selects, deselects, shows One Away, collapses solves and persists progress', async () => {
    const onComplete = vi.fn();
    view(onComplete);
    await screen.findByRole('group', { name: 'Words' });
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(16);
    const [a, b, c, d] = groups.map((g) => g.words);
    pick([a[0], a[1], a[2], a[3], b[0]]);
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Deselect All' }));
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
    pick([a[0], a[1], a[2], b[0]]);
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('One Away'));
    expect(screen.getByRole('img', { name: '3 Mistakes Left' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByRole('status').textContent).toBe('Already Guessed');
    fireEvent.click(screen.getByRole('button', { name: 'Deselect All' }));
    pick(d);
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    expect(screen.getByRole('listitem').textContent).toContain(groups[3].name);
    expect(screen.queryByRole('button', { name: d[0] })).toBeNull();
    const order = screen.getAllByRole('button', { pressed: false }).map((el) => el.textContent);
    fireEvent.click(screen.getByRole('button', { name: 'Shuffle' }));
    const shuffled = screen.getAllByRole('button', { pressed: false }).map((el) => el.textContent);
    expect([...shuffled].sort()).toEqual([...order].sort());

    cleanup();
    view(onComplete);
    await screen.findByRole('group', { name: 'Words' });
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    expect(screen.getByRole('img', { name: '3 Mistakes Left' })).toBeTruthy();
    for (const g of [a, b, c]) {
      pick(g);
      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
      await waitFor(() => expect(screen.queryByRole('button', { name: g[0] })).toBeNull());
    }
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 4000 });
    expect(onComplete.mock.calls[0][0]).toEqual({
      guesses: [[a[0], a[1], a[2], b[0]], d, a, b, c],
    });
  });
});
