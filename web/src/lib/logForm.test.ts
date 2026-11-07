import { beforeAll, describe, expect, it } from 'vitest';
import type { Config } from '../../../shared/types';
import { createMockApi } from '../mock/handlers';
import { logDraft, logReceipt, logValues, suggestedTitle } from './logForm';
import { formatFactor } from './format';
import { MODE_FACTORS, ZONE_FACTORS } from '../../../shared/math';
let config: Config;
beforeAll(async () => {
  config = await (
    await createMockApi({ now: () => new Date('2026-11-06T18:00:00Z') }).handle(
      new Request('http://localhost/api/config'),
    )
  ).json();
});
describe('log form math and validation', () => {
  it('builds team-visible payloads without a visibility choice in the draft', () => {
    const draft = { ...logDraft(config.today), distance: '12000' };
    expect(draft).not.toHaveProperty('private');
    expect(logValues(draft, config).input.visibility).toBe('team');
  });
  it('preserves every shared zone factor and exact bike fractions in the receipt', () => {
    for (const [zone, factor] of Object.entries(ZONE_FACTORS)) {
      expect(Number(formatFactor(factor))).toBe(factor);
      expect(
        logReceipt(
          { ...logDraft(config.today), distance: '12000', zone: zone as keyof typeof ZONE_FACTORS },
          config,
        ),
      ).toContain(`Zone ${zone} ${factor} =`);
    }
    const draft = { ...logDraft(config.today), distance: '12000', zone: 'D' as const };
    expect(logReceipt(draft, config)).toBe('12,000 m × Erg 1 × Zone D 1.35 = 16,200 E-meters');
    expect(logReceipt({ ...draft, modality: 'bike', distance: '60000', zone: 'E' }, config)).toBe(
      '60,000 m × Bike 1/3 × Zone E 1 = 20,000 E-meters',
    );
    expect(logReceipt({ ...draft, modality: 'bike', distance: '1000', zone: 'E' }, config)).toBe(
      '1,000 m × Bike 1/3 × Zone E 1 ≈ 333 E-meters',
    );
    for (const [mode, factor] of Object.entries(MODE_FACTORS))
      expect(formatFactor(factor)).toBe(mode === 'bike' ? '1/3' : String(factor));
    for (const factor of [0.3335, 1.23456789]) expect(formatFactor(factor)).toBe(String(factor));
    for (const factor of [NaN, Infinity]) expect(formatFactor(factor)).toBe('—');
  });
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
  it('matches inclusive worker bounds for optional metrics and text', () => {
    const base = { ...logDraft(config.today), distance: '1000' };
    for (const [key, valid, invalid] of [
      ['duration', ['', '1', '86400', '24:00:00'], ['0', '86401', '24:00:01', '1.5', 'bad']],
      ['split', ['', '1:00', '10:00', '1:00.1'], ['0:59.9', '10:00.1', 'bad']],
      ['rate', ['', '10', '60'], ['9', '61', '10.5', 'NaN', 'Infinity']],
      ['hr', ['', '30', '240'], ['29', '241', '30.5', 'NaN', 'Infinity']],
      ['title', ['', 'x'.repeat(120), ' ' + 'x'.repeat(120) + ' '], ['x'.repeat(121)]],
      ['notes', ['', 'x'.repeat(2000)], ['x'.repeat(2001)]],
    ] as const) {
      for (const value of valid)
        expect(
          logValues({ ...base, [key]: value }, config).errors[key],
          `${key}: ${value}`,
        ).toBeUndefined();
      for (const value of invalid)
        expect(
          logValues({ ...base, [key]: value }, config).errors[key],
          `${key}: ${value}`,
        ).toBeTruthy();
    }
    expect(logValues({ ...base, duration: '1' }, config).errors.split).toBeTruthy();
    expect(logValues({ ...base, duration: '86400' }, config).errors.split).toBeTruthy();
  });
  it('accepts distance and date endpoints and enforces unique photo count/ID bounds', () => {
    const base = { ...logDraft(config.today), distance: '1000' };
    for (const distance of ['1', '200000'])
      expect(logValues({ ...base, distance }, config).errors.distance).toBeUndefined();
    for (const date of ['2020-01-01', '2026-11-07'])
      expect(logValues({ ...base, date }, config).errors.date).toBeUndefined();
    for (const date of ['2019-12-31', '2026-11-08', '2026-02-30', 'bad', ''])
      expect(logValues({ ...base, date }, config).errors.date).toBeTruthy();
    const photos = Array.from({ length: 4 }, (_, i) => ({ key: String(i), id: String(i) }));
    expect(logValues(base, config, []).errors.photos).toBeUndefined();
    expect(logValues(base, config, photos).errors.photos).toBeUndefined();
    expect(logValues(base, config, [...photos, { key: '5' }]).errors.photos).toBeTruthy();
    expect(logValues(base, config, [photos[0], photos[0]]).errors.photos).toBeTruthy();
    for (const id of ['', 'x'.repeat(201)])
      expect(logValues(base, config, [{ key: 'photo', id }]).errors.photos).toBeTruthy();
    expect(
      logValues(base, config, [{ key: 'photo', id: 'x'.repeat(200) }]).errors.photos,
    ).toBeUndefined();
  });
});
