import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';

export function zipText(buffer, suffix) {
  for (let i = 0; i < buffer.length - 46; i++) {
    if (buffer.readUInt32LE(i) !== 0x02014b50) continue;
    const nameLength = buffer.readUInt16LE(i + 28);
    const name = buffer.toString('utf8', i + 46, i + 46 + nameLength);
    if (!name.endsWith('/' + suffix)) continue;
    const method = buffer.readUInt16LE(i + 10);
    const size = buffer.readUInt32LE(i + 20);
    const offset = buffer.readUInt32LE(i + 42);
    assert.equal(buffer.readUInt32LE(offset), 0x04034b50);
    const start = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
    assert(method === 0 || method === 8, 'Unsupported ZIP compression');
    const data = buffer.subarray(start, start + size);
    return (method === 8 ? inflateRawSync(data) : data).toString('utf8');
  }
  throw new Error(`Missing ZIP entry ${suffix}`);
}

export function* csvRows(text) {
  let row = [],
    field = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(field.replace(/\r$/, ''));
      field = '';
      if (c === '\n') {
        yield row;
        row = [];
      }
    } else field += c;
  }
  assert(!quoted, 'Unterminated CSV quote');
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    yield row;
  }
}

export function usdaRecords(buffer) {
  const foods = new Map();
  for (const row of csvRows(zipText(buffer, 'food.csv'))) {
    if (row[1] === 'sr_legacy_food') foods.set(row[0], row[2]);
  }
  const records = [];
  for (const row of csvRows(zipText(buffer, 'food_nutrient.csv'))) {
    if (row[2] === '1008' && foods.has(row[1]))
      records.push({ key: row[1], name: foods.get(row[1]), value: Number(row[3]) });
  }
  assert(records.length > 7000, 'Incomplete USDA SR Legacy energy table');
  return records;
}
