// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { shareResult } from './share';

afterEach(() => vi.unstubAllGlobals());
it.each(['native', 'clipboard', 'fallback', 'abort', 'error'])('shares via %s', async (mode) => {
  const show = vi.fn();
  const writeText = vi
    .fn()
    .mockImplementation(() =>
      mode === 'error' ? Promise.reject(new Error('denied')) : Promise.resolve(),
    );
  const share = vi
    .fn()
    .mockImplementation(() =>
      mode === 'abort'
        ? Promise.reject(new DOMException('Cancelled', 'AbortError'))
        : mode === 'fallback'
          ? Promise.reject(new Error('failed'))
          : Promise.resolve(),
    );
  vi.stubGlobal('navigator', {
    clipboard: { writeText },
    share: ['clipboard', 'error'].includes(mode) ? undefined : share,
  });
  await shareResult('Game', '', show);
  const text = '\nhttps://stanford-oyo.joskoo.workers.dev';
  if (mode === 'native') expect(share).toHaveBeenCalledWith({ title: 'Game', text });
  if (['native', 'abort'].includes(mode)) {
    expect(writeText).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
  } else {
    expect(writeText).toHaveBeenCalledWith(text);
    expect(show).toHaveBeenCalledWith(
      mode === 'error'
        ? { title: 'Could Not Copy Result', tone: 'error' }
        : { title: 'Result Copied' },
    );
  }
});
