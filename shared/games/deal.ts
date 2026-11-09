export const DEAL_ID = 'deal';
export const DEAL_ROUNDS = 5;
export const DEAL_SKIP_PENALTY_MS = 60_000;
export const DEAL_ROUND_CAP_MS = 300_000;
export const DEAL_MIN_STEP_MS = 400;
export type DealOp = '+' | '-' | '*' | '/';
export interface DealStep {
  a: number;
  op: DealOp;
  b: number;
}
export interface DealCard {
  value: number;
  suit: 'S' | 'H' | 'D' | 'C';
}
export function dealOpReason(a: number, op: DealOp, b: number): string | null {
  if (!Number.isSafeInteger(a) || a <= 0 || !Number.isSafeInteger(b) || b <= 0) return 'integer';
  if (op === '-' && a <= b) return 'negative';
  if (op === '/' && a % b !== 0) return 'fraction';
  const result =
    op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : op === '/' ? a / b : NaN;
  return Number.isSafeInteger(result) && result > 0 ? null : 'overflow';
}
export function applyDealOp(a: number, op: DealOp, b: number): number | null {
  if (dealOpReason(a, op, b)) return null;
  return op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : a / b;
}
export function replayDeal(
  values: number[],
  steps: unknown,
  goal: number,
): { ok: true } | { ok: false; reason: string } {
  const fail = (reason: string) => ({ ok: false as const, reason });
  if (
    !values.length ||
    !Array.from(values).every((v) => Number.isSafeInteger(v) && v > 0) ||
    !Number.isSafeInteger(goal) ||
    goal <= 0
  )
    return fail('integer');
  if (!Array.isArray(steps) || steps.length !== values.length - 1) return fail('count');
  const live = new Map(values.map((v, i) => [i, v]));
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (
      !s ||
      typeof s !== 'object' ||
      Array.isArray(s) ||
      Object.keys(s).sort().join(',') !== 'a,b,op' ||
      !Number.isSafeInteger(s.a) ||
      !Number.isSafeInteger(s.b) ||
      !['+', '-', '*', '/'].includes(s.op)
    )
      return fail('step');
    if (s.a === s.b || !live.has(s.a) || !live.has(s.b)) return fail('ids');
    const a = live.get(s.a)!,
      b = live.get(s.b)!;
    const result = applyDealOp(a, s.op, b);
    if (result === null) return fail(dealOpReason(a, s.op, b)!);
    live.delete(s.a);
    live.delete(s.b);
    live.set(values.length + i, result);
  }
  return live.values().next().value === goal ? { ok: true } : fail('goal');
}
export function formatDealTime(ms: number): string {
  const tenths = Math.floor(Math.max(0, Number.isFinite(ms) ? ms : 0) / 100);
  return `${Math.floor(tenths / 600)}:${String(Math.floor(tenths / 10) % 60).padStart(2, '0')}.${tenths % 10}`;
}
export function dealShare(
  date: string,
  rounds: readonly { timeMs: number; skipped: boolean; parMs: number }[],
): string {
  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return [
    `Deal ${label}`,
    formatDealTime(rounds.reduce((sum, r) => sum + r.timeMs, 0)),
    ...rounds.map((r) =>
      r.skipped ? '⬛ Skipped' : `${r.timeMs <= r.parMs ? '🟩' : '🟨'} ${formatDealTime(r.timeMs)}`,
    ),
  ].join('\n');
}
