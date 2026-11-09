import { dailyRandom } from '../../../../shared/games/daily.ts';
import {
  applyDealOp,
  type DealCard,
  type DealOp,
  type DealStep,
} from '../../../../shared/games/deal.ts';
import { DEAL_SCHEDULE_START, DEAL_SCHEDULE } from './schedule.ts';

export const DEAL_GOAL_RANGES = [
  [10, 99],
  [25, 300],
  [100, 999],
  [250, 4999],
  [1000, 9999],
] as const;
// Seconds by hand size, then tier (0 easiest, 3 hardest).
export const DEAL_PAR_SECONDS = [
  [20, 30, 45, 60],
  [30, 45, 65, 90],
  [45, 65, 90, 120],
  [65, 90, 125, 165],
  [90, 120, 160, 210],
] as const;
function validDate(date: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw new Error('Invalid Deal schedule date');
}
export function dealProfile(date: string): number[] {
  validDate(date);
  const rand = dailyRandom('deal:profile', date);
  return [
    4,
    4 + Math.floor(rand() * 2),
    5 + Math.floor(rand() * 2),
    6 + Math.floor(rand() * 2),
    7 + Math.floor(rand() * 2),
  ];
}
export class DealConstructionError extends Error {}
const DECK: DealCard[] = (['S', 'H', 'D', 'C'] as const).flatMap((suit) =>
  Array.from({ length: 13 }, (_, i) => ({ suit, value: i + 1 })),
);
const EASY_OPS: DealOp[] = ['+', '-', '*', '/'];
const HARD_OPS: DealOp[] = ['*', '*', '*', '/', '/', '+', '+', '-'];
function hand(date: string, round: number, n: number, attempt: number) {
  const shuffle = dailyRandom(`deal:hand:${round}:${attempt}`, date);
  const deck = DECK.slice();
  for (let i = 51; i > 0; i--) {
    const j = Math.floor(shuffle() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.slice(0, n).map((card) => ({ ...card }));
}
function construct(date: string, round: number, k: number, handAttempt: number, cards: DealCard[]) {
  const n = cards.length,
    rand = dailyRandom(`deal:tree:${round}:${handAttempt}:${k}`, date);
  const [min, max] = DEAL_GOAL_RANGES[round];
  for (let attempt = 0; attempt < 24; attempt++) {
    const live = cards.map((c, id) => ({ value: c.value, id })),
      solution: DealStep[] = [];
    while (live.length > 1) {
      const a = live.splice(Math.floor(rand() * live.length), 1)[0],
        b = live.splice(Math.floor(rand() * live.length), 1)[0];
      const ops = round > 1 ? HARD_OPS : EASY_OPS;
      const legal = ops.filter((op) => applyDealOp(a.value, op, b.value) !== null);
      const op = legal[Math.floor(rand() * legal.length)],
        value = applyDealOp(a.value, op, b.value)!;
      solution.push({ a: a.id, op, b: b.id });
      live.push({ value, id: n + solution.length - 1 });
    }
    const goal = live[0].value;
    if (goal >= min && goal <= max) return { cards, goal, solution };
  }
  return null;
}
export function dealCandidate(date: string, round: number, k: number) {
  if (!Number.isInteger(round) || round < 0 || round > 4 || !Number.isInteger(k) || k < 0 || k > 63)
    throw new Error('Invalid Deal candidate');
  const n = dealProfile(date)[round];
  for (let attempt = 0; attempt < 128; attempt++) {
    const cards = hand(date, round, n, attempt),
      first = construct(date, round, 0, attempt, cards);
    if (!first) continue;
    const result = k === 0 ? first : construct(date, round, k, attempt, cards);
    if (result) return result;
    throw new DealConstructionError(`Deal construction exhausted: ${date} ${round} ${k}`);
  }
  throw new Error(`Deal hand selection exhausted: ${date} ${round}`);
}
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function scheduledByte(index: number) {
  const offset = Math.floor(index / 3) * 4;
  const part = index % 3;
  const a = BASE64.indexOf(DEAL_SCHEDULE[offset + part]);
  const b = BASE64.indexOf(DEAL_SCHEDULE[offset + part + 1]);
  return part === 0
    ? (a << 2) | (b >> 4)
    : part === 1
      ? ((a << 4) | (b >> 2)) & 255
      : ((a << 6) | b) & 255;
}
export function dealRound(date: string, round: number) {
  validDate(date);
  const day = Math.round((Date.parse(date) - Date.parse(DEAL_SCHEDULE_START)) / 86400000);
  const length =
    (DEAL_SCHEDULE.length * 3) / 4 -
    (DEAL_SCHEDULE.endsWith('==') ? 2 : DEAL_SCHEDULE.endsWith('=') ? 1 : 0);
  const packed = day >= 0 && day * 5 + round < length ? scheduledByte(day * 5 + round) : 64;
  const tier = packed >> 6,
    candidate = dealCandidate(date, round, packed & 63);
  return { ...candidate, parMs: DEAL_PAR_SECONDS[candidate.cards.length - 4][tier] * 1000 };
}
