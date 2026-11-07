import type { ErgTestKind } from '../../../shared/types';
import { parseSplit } from './format';
export const testKinds = [
  { value: '2k', label: '2k' },
  { value: '6k', label: '6k' },
] as const;
export function testTime(seconds: number) {
  const tenths = Math.round(seconds * 10);
  return `${Math.floor(tenths / 600)}:${((tenths % 600) / 10).toFixed(1).padStart(4, '0')}`;
}
export function testValues(value: string, mode: 'time' | 'split', kind: ErgTestKind) {
  const parsed = parseSplit(value);
  if (parsed === null) return null;
  const factor = kind === '2k' ? 4 : 12;
  const time_s = Math.round(parsed * (mode === 'split' ? factor : 1) * 10) / 10;
  const split = time_s / factor;
  if (split < 60 || split > 300) return null;
  return { time_s, split_s: Math.round(split * 10) / 10 };
}
