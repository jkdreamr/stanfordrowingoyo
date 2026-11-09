import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { argv } from 'node:process';
import { addDays } from '../../shared/dates.ts';
import { CHAIN_LENGTH, HIGHERLOWER_UNITS } from '../../shared/games/higherlower.ts';
import { constructChain } from '../../worker/src/games/higherlower/chain.ts';

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export const START = '2026-11-02';
export function validateFacts(categories) {
  assert(categories.length >= 2 && categories.length <= 64);
  const ids = new Set();
  for (const c of categories) {
    assert(/^[a-z]+(?:-[a-z]+)*$/.test(c.id) && !ids.has(c.id));
    ids.add(c.id);
    assert(c.question && c.higherLabel && c.lowerLabel && HIGHERLOWER_UNITS.includes(c.unit));
    assert(c.asOf === null || Number.isInteger(c.asOf));
    assert(c.facts.length >= CHAIN_LENGTH && c.facts.length <= 64);
    const names = new Set();
    for (const f of c.facts) {
      assert(typeof f.name === 'string' && f.name && !/[|~\n]/.test(f.name) && !names.has(f.name));
      names.add(f.name);
      assert(!f.detail || (f.detail.length <= 100 && !/[|~\n]/.test(f.detail)));
      assert(Number.isFinite(f.value) && f.value > 0);
      assert(
        f.surprise === undefined ||
          typeof f.surprise === 'boolean' ||
          (Number.isFinite(f.surprise) && f.surprise >= 0 && f.surprise <= 10),
      );
      assert(typeof (f.source ?? c.source) === 'string' && (f.source ?? c.source).trim());
      assert(f.asOf === undefined || f.asOf === null || Number.isInteger(f.asOf));
      if (c.asOf !== null) assert(Number.isInteger(f.asOf ?? c.asOf));
    }
  }
}
export function validChain(facts) {
  if (facts.length !== CHAIN_LENGTH || new Set(facts.map((f) => f.name)).size !== CHAIN_LENGTH)
    return false;
  let higher = 0,
    close = 0,
    run = 0,
    last;
  for (let i = 1; i < facts.length; i++) {
    const a = facts[i - 1].value,
      b = facts[i].value;
    if (Math.abs(a - b) / Math.min(a, b) < 0.1) return false;
    const ratio = Math.max(a, b) / Math.min(a, b);
    if (ratio > 3) return false;
    if (ratio <= 1.4) close++;
    const up = b > a;
    higher += Number(up);
    run = up === last ? run + 1 : 1;
    if (run > 4) return false;
    last = up;
  }
  const rank = facts.filter((f) => f.value < facts[0].value).length;
  return higher >= 7 && higher <= 13 && close >= 14 && rank >= 4 && rank <= 16;
}
const key = (day, sorted = false) =>
  JSON.stringify([day.category, sorted ? [...day.facts].sort() : day.facts]);
