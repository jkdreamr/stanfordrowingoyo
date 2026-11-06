import { describe, expect, it } from 'vitest';
import { createMockApi } from '../mock/handlers';
import type { Config } from '../../../shared/types';
import { daysLeft, finishWeek } from './week';
describe('weekly suggestions', () => {
  it('includes today through Sunday including daylight saving changes', () => {
    expect(daysLeft('2026-11-02', '2026-11-02')).toBe(7);
    expect(daysLeft('2026-11-08', '2026-11-02')).toBe(1);
    expect(daysLeft('2026-11-09', '2026-11-02')).toBe(0);
    expect(daysLeft('2026-03-08', '2026-03-02')).toBe(1);
  });
  it('converts remaining E-meters using config rather than default factors', async () => {
    const mock = createMockApi();
    const config: Config = await (
      await mock.handle(new Request('http://localhost/api/config'))
    ).json();
    config.mode_factors.bike = 0.5;
    config.zone_factors.E = 2;
    expect(finishWeek(40000, 80000, config)).toEqual([
      { modality: 'erg', distance: 20000 },
      { modality: 'bike', distance: 40000 },
      { modality: 'run', distance: 16000 },
    ]);
    expect(finishWeek(90000, 80000, config).every((s) => s.distance === 0)).toBe(true);
    expect(finishWeek(0, 0, config).every((s) => s.distance === 0)).toBe(true);
  });
});
