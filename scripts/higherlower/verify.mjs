import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { argv } from 'node:process';
import process from 'node:process';
import console from 'node:console';
import { fileURLToPath, URL } from 'node:url';
import { Buffer } from 'node:buffer';
import { usdaRecords } from './usda.mjs';

const agent = 'Stanford-OYO-HigherLower/1.0 (educational fact verification; pinned public tables)';
export const clean = (html) =>
  html
    .replace(/<(sup|style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) =>
      String.fromCodePoint(n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n)),
    )
    .replace(
      /&(amp|nbsp|quot|apos|lt|gt|ndash|mdash);/g,
      (_, k) =>
        ({ amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>', ndash: '–', mdash: '—' })[
          k
        ],
    )
    .replace(/\s+/g, ' ')
    .trim();
export function tables(html) {
  return [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(([table]) =>
    [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(([, row]) =>
      [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(([, cell]) => clean(cell)),
    ),
  );
}
export async function fetchText(url) {
  const response = await globalThis.fetch(url, { headers: { 'User-Agent': agent } });
  assert(response.ok, `${response.status} fetching ${url}`);
  return response.text();
}
export const numeric = (s) => {
  const match = s.replaceAll(',', '').match(/^\s*(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : NaN;
};
export async function fetchRecords(spec) {
  if (spec.kind === 'solar') {
    const records = [];
    for (const source of spec.sources) {
      const rows = await fetchRecords(source);
      records.push(...recordsFromTable(rows, source));
    }
    return records.filter((record) => spec.names.includes(record.name));
  }
  if (spec.kind === 'usda') {
    const response = await globalThis.fetch(spec.url, { headers: { 'User-Agent': agent } });
    assert(response.ok, `${response.status} fetching ${spec.url}`);
    return usdaRecords(Buffer.from(await response.arrayBuffer()));
  }
  const raw = await fetchText(spec.url);
  if (spec.kind === 'census-csv') {
    const lines = raw
      .trim()
      .split(/\r?\n/)
      .map((line) =>
        [...line.matchAll(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)].map((m) =>
          m[1].replace(/^"|"$/g, '').replaceAll('""', '"'),
        ),
      );
    assert.deepEqual(lines[0].slice(0, 4), [
      'Name',
      'Geography Type',
      'Year',
      'Resident Population',
    ]);
    return lines
      .slice(1)
      .filter((r) => r[1] === 'State' && r[2] === '2020')
      .map((r) => ({ key: r[0], name: r[0], value: numeric(r[3]) }));
  }
  if (spec.kind === 'worldbank') {
    const [meta, rows] = JSON.parse(raw);
    assert.equal(meta.pages, 1, 'World Bank response must include every page');
    assert(rows.every((r) => r.date === String(spec.year)));
    return rows
      .filter((r) => r.value !== null)
      .map((r) => ({ key: r.countryiso3code, name: r.country.value, value: r.value }));
  }
  if (spec.kind === 'density') {
    const text = JSON.parse(raw).parse.wikitext['*'].split(
      /^==\s*Density,\s*liquid phase\s*==/m,
    )[0];
    return [
      ...text.matchAll(
        /! colspan="2"[^\n]*\|<!--[^>]+-->\s*\d+\s+[A-Za-z]+\s+([^\n]+)([\s\S]*?)(?=\n! colspan|$)/g,
      ),
    ].flatMap(([, heading, block]) => {
      const crc = block.match(/\|CRC\s*\|\|\(near r\.t\.\)\s*([\d.]+)\s*g\/cm/);
      if (!crc || heading.includes('?')) return [];
      const key = clean(heading.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1'));
      return [
        {
          key: key[0].toUpperCase() + key.slice(1),
          name: key[0].toUpperCase() + key.slice(1),
          value: Number(crc[1]),
        },
      ];
    });
  }
  const html = spec.kind === 'wiki' ? JSON.parse(raw).parse.text['*'] : raw;
  const ts = tables(html);
  const selected = ts.filter((t) => t.slice(0, 4).flat().join(' ').includes(spec.header));
  assert(selected.length, `Missing table header ${spec.header}`);
  return spec.allTables ? selected.flat() : selected[spec.tableIndex ?? 0];
}
export function recordsFromTable(rows, spec) {
  return rows
    .filter(
      (r) =>
        r.length >= spec.columns &&
        Number.isFinite(
          numeric(
            spec.currency
              ? (r[spec.valueColumn] ?? '').replace(/^\$/, '')
              : (r[spec.valueColumn] ?? ''),
          ),
        ),
    )
    .map((r) => ({
      key: r[spec.nameColumn],
      name: r[spec.nameColumn],
      detail: spec.detailColumn === undefined ? null : r[spec.detailColumn],
      value:
        numeric(spec.currency ? r[spec.valueColumn].replace(/^\$/, '') : r[spec.valueColumn]) *
        (spec.multiplier ?? 1),
      cells: r,
    }));
}
export async function verify() {
  const bank = JSON.parse(await readFile(new URL('./facts.json', import.meta.url), 'utf8'));
  const selected = argv.includes('--categories')
    ? argv[argv.indexOf('--categories') + 1]?.split(',')
    : null;
  const categories = selected
    ? bank.categories.filter((c) => selected.includes(c.id))
    : bank.categories;
  assert(
    categories.length && (!selected || selected.length === categories.length),
    'Unknown or empty category selection',
  );
  const specs = JSON.parse(await readFile(new URL('./sources.json', import.meta.url), 'utf8'));
  let failures = 0,
    total = 0;
  console.log('Category | Facts | Result | Mismatches');
  for (const c of categories) {
    const spec = specs[c.id];
    try {
      const fetched = await fetchRecords(spec);
      const records = ['worldbank', 'census-csv', 'density', 'usda', 'solar'].includes(spec.kind)
        ? fetched
        : recordsFromTable(fetched, spec);
      const mismatches = [];
      for (const f of c.facts) {
        const mapping = spec.keys?.[f.name] ?? f.name;
        const matches = records.filter(
          (r) => r.key === mapping && (!spec.matchDetail || r.detail === f.detail),
        );
        const expected = matches.length === 1 ? matches[0].value : NaN;
        const rounded =
          spec.scale === undefined ? expected : Math.round(expected * spec.scale) / spec.scale;
        if (!Number.isFinite(expected) || rounded !== f.value)
          mismatches.push(
            `${f.name}: stored=${f.value}, source=${expected}, matches=${matches.length}`,
          );
      }
      total += c.facts.length;
      failures += mismatches.length;
      console.log(
        `${c.id} | ${c.facts.length} | ${mismatches.length ? 'FAIL' : 'PASS'} | ${mismatches.join('; ') || '0'}`,
      );
    } catch (e) {
      failures++;
      console.log(`${c.id} | ${c.facts.length} | ERROR | ${e.message}`);
    }
  }
  console.log(
    `${categories.length} categories, ${total} facts compared, ${failures} mismatches/errors.`,
  );
  if (failures) process.exitCode = 1;
}
if (argv[1] === fileURLToPath(import.meta.url)) await verify();
