import { describe, expect, it } from 'vitest';
import { applyDealOp, dealOpReason, dealShare, formatDealTime, replayDeal } from './deal';

describe('Deal rules', () => {
  it('allows only positive safe integer results', () => {
    expect(applyDealOp(7, '+', 8)).toBe(15);
    expect(applyDealOp(7, '*', 8)).toBe(56);
    expect(applyDealOp(8, '-', 7)).toBe(1);
    expect(applyDealOp(8, '/', 4)).toBe(2);
    for (const [a, op, b] of [
      [1, '-', 1],
      [1, '-', 2],
      [3, '/', 2],
      [0, '+', 2],
      [1.5, '+', 2],
      [Number.MAX_SAFE_INTEGER, '+', 1],
      [NaN, '*', 2],
    ] as const)
      expect(applyDealOp(a, op, b)).toBeNull();
    expect(dealOpReason(1, '-', 2)).toBe('negative');
    expect(dealOpReason(3, '/', 2)).toBe('fraction');
  });
  it('strictly validates the entire witness and all consumed ids', () => {
    const steps = [
      { a: 0, op: '*', b: 1 },
      { a: 3, op: '+', b: 2 },
    ];
    expect(replayDeal([2, 3, 4], steps, 10)).toEqual({ ok: true });
    for (const input of [
      null,
      [],
      steps.slice(0, 1),
      [...steps, steps[0]],
      [{ ...steps[0], extra: 1 }, steps[1]],
      [{ a: 0, op: '*', b: 0 }, steps[1]],
      [steps[0], { a: 0, op: '+', b: 2 }],
      [{ a: 0.5, op: '*', b: 1 }, steps[1]],
      [{ a: 0, op: '%', b: 1 }, steps[1]],
      [steps[0], { a: 4, op: '+', b: 2 }],
    ])
      expect(replayDeal([2, 3, 4], input, 10).ok).toBe(false);
    expect(replayDeal([2, 3, 4], steps, 11).ok).toBe(false);
    expect(replayDeal([2, 3], [{ a: 0, op: '/', b: 1 }], 1).ok).toBe(false);
    expect(replayDeal([], [], 1).ok).toBe(false);
    expect(replayDeal(new Array<number>(2), [{ a: 0, op: '+', b: 1 }], 2).ok).toBe(false);
    expect(replayDeal([1.5], [], 1.5).ok).toBe(false);
    expect(replayDeal([1], [], 1)).toEqual({ ok: true });
  });
  it('formats truncated tenths', () => {
    expect(formatDealTime(83456)).toBe('1:23.4');
    expect(formatDealTime(59999)).toBe('0:59.9');
    expect(formatDealTime(0)).toBe('0:00.0');
  });
  it('shares UTC dates and outcomes, including empty and exactly-at-par rounds', () => {
    expect(dealShare('2026-11-16', [])).toBe('Deal Nov 16\n0:00.0');
    expect(
      dealShare('2026-11-16', [
        { timeMs: 30000, parMs: 30000, skipped: false },
        { timeMs: 60000, parMs: 30000, skipped: true },
      ]),
    ).toBe('Deal Nov 16\n1:30.0\n🟩 0:30.0\n⬛ Skipped');
  });
});