export function validateSchedule(categories, schedule) {
  const sets = new Set(),
    orders = new Set();
  for (const [i, d] of schedule.entries()) {
    assert.equal(d.date, addDays(START, i));
    const category = categories.find((c) => c.id === d.category);
    assert(category, 'Unknown category');
    const facts = d.facts.map((name) => category.facts.find((f) => f.name === name));
    assert(facts.every(Boolean) && validChain(facts), `Invalid chain on ${d.date}`);
    assert(
      Number.isInteger(d.poolSize) &&
        d.poolSize >= CHAIN_LENGTH &&
        d.poolSize <= category.facts.length,
    );
    assert(Number.isInteger(d.seed) && d.seed >= 0 && d.seed < 2 ** 24);
    assert.deepEqual(
      constructChain(category.facts.slice(0, d.poolSize), d.seed).map((f) => f.name),
      d.facts,
      `Frozen chain changed on ${d.date}`,
    );
    assert(!sets.has(key(d, true)) && !orders.has(key(d)), `Duplicate on ${d.date}`);
    assert(i === 0 || schedule[i - 1].category !== d.category);
    assert(
      i === 0 ||
        !(
          /^(country|state)-/.test(d.category) && /^(country|state)-/.test(schedule[i - 1].category)
        ),
    );
    sets.add(key(d, true));
    orders.add(key(d));
  }
}
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function extend(categories, previous, count) {
  validateFacts(categories);
  validateSchedule(categories, previous);
  const schedule = [...previous],
    used = new Set(previous.map((d) => key(d, true)));
  for (let n = 0; n < count; n++) {
    const index = schedule.length,
      rng = random(0x484c2026 + index);
    const counts = categories.map((c) => schedule.filter((d) => d.category === c.id).length);
    const candidates = categories
      .map((c, i) => ({ c, count: counts[i], tie: rng() }))
      .filter(
        ({ c }) =>
          c.id !== schedule.at(-1)?.category &&
          !(
            /^(country|state)-/.test(c.id) &&
            /^(country|state)-/.test(schedule.at(-1)?.category ?? '')
          ),
      )
      .sort((a, b) => a.count - b.count || a.tie - b.tie);
    let day;
    for (const { c } of candidates) {
      for (let attempt = 0; attempt < 100000; attempt++) {
        const seed = attempt;
        const chain = constructChain(c.facts, seed);
        const candidate = {
          date: addDays(START, index),
          category: c.id,
          poolSize: c.facts.length,
          seed,
          facts: chain.map((f) => f.name),
        };
        if (validChain(chain) && !used.has(key(candidate, true))) {
          day = candidate;
          break;
        }
      }
      if (day) break;
    }
    assert(day, 'Pool exhausted; add facts before extending');
    used.add(key(day, true));
    schedule.push(day);
  }
  validateSchedule(categories, schedule);
  return schedule;
}
export function render(categories, schedule) {
  validateFacts(categories);
  validateSchedule(categories, schedule);
  const packed = categories.map((c) => [
    c.id,
    c.question,
    c.higherLabel,
    c.lowerLabel,
    c.unit,
    c.asOf,
    c.facts
      .map(
        (f) =>
          `${f.name}|${f.detail ?? ''}|${f.value}${f.surprise || f.asOf !== undefined ? '|' + Number(f.surprise ?? 0) : ''}${f.asOf !== undefined ? '|' + (f.asOf ?? '') : ''}`,
      )
      .join('~'),
    c.asOfLabel ?? null,
  ]);
  const days = schedule
    .map((d) => {
      const i = categories.findIndex((c) => c.id === d.category);
      return (
        ALPHABET[i] +
        ALPHABET[d.poolSize - 1] +
        [18, 12, 6, 0].map((shift) => ALPHABET[(d.seed >>> shift) & 63]).join('')
      );
    })
    .join('');
  return `// Generated by scripts/higherlower/generate.mjs. Do not edit.\n// higherlower-private-bank-v1\nexport const HIGHERLOWER_START = '${START}';\n// prettier-ignore\nexport const HIGHERLOWER_CATEGORIES = ${JSON.stringify(packed)} as const;\nexport const HIGHERLOWER_SCHEDULE =\n  '${days}';\n`;
}
export async function generate(args) {
  const root = new URL('./', import.meta.url);
  const { categories } = JSON.parse(await readFile(new URL('facts.json', root), 'utf8'));
  let schedule = [];
  if (!args.includes('--reset')) {
    try {
      schedule = JSON.parse(await readFile(new URL('schedule.json', root), 'utf8'));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  const pos = args.indexOf('--extend');
  const count = pos < 0 ? 0 : Number(args[pos + 1]);
  assert(Number.isInteger(count) && count >= 0);
  schedule = extend(categories, schedule, count);
  assert(schedule.length, 'Use --extend N to create the schedule');
  await writeFile(new URL('schedule.json', root), JSON.stringify(schedule, null, 2) + '\n');
  await writeFile(
    new URL('../../worker/src/games/higherlower/data.ts', root),
    render(categories, schedule),
  );
}
if (argv[1] === fileURLToPath(import.meta.url)) await generate(argv.slice(2));
