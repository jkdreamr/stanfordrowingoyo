import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import countries from './countries.json';
import ids from './shape-ids.json';
import { worldleNames } from '../../shared/games/worldleNames';
import {
  compass8,
  haversineKm,
  initialBearing,
  normalizeCountry,
  proximity,
  resolveCountry,
  TRIES,
  WORLDLE_ID,
} from '../../shared/games/worldle';
import { WORLDLE_SCHEDULE, WORLDLE_START, worldleData } from '../../worker/src/games/worldle/data';

const root = fileURLToPath(new URL('../../web/public/worldle/', import.meta.url));
const schedule = WORLDLE_SCHEDULE.match(/.{2}/g)!.map((value) => parseInt(value, 36));
const n = countries.length;
const tier = (index: number) => countries[index].tier;
const weeks = Array.from({ length: Math.floor(schedule.length / 7) }, (_, i) =>
  schedule.slice(i * 7, i * 7 + 7),
);

describe('Worldle content', () => {
  it('has the complete pool and keeps server-only metadata out of shared names', () => {
    expect(n).toBe(222);
    expect(worldleNames).toHaveLength(n);
    expect(worldleData).toHaveLength(n);
    expect(Object.keys(ids)).toHaveLength(n);
    for (const [i, country] of worldleNames.entries()) {
      expect(Object.keys(country).sort()).toEqual(['aliases', 'name']);
      expect(country.name).toBe(countries[i].name);
      const [lat, lon, id] = worldleData[i];
      expect(Number.isFinite(lat) && lat >= -90 && lat <= 90).toBe(true);
      expect(Number.isFinite(lon) && lon >= -180 && lon <= 180).toBe(true);
      expect(id).toMatch(/^[0-9a-f]{16}$/);
      expect(id).toBe(ids[countries[i].code as keyof typeof ids]);
    }
    expect(new Set(worldleData.map((r) => r[2])).size).toBe(n);
  });

  it('has unambiguous normalized display names and aliases', () => {
    const owners = new Map<string, number>();
    for (const [i, country] of worldleNames.entries()) {
      for (const name of [country.name, ...country.aliases]) {
        const normalized = normalizeCountry(name);
        expect(normalized).not.toBe('');
        expect(owners.get(normalized) ?? i, name).toBe(i);
        owners.set(normalized, i);
        expect(resolveCountry(name)).toBe(i);
      }
    }
    expect(new Set(worldleNames.map((c) => normalizeCountry(c.name))).size).toBe(n);
  });

  it('ships only tiny anonymous, closed, integer-path SVG silhouettes', () => {
    const files = readdirSync(root);
    expect(files.sort()).toEqual([...worldleData.map((r) => r[2] + '.svg'), 'world.svg'].sort());
    for (const [lat, lon, id] of worldleData) {
      expect([lat, lon].every(Number.isFinite)).toBe(true);
      const svg = readFileSync(root + id + '.svg', 'utf8');
      expect(Buffer.byteLength(svg)).toBeLessThanOrEqual(6144);
      const match = svg.match(
        /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 (\d+) (\d+)"><path d="([Mm0-9lhvz -]+)" fill="#000" stroke="#000" stroke-width="[6-9]" stroke-linejoin="round"\/><\/svg>\n$/,
      );
      expect(match, id).not.toBeNull();
      expect(Math.max(Number(match![1]), Number(match![2]))).toBe(1000);
      const tokens = match![3].match(/[Mmlhvz]|-?\d+/g)!;
      let x = 0,
        y = 0,
        cursor = 0,
        islands = 0;
      let xs: number[] = [],
        ys: number[] = [];
      const number = () => {
        expect(tokens[cursor]).toMatch(/^-?\d+$/);
        return Number(tokens[cursor++]);
      };
      while (cursor < tokens.length) {
        const command = tokens[cursor++];
        if (command === 'M' || command === 'm') {
          x = (command === 'm' ? x : 0) + number();
          y = (command === 'm' ? y : 0) + number();
          xs = [x];
          ys = [y];
        } else if (command === 'z') {
          expect(
            Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)),
            id,
          ).toBeGreaterThanOrEqual(25);
          x = xs[0];
          y = ys[0];
          islands++;
        } else {
          expect(['l', 'h', 'v']).toContain(command);
          do {
            if (command !== 'v') x += number();
            if (command !== 'h') y += number();
            xs.push(x);
            ys.push(y);
          } while (cursor < tokens.length && /^-?\d+$/.test(tokens[cursor]));
        }
      }
      expect(islands).toBeGreaterThan(0);
    }
    const world = readFileSync(root + 'world.svg', 'utf8');
    expect(world).toContain('viewBox="0 0 360 180"');
    expect(Buffer.byteLength(world)).toBeLessThanOrEqual(25000);
  });

  it('pins the packed schedule and maps every day to an existing answer', () => {
    expect(WORLDLE_START).toBe('2026-11-16');
    expect(WORLDLE_SCHEDULE).toMatch(/^[0-9a-z]+$/);
    expect(schedule).toHaveLength(3 * n);
    expect(schedule.length).toBeGreaterThanOrEqual(365);
    expect(createHash('sha256').update(WORLDLE_SCHEDULE).digest('hex')).toBe(
      'b01d15d2a9ee57bbe011df435c96d4204d117817ed655b5905d90756b41eb5b2',
    );
    for (const index of schedule) {
      expect(Number.isInteger(index) && index >= 0 && index < n).toBe(true);
      expect(readFileSync(root + worldleData[index][2] + '.svg', 'utf8')).toContain('<svg');
    }
    for (let cycle = 0; cycle < 3; cycle++) {
      expect([...schedule.slice(cycle * n, (cycle + 1) * n)].sort((a, b) => a - b)).toEqual(
        Array.from({ length: n }, (_, i) => i),
      );
    }
    for (let index = 0; index < n; index++) {
      const positions = schedule.flatMap((value, i) => (value === index ? [i] : []));
      positions.push(positions[0] + schedule.length);
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i] - positions[i - 1]).toBeGreaterThanOrEqual(150);
      }
    }
    const at = (day: number) =>
      schedule[((day % schedule.length) + schedule.length) % schedule.length];
    expect(at(-1)).toBe(schedule.at(-1));
    expect(at(schedule.length)).toBe(at(0));
    expect(schedule.slice(0, 7).every((i) => tier(i) !== 3)).toBe(true);
  });

  it('attains the arithmetic optimum for the hard weekly mix', () => {
    expect(new Date(WORLDLE_START + 'T00:00:00Z').getUTCDay()).toBe(1);
    const easy = weeks.map((w) => w.filter((i) => tier(i) === 1).length);
    const hard = weeks.map((w) => w.filter((i) => tier(i) === 3).length);
    expect(Math.max(...easy)).toBe(3);
    expect(Math.max(...hard)).toBe(2);
    expect(easy[0]).toBe(2);
    expect(hard[0]).toBe(0);
    expect(hard.slice(1).every((count) => count >= 1)).toBe(true);
    // 213 easy answers in 95 full weeks + one tail day force 22 excess easy.
    expect(easy.reduce((sum, count) => sum + Math.max(0, count - 2), 0)).toBe(22);
    // Excluding the opening week, 94 weeks need 188 hard answers; only 180 exist.
    expect(hard.slice(1).reduce((sum, count) => sum + Math.max(0, 2 - count), 0)).toBe(8);
  });
});

