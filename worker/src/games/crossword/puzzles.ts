import { crosswordSlots } from '../../../../shared/games/crossword';
import type { Env } from '../../index';
import { CROSSWORD_DATA } from './data';

export interface CrosswordPuzzle {
  solution: string[];
  blocks: number[];
  clues: (ReturnType<typeof crosswordSlots>[number] & { text: string })[];
}
let cached: Promise<CrosswordPuzzle[]> | undefined;
export function loadCrossword(env: Pick<Env, 'ASSETS'>): Promise<CrosswordPuzzle[]> {
  return (cached ??= decode(env).catch((error) => {
    cached = undefined;
    throw error;
  }));
}
async function decode(env: Pick<Env, 'ASSETS'>): Promise<CrosswordPuzzle[]> {
  const response = await env.ASSETS.fetch('https://oyo.internal/games/crossword.dat');
  if (!response.ok) throw new Error('Crossword asset unavailable');
  const bytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', bytes(CROSSWORD_DATA.key), 'AES-GCM', false, [
    'decrypt',
  ]);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes(CROSSWORD_DATA.iv) },
    key,
    await response.arrayBuffer(),
  );
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', plain))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (hash !== CROSSWORD_DATA.sha256) throw new Error('Crossword integrity failure');
  const [signature, ...records] = JSON.parse(new TextDecoder().decode(plain)) as [
    string,
    ...string[][],
  ];
  if (signature !== 'oyo-crossword-v1' || records.length !== CROSSWORD_DATA.count)
    throw new Error('Invalid crossword payload');
  return records.map(([grid, ...texts]) => {
    const blocks = [...grid].flatMap((c, i) => (c === '#' ? [i] : []));
    const slots = crosswordSlots(blocks).sort(
      (a, b) => a.dir.localeCompare(b.dir) || a.number - b.number,
    );
    return {
      blocks,
      solution: [...grid].map((c) => (c === '#' ? '' : c)),
      clues: slots.map((s, i) => ({ ...s, text: texts[i] })),
    };
  });
}
export function crosswordFor(puzzles: CrosswordPuzzle[], date: string): CrosswordPuzzle | null {
  const index = Math.round((Date.parse(date) - Date.parse(CROSSWORD_DATA.start)) / 86400000);
  return index < 0 ? null : puzzles[index % puzzles.length];
}
