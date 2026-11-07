// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import type { ErgTest } from '../../../shared/types';
import type { Achievement } from './celebrations';
import { saveCelebrationTest } from './celebrationTests';

const history = vi.hoisted(() => vi.fn());
vi.mock('./api', () => ({ api: (...args: unknown[]) => history(...args) }));
const achievement: Achievement = {
  kind: 'split-2k',
  title: 'New 2k Best',
  value: 98.24,
  entry: 'workout',
  date: '2026-10-26',
  week: '2026-10-26',
};
const test = { id: 'test', kind: '2k', date: achievement.date, split_s: 98.2 } as ErgTest;
beforeEach(() => {
  localStorage.clear();
  history.mockReset().mockResolvedValue([]);
});
it('checks history immediately before creating a normalized test on the workout date', async () => {
  const create = vi.fn().mockResolvedValue(test);
  expect(await saveCelebrationTest('rower', achievement, create)).toBe(true);
  expect(history).toHaveBeenCalledWith('GET /api/users/:id/tests', { params: { id: 'rower' } });
  expect(create).toHaveBeenCalledWith({
    body: { kind: '2k', date: achievement.date, split_s: 98.2 },
  });
  expect(history.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0]);
  await saveCelebrationTest('rower', achievement, create);
  expect(create).toHaveBeenCalledTimes(1);
  expect(history).toHaveBeenCalledTimes(1);
});
it('shares a synchronous per-user/entry/kind in-flight guard across callers', async () => {
  let resolve!: (tests: ErgTest[]) => void;
  history.mockReturnValue(
    new Promise<ErgTest[]>((done) => {
      resolve = done;
    }),
  );
  const create = vi.fn().mockResolvedValue(test);
  const first = saveCelebrationTest('rower', achievement, create);
  const second = saveCelebrationTest('rower', achievement, create);
  expect(second).toBe(first);
  resolve([]);
  await Promise.all([first, second]);
  expect(create).toHaveBeenCalledTimes(1);
});
it('skips an existing same-kind/date/split test and persists its success marker', async () => {
  history.mockResolvedValue([test]);
  const create = vi.fn();
  expect(await saveCelebrationTest('rower', achievement, create)).toBe(false);
  history.mockResolvedValue([]);
  await saveCelebrationTest('rower', achievement, create);
  expect(create).not.toHaveBeenCalled();
  expect(history).toHaveBeenCalledTimes(1);
});
it('does not conflate other dates, splits, kinds or users', async () => {
  history.mockResolvedValue([
    { ...test, date: '2026-10-25' },
    { ...test, split_s: 99 },
    { ...test, kind: '6k' },
  ]);
  const create = vi.fn().mockResolvedValue(test);
  await saveCelebrationTest('rower', achievement, create);
  await saveCelebrationTest('another', achievement, create);
  history.mockResolvedValue([test]);
  await saveCelebrationTest('rower', { ...achievement, kind: 'split-6k' }, create);
  expect(create).toHaveBeenCalledTimes(3);
});
it('reconciles a committed write whose response was lost without another POST', async () => {
  history.mockResolvedValueOnce([]).mockResolvedValue([test]);
  const create = vi.fn().mockRejectedValue(new TypeError('network'));
  expect(await saveCelebrationTest('rower', achievement, create)).toBe(false);
  await saveCelebrationTest('rower', achievement, create);
  expect(create).toHaveBeenCalledTimes(1);
  expect(history).toHaveBeenCalledTimes(2);
});
it('fails closed on unavailable history and permits a retry after a confirmed failed write', async () => {
  const create = vi.fn().mockRejectedValue(new Error('rejected'));
  history.mockRejectedValueOnce(new Error('offline'));
  await expect(saveCelebrationTest('rower', achievement, create)).rejects.toThrow('offline');
  expect(create).not.toHaveBeenCalled();
  await expect(saveCelebrationTest('rower', achievement, create)).rejects.toThrow('rejected');
  create.mockResolvedValue(test);
  await saveCelebrationTest('rower', achievement, create);
  expect(create).toHaveBeenCalledTimes(2);
});
it('checks history again after an unresolved ambiguous failure before retrying', async () => {
  const create = vi.fn().mockRejectedValue(new TypeError('network'));
  history.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('offline'));
  await expect(saveCelebrationTest('rower', achievement, create)).rejects.toThrow('offline');
  history.mockResolvedValue([test]);
  await saveCelebrationTest('rower', achievement, create);
  expect(create).toHaveBeenCalledTimes(1);
});
it.each([
  { entry: undefined },
  { date: undefined },
  { kind: 'best-week' as const },
  { value: 59 },
  { value: 301 },
  { value: NaN },
])('rejects incomplete or invalid test data: %j', async (patch) => {
  const create = vi.fn();
  await expect(saveCelebrationTest('rower', { ...achievement, ...patch }, create)).rejects.toThrow(
    'Invalid test',
  );
  expect(history).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
});
