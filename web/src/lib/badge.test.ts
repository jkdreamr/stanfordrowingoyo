import { expect, it, vi } from 'vitest';
import { setAppBadge } from './badge';
it('sets, clamps and clears the app badge where supported', () => {
  const nav = {
    setAppBadge: vi.fn().mockResolvedValue(undefined),
    clearAppBadge: vi.fn().mockResolvedValue(undefined),
  } as unknown as Navigator;
  setAppBadge(3, nav);
  setAppBadge(250, nav);
  setAppBadge(0, nav);
  expect(vi.mocked(nav.setAppBadge!).mock.calls).toEqual([[3], [99]]);
  expect(nav.clearAppBadge).toHaveBeenCalledOnce();
});
it('ignores unsupported browsers and rejected badge calls', () => {
  expect(() => setAppBadge(2, {} as Navigator)).not.toThrow();
  const nav = { setAppBadge: vi.fn().mockRejectedValue(new Error('no')) } as unknown as Navigator;
  expect(() => setAppBadge(2, nav)).not.toThrow();
  const throwing = {
    setAppBadge: () => {
      throw new Error('denied');
    },
  } as unknown as Navigator;
  expect(() => setAppBadge(1, throwing)).not.toThrow();
});
