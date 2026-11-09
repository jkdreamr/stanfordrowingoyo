// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../../lib/api';
import { PerceptionPlay } from './PerceptionPlay';
import { MORE_TITLES } from './MoreRounds';
import type { PerceptionStimulus } from '../../../../shared/types';

vi.mock('../../lib/api', () => ({ api: vi.fn() }));
type Id = keyof typeof MORE_TITLES;
const DATE = '2026-11-12';
const stimuli: Record<Id, PerceptionStimulus> = {
  ratio: { ratioDiameters: [360, 216] },
  beat: { beatIntervalMs: 650 },
  path: { path: { from: [100, 300], to: [550, 500] } },
  order: { order: [2, 13, 5, 8, 15, 0] },
  duration: { durationMs: 1350 },
  centroid: {
    centroidDots: [
      [200, 300],
      [400, 300],
      [600, 300],
      [200, 500],
      [400, 500],
      [600, 500],
    ],
  },
};
const exposures: Record<Id, number> = {
  ratio: 1000,
  beat: 2600,
  path: 900,
  order: 3000,
  duration: 1350,
  centroid: 1000,
};
const labels: Record<Id, string> = {
  ratio: 'Two Circles',
  beat: 'Beat Flashes',
  path: 'Crossing Position',
  order: 'Tile Sequence',
  duration: 'Duration Bar',
  centroid: 'Center Position',
};
let active: Id, submitted: unknown;
const view = () => ({
  date: DATE,
  access: { date: DATE, unlocked: true, reason: 'staff' },
  round: 0,
  rounds: [active, 'clock', 'color', 'dot', 'reaction'],
  scores: {},
  done: false,
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('PointerEvent', MouseEvent);
  submitted = undefined;
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path.endsWith('/start')) return { ...view(), stimulus: stimuli[active] } as never;
    if (path.endsWith('/answer')) {
      submitted = (options as { body: { answer: unknown } }).body.answer;
      return { ...view(), round: 1, scores: { [active]: 61 } } as never;
    }
    return view() as never;
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
const click = async (name: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
const advance = async (ms: number) =>
  act(async () => {
    vi.advanceTimersByTime(ms);
  });
async function open(id: Id) {
  active = id;
  await act(async () => {
    render(<PerceptionPlay date={DATE} onComplete={() => {}} />);
  });
}

it.each(Object.keys(MORE_TITLES) as Id[])(
  'gates %s, accepts its control and reveals its score',
  async (id) => {
    await open(id);
    expect(screen.getByRole('heading', { name: MORE_TITLES[id] })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lock In' })).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Tile Sequence' })).toBeNull();
    await click('Start');
    expect(screen.getByRole(id === 'order' ? 'group' : 'img', { name: labels[id] })).toBeTruthy();
    await advance(exposures[id] - 1);
    expect(submitted).toBeUndefined();
    expect(screen.queryByRole('button', { name: 'Lock In' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue the Beat' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Press and Hold' })).toBeNull();
    await advance(1);
    if (id === 'ratio') {
      expect(screen.queryByRole('img', { name: 'Two Circles' })).toBeNull();
      fireEvent.change(screen.getByRole('slider', { name: 'Area Percentage' }), {
        target: { value: '36' },
      });
      expect(screen.getByLabelText('Your Area Percentage').textContent).toBe('36%');
    } else if (id === 'beat') {
      const pad = screen.getByRole('button', { name: 'Continue the Beat' });
      await advance(550);
      for (let i = 0; i < 4; i++) {
        await act(async () => {
          fireEvent.pointerDown(pad);
        });
        if (i < 3) {
          expect(submitted).toBeUndefined();
          expect(screen.getByRole('status').textContent).toBe(`${i + 1} of 4 Taps`);
          await advance(650);
        }
      }
    } else if (id === 'duration') {
      const pad = screen.getByRole('button', { name: 'Press and Hold' });
      fireEvent.keyDown(pad, { key: ' ' });
      await advance(1350);
      await act(async () => {
        fireEvent.keyUp(pad, { key: ' ' });
      });
    } else if (id === 'order') {
      expect((screen.getByRole('button', { name: 'Lock In' }) as HTMLButtonElement).disabled).toBe(
        true,
      );
      await click('Tile 1');
      await click('Tile 2');
      await click('Undo');
      expect(screen.getByRole('button', { name: 'Tile 1' }).textContent).toBe('1');
      expect(screen.getByRole('button', { name: 'Tile 2' }).textContent).toBe('');
      await click('Clear');
      expect((screen.getByRole('button', { name: 'Lock In' }) as HTMLButtonElement).disabled).toBe(
        true,
      );
      for (const cell of [2, 13, 5, 8, 15, 0]) await click(`Tile ${cell + 1}`);
    } else {
      const board = screen.getByRole(id === 'path' ? 'slider' : 'button', {
        name: id === 'path' ? 'Crossing Position' : 'Center Position',
      });
      expect(board.hasAttribute('data-no-tab-swipe')).toBe(true);
      expect((screen.getByRole('button', { name: 'Lock In' }) as HTMLButtonElement).disabled).toBe(
        true,
      );
      board.querySelector('.pc-v3-canvas')!.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
      fireEvent.pointerDown(board, { clientX: 40, clientY: id === 'path' ? 40 : 60, pointerId: 1 });
      fireEvent.keyDown(board, { key: id === 'path' ? 'ArrowDown' : 'ArrowRight' });
    }
    if (!['beat', 'duration'].includes(id)) await click('Lock In');
    const expected = {
      ratio: { ratio: 36 },
      beat: { beatMs: [650, 650, 650, 650] },
      path: { pathY: 410 },
      order: { order: [2, 13, 5, 8, 15, 0] },
      duration: { durationMs: 1350 },
      centroid: { centroid: [410, 600] },
    };
    expect(submitted).toEqual(expected[id]);
    expect(screen.getByText('61')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();
    expect(document.querySelector('[autofocus]')).toBeNull();
    expect(
      screen.getByText(id === 'path' || id === 'centroid' ? 'Your Ring · Target Dot' : /Target/),
    ).toBeTruthy();
  },
);

it.each(Object.keys(MORE_TITLES) as Id[])('waits for /start before exposing %s', async (id) => {
  await open(id);
  let resolve!: (v: never) => void;
  vi.mocked(api).mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  await click('Start');
  await advance(10000);
  expect(screen.queryByRole('img')).toBeNull();
  expect(submitted).toBeUndefined();
  await act(async () => {
    resolve({ ...view(), stimulus: stimuli[id] } as never);
  });
  expect(
    screen.getByText(
      id === 'path' ? 'Follow the Dot' : id === 'beat' ? 'Watch the Beat' : 'Look Carefully',
    ),
  ).toBeTruthy();
  await advance(exposures[id] - 1);
  expect(submitted).toBeUndefined();
});

it.each(Object.keys(MORE_TITLES) as Id[])('keeps %s on its brief when start fails', async (id) => {
  await open(id);
  vi.mocked(api).mockRejectedValueOnce(new Error('Offline. Try Again.'));
  await click('Start');
  expect(screen.getByRole('alert').textContent).toBe('Offline. Try Again.');
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.queryByRole('group', { name: 'Tile Sequence' })).toBeNull();
  expect((screen.getByRole('button', { name: 'Start' }) as HTMLButtonElement).disabled).toBe(false);
  expect(submitted).toBeUndefined();
});

