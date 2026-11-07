import type { ErgTest, ErgTestInput } from '../../../shared/types';
import { api } from './api';
import { normalizeTestSplit, type Achievement } from './celebrations';

const pending = new Map<string, Promise<boolean>>();

export function saveCelebrationTest(
  user: string,
  achievement: Achievement,
  create: (input: { body: ErgTestInput }) => Promise<ErgTest>,
): Promise<boolean> {
  const kind =
    achievement.kind === 'split-2k' ? '2k' : achievement.kind === 'split-6k' ? '6k' : null;
  const split = normalizeTestSplit(achievement.value);
  if (!kind || !achievement.entry || !achievement.date || split === null)
    return Promise.reject(new Error('Invalid test'));
  const key = `oyo-celebration-test:${user}:${achievement.entry}:${kind}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const body: ErgTestInput = { kind, date: achievement.date, split_s: split };
  const find = async () => {
    const tests = await api('GET /api/users/:id/tests', { params: { id: user } });
    return tests.find(
      (test) => test.kind === kind && test.date === body.date && test.split_s === split,
    );
  };
  const save = async () => {
    if (localStorage.getItem(key)) return false;
    const duplicate = await find();
    if (duplicate) {
      localStorage.setItem(key, duplicate.id);
      return false;
    }
    try {
      const test = await create({ body });
      localStorage.setItem(key, test.id);
      return true;
    } catch (error) {
      const recovered = await find();
      if (!recovered) throw error;
      localStorage.setItem(key, recovered.id);
      return false;
    }
  };
  const promise = save().finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}
