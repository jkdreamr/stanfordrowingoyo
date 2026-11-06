import { beforeAll, describe, expect, it } from 'vitest';
import type { Config } from '../../../shared/types';
import { createMockApi } from '../mock/handlers';
import { logDraft, logValues, suggestedTitle } from './logForm';
let config: Config;
beforeAll(async () => {
  config = await (
    await createMockApi({ now: () => new Date('2026-11-06T18:00:00Z') }).handle(
      new Request('http://localhost/api/config'),
    )
  ).json();
});
describe('log form math and validation', () => {
  it('uses a neutral title until a finite positive distance exists', () => {
    for (const distance of ['', '0', '-1', 'bad'])
      expect(suggestedTitle({ ...logDraft(config.today), distance })).toBe('e.g. 3x6k E');
    expect(suggestedTitle({ ...logDraft(config.today), distance: '6000' })).toBe('6,000 m E Erg');
  });
  it('uses configured factors for equivalent preview and derives an erg split', () => {
    const draft = {
      ...logDraft(config.today),
      distance: '12',
      unit: 'km' as const,
      duration: '48:00',
    };
    const values = logValues(draft, {
      ...config,
      mode_factors: { ...config.mode_factors, erg: 2 },
    });
    expect(values.equivalent).toBe(24000);
    expect(values.derivedSplit).toBe(120);
    expect(values.input.avg_split_s).toBe(120);
    expect(values.errors).toEqual({});
  });
  it('accepts a split override and leaves non-erg derived splits empty', () => {
    const draft = {
      ...logDraft(config.today),
      distance: '12000',
      duration: '48:00',
      split: '1:59.5',
    };
    expect(logValues(draft, config).input.avg_split_s).toBe(119.5);
    expect(logValues({ ...draft, modality: 'bike', split: '' }, config).derivedSplit).toBeNull();
  });
  it('rejects empty/out-of-range distance, invalid dates and optional detail values', () => {
    for (const distance of ['', '0', '-1', '200001', '1.5', 'no'])
      expect(
        logValues({ ...logDraft(config.today), distance }, config).errors.distance,
      ).toBeTruthy();
    const result = logValues(
      {
        ...logDraft(config.today),
        distance: '12000',
        date: '2026-02-30',
        duration: '1:99',
        split: 'bad',
        rate: '0',
        hr: '-2',
      },
      config,
    );
    expect(Object.keys(result.errors)).toEqual(['date', 'duration', 'split', 'rate', 'hr']);
  });
  it('accepts tomorrow but not later, prevents pre-2020 dates, and initializes formulas', () => {
    for (const date of ['2019-12-31', '2026-11-08'])
      expect(
        logValues({ ...logDraft(config.today), distance: '1000', date }, config).errors.date,
      ).toBeTruthy();
    expect(
      logValues({ ...logDraft(config.today), distance: '200000', date: '2026-11-07' }, config)
        .errors,
    ).toEqual({});
    const preset = { ...config.presets[0], distance_m: null };
    expect(logDraft(config.today, undefined, preset).distance).toBe('');
  });
});