it('cancels an interrupted duration hold and supports a fresh pointer hold', async () => {
  await open('duration');
  await click('Start');
  await advance(1350);
  const pad = screen.getByRole('button', { name: 'Press and Hold' });
  fireEvent.pointerDown(pad);
  await advance(500);
  fireEvent.pointerCancel(pad);
  fireEvent.pointerUp(pad);
  expect(submitted).toBeUndefined();
  fireEvent.pointerDown(pad);
  await advance(1350);
  await act(async () => {
    fireEvent.pointerUp(pad);
  });
  expect(submitted).toEqual({ durationMs: 1350 });
});

it('supports keyboard beat taps, ignores repeats and double taps, and submits once', async () => {
  await open('beat');
  await click('Start');
  await advance(3150);
  const pad = screen.getByRole('button', { name: 'Continue the Beat' });
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      fireEvent.keyDown(pad, { key: 'Enter' });
      fireEvent.keyDown(pad, { key: 'Enter', repeat: true });
      fireEvent.pointerDown(pad);
    });
    if (i < 3) await advance(650);
  }
  expect(submitted).toEqual({ beatMs: [650, 650, 650, 650] });
  expect(vi.mocked(api).mock.calls.filter(([path]) => path.endsWith('/answer'))).toHaveLength(1);
});
