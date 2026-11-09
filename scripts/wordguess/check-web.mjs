import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import console from 'node:console';

const bank = await readFile(
  new URL('../../worker/src/games/wordGuessAnswers.ts', import.meta.url),
  'utf8',
);
const packed = bank.match(/['"]([a-z]{50,})['"]/)?.[1];
assert(packed, 'Could not identify the Worker answer bank');
const signature = packed.slice(0, 75);
const expansion = await readFile(
  new URL('../../worker/src/games/wordGuessExpansion.ts', import.meta.url),
  'utf8',
);
const expandedPacked = expansion.match(/['"]([a-z]{50,})['"]/)?.[1];
assert(expandedPacked, 'Could not identify the Worker expansion answer bank');
const words = ['jazzy', 'cello', 'zebra', 'vivid', 'bacon', 'patio'];
const extra = await readFile(
  new URL('../../shared/games/wordGuessGuesses.ts', import.meta.url),
  'utf8',
);
for (const word of words) {
  assert(bank.includes(word), `${word} must be an answer-bank word`);
  assert(!extra.includes(word), `${word} must not occur in the public guess dictionary`);
}
const dir = new URL('../../web/dist/assets/', import.meta.url);
const names = (await readdir(dir)).filter((name) => /\.(js|css|map)$/.test(name));
assert(names.length, 'Build the web assets first');
for (const name of names) {
  const source = await readFile(new URL(name, dir), 'utf8');
  assert(!source.includes(signature), `Word Guess answer bank leaked into ${name}`);
  assert(!source.includes(expandedPacked.slice(0, 75)), `Word Guess expansion leaked into ${name}`);
  assert(!source.includes('wordGuessAnswers'), `Word Guess answer module leaked into ${name}`);
  assert(!source.includes('wordGuessExpansion'), `Word Guess expansion module leaked into ${name}`);
  for (const word of words)
    assert(!source.toLowerCase().includes(word), `Worker answer ${word} leaked into ${name}`);
}
console.log(
  `PASS: ${names.length} built web assets exclude ${words.length} Worker-only Word Guess words and both answer-bank signatures.`,
);
