import { afterEach, expect, it, vi } from 'vitest';
import { Buffer } from 'node:buffer';
import { deflateRawSync } from 'node:zlib';
import { clean, fetchRecords, numeric, recordsFromTable, tables } from './verify.mjs';
import { csvRows, zipText, usdaRecords } from './usda.mjs';

afterEach(() => vi.unstubAllGlobals());
it('combines planetary and satellite radii, curates the selection, and propagates source failures', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const spec = {
    kind: 'solar',
    names: ['Earth', 'Moon'],
    sources: [
      {
        kind: 'html',
        url: 'https://example.org/planets',
        header: 'Name Radius',
        columns: 2,
        nameColumn: 0,
        valueColumn: 1,
        multiplier: 2,
      },
      {
        kind: 'html',
        url: 'https://example.org/moons',
        header: 'Name Radius',
        columns: 2,
        nameColumn: 0,
        valueColumn: 1,
        multiplier: 2,
      },
    ],
  };
  fetch.mockResolvedValueOnce(
    new Response(
      '<table><tr><th>Name</th><th>Radius</th></tr><tr><td>Earth</td><td>6371</td></tr></table>',
    ),
  );
  fetch.mockResolvedValueOnce(
    new Response(
      '<table><tr><th>Name</th><th>Radius</th></tr><tr><td>Moon</td><td>1737.4</td></tr><tr><td>Irregular</td><td>10</td></tr></table>',
    ),
  );
  expect(await fetchRecords(spec)).toMatchObject([
    { name: 'Earth', value: 12742 },
    { name: 'Moon', value: 3474.8 },
  ]);
  expect(await fetchRecords({ ...spec, sources: [] })).toEqual([]);
  fetch.mockResolvedValueOnce(new Response('', { status: 500 }));
  await expect(fetchRecords(spec)).rejects.toThrow('500 fetching');
});

it('parses source cells without citations and keeps duplicate names disambiguated', () => {
  expect(clean('A&nbsp;&amp; B<sup>[1]</sup><br>C')).toBe('A & B C');
  expect(numeric('1,234.5 m (4,050 ft)')).toBe(1234.5);
  expect(numeric('unknown')).toBeNaN();
  const rows = tables(
    '<table><tr><td>Island</td><td>42,149</td><td>Canada</td></tr><tr><td>Island</td><td>5,786</td><td>Australia</td></tr></table>',
  )[0];
  expect(
    recordsFromTable(rows, { columns: 3, nameColumn: 0, valueColumn: 1, detailColumn: 2 }),
  ).toMatchObject([
    { name: 'Island', value: 42149, detail: 'Canada' },
    { name: 'Island', value: 5786, detail: 'Australia' },
  ]);
  expect(tables('')).toEqual([]);
  expect(recordsFromTable([], { columns: 3 })).toEqual([]);
  expect(
    recordsFromTable([['Film', '$1,234', '2009']], {
      columns: 3,
      nameColumn: 0,
      valueColumn: 1,
      currency: true,
    }),
  ).toMatchObject([{ name: 'Film', value: 1234 }]);
  expect(
    recordsFromTable([['Moon', '2.5']], {
      columns: 2,
      nameColumn: 0,
      valueColumn: 1,
      multiplier: 2,
    }),
  ).toMatchObject([{ name: 'Moon', value: 5 }]);
});

it('reads quoted USDA CSV fields and compressed ZIP entries, rejecting missing/incomplete data', () => {
  expect([...csvRows('id,description\r\n1,"Apple, raw"\r\n2,"A ""quoted""\nname"')]).toEqual([
    ['id', 'description'],
    ['1', 'Apple, raw'],
    ['2', 'A "quoted"\nname'],
  ]);
  expect([...csvRows('')]).toEqual([]);
  expect(() => [...csvRows('"unterminated')]).toThrow('Unterminated');
  const name = Buffer.from('release/food.csv');
  const contents = deflateRawSync('id,name\n1,Apple\n');
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(contents.length, 20);
  central.writeUInt16LE(name.length, 28);
  const archive = Buffer.concat([local, name, contents, central, name]);
  expect(zipText(archive, 'food.csv')).toBe('id,name\n1,Apple\n');
  expect(() => zipText(archive, 'missing.csv')).toThrow('Missing ZIP entry');
  expect(() => usdaRecords(archive)).toThrow('food_nutrient.csv');
  expect(() => zipText(Buffer.alloc(0), 'food.csv')).toThrow('Missing ZIP entry');
});

it('rejects unavailable, missing and incomplete source tables', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  fetch.mockResolvedValueOnce(new Response('', { status: 429 }));
  await expect(fetchRecords({ url: 'https://example.org', kind: 'html' })).rejects.toThrow(
    '429 fetching',
  );
  fetch.mockResolvedValueOnce(new Response('<table></table>'));
  await expect(
    fetchRecords({ url: 'https://example.org', kind: 'html', header: 'Missing' }),
  ).rejects.toThrow('Missing table header');
  fetch.mockResolvedValueOnce(new Response(JSON.stringify([{ pages: 2 }, []])));
  await expect(fetchRecords({ url: 'https://example.org', kind: 'worldbank' })).rejects.toThrow(
    'every page',
  );
});

it('retains pinned-year World Bank precision and rejects wrong-year records', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const row = {
    date: '2023',
    countryiso3code: 'USA',
    country: { value: 'United States' },
    value: 1234.567,
  };
  fetch.mockResolvedValueOnce(
    new Response(JSON.stringify([{ pages: 1 }, [row, { ...row, value: null }]])),
  );
  await expect(
    fetchRecords({ url: 'https://example.org', kind: 'worldbank', year: 2023 }),
  ).resolves.toEqual([{ key: 'USA', name: 'United States', value: 1234.567 }]);
  fetch.mockResolvedValueOnce(
    new Response(JSON.stringify([{ pages: 1 }, [{ ...row, date: '2024' }]])),
  );
  await expect(
    fetchRecords({ url: 'https://example.org', kind: 'worldbank', year: 2023 }),
  ).rejects.toThrow();
});
