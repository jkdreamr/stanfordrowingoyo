import { expect, it } from 'vitest';
import { replayDeal } from '../../shared/games/deal';
import {
  dealCandidate,
  DealConstructionError,
  dealProfile,
  dealRound,
  DEAL_GOAL_RANGES,
  DEAL_PAR_SECONDS,
} from '../../worker/src/games/deal/generate';
import { DEAL_SCHEDULE, DEAL_SCHEDULE_START } from '../../worker/src/games/deal/schedule';
import { dealTier, generateSchedule } from './generate';
import { dealSolver } from './solver';
import fixtures from './fixtures.json';

const packed = Buffer.from(DEAL_SCHEDULE, 'base64');
function dateAt(day: number) {
  return new Date(Date.parse(DEAL_SCHEDULE_START) + day * 86400000).toISOString().slice(0, 10);
}
it('proves every scheduled round, range, profile, tier/par and rolling uniqueness', () => {
  expect(DEAL_SCHEDULE_START).toBe('2026-11-09');
  expect(packed.length % 5).toBe(0);
  expect(dateAt(packed.length / 5 - 1) >= '2028-11-15').toBe(true);
  const recent = new Map<string, number>();
  for (let day = 0; day < packed.length / 5; day++)
    for (let round = 0; round < 5; round++) {
      const date = dateAt(day),
        p = dealRound(date, round),
        values = p.cards.map((c) => c.value);
      expect(replayDeal(values, p.solution, p.goal), `${date} R${round}`).toEqual({ ok: true });
      expect(values.length).toBe(dealProfile(date)[round]);
      expect(new Set(p.cards.map((c) => `${c.suit}${c.value}`)).size).toBe(values.length);
      expect(p.goal).toBeGreaterThanOrEqual(DEAL_GOAL_RANGES[round][0]);
      expect(p.goal).toBeLessThanOrEqual(DEAL_GOAL_RANGES[round][1]);
      expect(p.goal).not.toBe(values.reduce((a, b) => a + b, 0));
      expect(p.goal).not.toBe(values.reduce((a, b) => a * b, 1));
      const key = `${values.sort((a, b) => a - b)}:${p.goal}`;
      expect(day - (recent.get(key) ?? -Infinity)).toBeGreaterThan(365);
      recent.set(key, day);
      expect(p.parMs).toBe(
        DEAL_PAR_SECONDS[values.length - 4][packed[day * 5 + round] >> 6] * 1000,
      );
    }
});
it('pins full historical deals', () => {
  for (const fixture of fixtures)
    expect(Array.from({ length: 5 }, (_, r) => dealRound(fixture.date, r))).toEqual(fixture.deals);
});
it('exhaustively rechecks ten fixed dates against committed tiers', () => {
  for (const day of [0, 7, 31, 90, 180, 270, 365, 500, 650, 737])
    for (let round = 0; round < 5; round++) {
      const p = dealRound(dateAt(day), round),
        count = dealSolver(p.cards.map((c) => c.value)).count(p.goal);
      expect(count).toBeGreaterThanOrEqual(2);
      expect(dealTier(p.cards.length, count)).toBe(packed[day * 5 + round] >> 6);
    }
}, 15000);
it('reproduces the first two schedule days cheaply', () => {
  expect(generateSchedule(DEAL_SCHEDULE_START, dateAt(1)).encoded).toBe(
    packed.subarray(0, 10).toString('base64'),
  );
});
it('keeps hands independent of k and validates inputs and fallbacks', () => {
  expect(dealCandidate('2026-11-09', 4, 0).cards).toEqual(dealCandidate('2026-11-09', 4, 63).cards);
  expect(dealRound('2030-01-01', 0)).toMatchObject(dealCandidate('2030-01-01', 0, 0));
  expect(dealRound('2020-01-01', 4).parMs).toBe(
    DEAL_PAR_SECONDS[dealProfile('2020-01-01')[4] - 4][1] * 1000,
  );
  for (const date of ['bad', '2026-02-30'])
    expect(() => dealProfile(date)).toThrow('Invalid Deal schedule date');
  expect(() => dealCandidate('2026-11-09', 5, 0)).toThrow();
  expect(() => dealCandidate('2026-11-09', 0, 64)).toThrow();
  expect(() => dealCandidate('2027-01-23', 4, 10)).toThrow(DealConstructionError);
});
