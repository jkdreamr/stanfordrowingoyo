// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../../lib/api';
import { PerceptionPlay } from './PerceptionPlay';
import { PERCEPTION_EXPOSURE, type PerceptionRoundId } from '../../../../shared/games/perceptionV2';
import type { PerceptionStimulus } from '../../../../shared/types';

vi.mock('../../lib/api', () => ({ api: vi.fn() }));
const DATE = '2026-11-11';
const stimuli: Record<string, PerceptionStimulus> = {
  angle: { angle: 64, rotation: 28 },
  length: { length: 620 },
  count: {
    countDots: [
      [100, 100],
      [300, 300],
      [500, 500],
    ],
  },
  span: { digits: '804267193' },
  shade: { shade: 43, shadeBackgrounds: [10, 90] },
  bisect: {
    endpoints: [
      [140, 240],
      [820, 760],
    ],
  },
  contact: {
    contact: {
      visibleMs: 1200,
      hiddenMs: 1800,
      from: [100, 500],
      occlusion: [420, 500],
      finish: [900, 500],
    },
  },
};
const titles = {
  angle: 'Angle Copy',
  length: 'Length Match',
  count: 'Quick Count',
  span: 'Digit Span',
  shade: 'Shade Match',
  bisect: 'Line Midpoint',
  contact: 'Hidden Motion',
};
let active: PerceptionRoundId;
let submitted: unknown;
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
  submitted = undefined;
  vi.stubGlobal('PointerEvent', MouseEvent);
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

it.each(Object.keys(stimuli) as (keyof typeof titles)[])(
  'plays %s from its server stimulus and submits its field',
  async (id) => {
    active = id;
    await act(async () => {
      render(<PerceptionPlay date={DATE} onComplete={() => {}} />);
    });
    expect(screen.getByRole('heading', { name: titles[id] })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lock In' })).toBeNull();
    await click('Start');
    expect(api).toHaveBeenCalledWith('POST /api/games/perception/start', { body: { round: 0 } });
    const exposure =
      id === 'span'
        ? 9 * PERCEPTION_EXPOSURE.span
        : id === 'contact'
          ? 1200
          : id === 'bisect'
            ? 0
            : PERCEPTION_EXPOSURE[id];
    if (exposure) {
      expect(screen.queryByRole('button', { name: 'Lock In' })).toBeNull();
      if (id === 'span') {
        expect(screen.getByText('8')).toBeTruthy();
        await advance(450);
        expect(screen.getByText('0')).toBeTruthy();
        await advance(exposure - 451);
      } else await advance(exposure - 1);
      expect(submitted).toBeUndefined();
      expect(
        screen.queryByRole('button', { name: id === 'contact' ? 'Tap at Finish' : 'Lock In' }),
      ).toBeNull();
      await advance(1);
    }
    if (id === 'angle' || id === 'length' || id === 'shade') {
      const slider = screen.getByRole('slider');
      fireEvent.pointerDown(slider, { pointerId: 1, clientX: 140, clientY: 10 });
      fireEvent.change(slider, {
        target: { value: id === 'angle' ? '64' : id === 'length' ? '620' : '43' },
      });
      fireEvent.keyDown(slider, { key: 'ArrowRight' });
      expect(slider.getAttribute('aria-valuenow')).toBe(
        id === 'angle' ? '65' : id === 'length' ? '621' : '44',
      );
    } else if (id === 'count' || id === 'span') {
      for (const digit of id === 'count' ? '48' : '804267193') await click(digit);
      await click('Delete');
      await click(id === 'count' ? '8' : '3');
    } else if (id === 'bisect') {
      const board = screen.getByRole('button', { name: 'Midpoint Position' });
      board.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
      fireEvent.pointerDown(board, { clientX: 48, clientY: 50, pointerId: 1 });
      fireEvent.keyDown(board, { key: 'ArrowRight' });
    } else await advance(1800);
    await click(id === 'contact' ? 'Tap at Finish' : 'Lock In');
    const expected = {
      angle: { angle: 65 },
      length: { length: 621 },
      shade: { shade: 44 },
      count: { count: 48 },
      span: { digits: '804267193' },
      bisect: { bisect: [490, 500] },
      contact: { contactMs: 1800 },
    };
    expect(submitted).toEqual(expected[id]);
    expect(screen.getByText('61')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();
  },
);

it('does not expose a new stimulus before start resolves', async () => {
  active = 'angle';
  await act(async () => {
    render(<PerceptionPlay date={DATE} onComplete={() => {}} />);
  });
  let resolve!: (value: never) => void;
  vi.mocked(api).mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  await click('Start');
  expect(screen.queryByRole('img', { name: 'Target Angle' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Start' }).closest('fieldset')?.disabled).toBe(true);
  await act(async () => {
    resolve({ ...view(), stimulus: stimuli.angle } as never);
  });
  expect(screen.getByRole('img', { name: 'Target Angle' })).toBeTruthy();
});

it.each(['count', 'span'] as const)(
  'keeps %s submission disabled for empty answers',
  async (id) => {
    active = id;
    await act(async () => {
      render(<PerceptionPlay date={DATE} onComplete={() => {}} />);
    });
    await click('Start');
    await advance(id === 'count' ? 600 : 4050);
    expect((screen.getByRole('button', { name: 'Lock In' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    if (id === 'count') {
      for (const digit of '999') await click(digit);
      expect((screen.getByRole('button', { name: 'Lock In' }) as HTMLButtonElement).disabled).toBe(
        true,
      );
    } else await click('8');
    await click('Clear');
    expect(screen.getByLabelText(id === 'count' ? 'Count' : 'Digits').textContent).toBe(
      id === 'count' ? 'Your Count' : 'Your Sequence',
    );
  },
);

it('keeps the brief retryable after a failed start without showing its stimulus', async () => {
  active = 'shade';
  await act(async () => {
    render(<PerceptionPlay date={DATE} onComplete={() => {}} />);
  });
  vi.mocked(api).mockRejectedValueOnce(new Error('Could Not Start Round'));
  await click('Start');
  expect(screen.getByRole('alert').textContent).toBe('Could Not Start Round');
  expect(screen.queryByRole('img', { name: 'Target Shade' })).toBeNull();
  await click('Start');
  expect(screen.getByRole('img', { name: 'Target Shade' })).toBeTruthy();
});