describe('Worldle shared rules', () => {
  it('normalizes punctuation, diacritics, saint and articles', () => {
    expect(WORLDLE_ID).toBe('worldle');
    expect(TRIES).toBe(6);
    expect(normalizeCountry('  THE  Côte-d’Ivoire (test)., ')).toBe('cote d ivoire test');
    expect(normalizeCountry('St.Lucia & St Kitts')).toBe('saint lucia and saint kitts');
    expect(normalizeCountry('')).toBe('');
    expect(resolveCountry('')).toBeNull();
    expect(resolveCountry('Atlantis')).toBeNull();
    expect(resolveCountry('Persia')).toBeNull();
  });

  it.each([
    ['USA|US|U.S.A.|America|United States of America', 'United States'],
    ['UK|Great Britain|Britain', 'United Kingdom'],
    ['Ivory Coast', "Côte d'Ivoire"],
    ['Czech Republic', 'Czechia'],
    ['DRC|DR Congo|Congo-Kinshasa', 'Democratic Republic of the Congo'],
    ['Congo|Congo-Brazzaville', 'Republic of the Congo'],
    ['Swaziland', 'Eswatini'],
    ['Macedonia', 'North Macedonia'],
    ['Burma', 'Myanmar'],
    ['East Timor', 'Timor-Leste'],
    ['Cape Verde', 'Cabo Verde'],
    ['Türkiye', 'Turkey'],
    ['Holy See|Vatican', 'Vatican City'],
    ['Sao Tome', 'São Tomé and Príncipe'],
    ['Federated States of Micronesia', 'Micronesia'],
    ['The Bahamas', 'Bahamas'],
    ['The Gambia', 'Gambia'],
    ['Korea|Republic of Korea', 'South Korea'],
    ['DPRK', 'North Korea'],
    ['Lao PDR', 'Laos'],
    ['State of Palestine', 'Palestine'],
    ['Russian Federation', 'Russia'],
    ['UAE', 'United Arab Emirates'],
    ['Holland', 'Netherlands'],
    ['Bosnia', 'Bosnia and Herzegovina'],
    ['Trinidad', 'Trinidad and Tobago'],
    ['Antigua', 'Antigua and Barbuda'],
    ['St Kitts|Saint Kitts and Nevis', 'Saint Kitts and Nevis'],
    ['St Lucia', 'Saint Lucia'],
    ['St Vincent', 'Saint Vincent and the Grenadines'],
    ['Falklands|Malvinas', 'Falkland Islands'],
    ['USVI', 'U.S. Virgin Islands'],
    ['BVI', 'British Virgin Islands'],
    ['Faeroe Islands', 'Faroe Islands'],
    ['Brunei Darussalam', 'Brunei'],
    ['Viet Nam', 'Vietnam'],
    ['Kyrgyz Republic', 'Kyrgyzstan'],
  ])('resolves %s', (aliases, expected) => {
    for (const alias of aliases.split('|')) {
      const index = resolveCountry(alias);
      expect(index).not.toBeNull();
      expect(worldleNames[index!].name).toBe(expected);
    }
  });

  it('matches independent city distances and handles coincident/antipodal/dateline points', () => {
    expect(haversineKm(51.5074, -0.1278, 40.7128, -74.006)).toBeCloseTo(5570.22, 0);
    expect(haversineKm(35.6762, 139.6503, -33.8688, 151.2093)).toBeCloseTo(7825.82, 0);
    expect(haversineKm(0, 0, 0, 0)).toBe(0);
    expect(haversineKm(0, 0, 0, 180)).toBeCloseTo(Math.PI * 6371, 6);
    expect(haversineKm(0, 179, 0, -179)).toBeCloseTo(222.39, 1);
  });

  it.each([
    ['France', 'Germany', 600, 1100],
    ['Spain', 'Portugal', 250, 600],
    ['United States', 'Canada', 1400, 2600],
  ])('has plausible %s to %s centroid distance', (a, b, min, max) => {
    const x = worldleData[resolveCountry(a)!];
    const y = worldleData[resolveCountry(b)!];
    const km = haversineKm(x[0], x[1], y[0], y[1]);
    expect(km).toBeGreaterThan(min);
    expect(km).toBeLessThan(max);
  });

  it('computes bearings, all compass sectors and exact proximity flooring', () => {
    expect(initialBearing(0, 0, 1, 0)).toBe(0);
    expect(initialBearing(0, 0, 0, 1)).toBe(90);
    expect(initialBearing(0, 0, -1, 0)).toBe(180);
    expect(initialBearing(0, 0, 0, -1)).toBe(270);
    expect(initialBearing(0, 0, 0, 0)).toBe(0);
    expect(Array.from({ length: 8 }, (_, i) => compass8(i * 45))).toEqual([
      'N',
      'NE',
      'E',
      'SE',
      'S',
      'SW',
      'W',
      'NW',
    ]);
    expect(compass8(22.5)).toBe('NE');
    expect(compass8(337.5)).toBe('N');
    expect(compass8(-45)).toBe('NW');
    expect(proximity(0)).toBe(100);
    expect(proximity(1)).toBe(99);
    expect(proximity(10000)).toBe(50);
    expect(proximity(20000)).toBe(0);
    expect(proximity(21000)).toBe(0);
  });
});
