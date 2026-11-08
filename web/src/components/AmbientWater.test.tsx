// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AmbientWater } from './AmbientWater';

vi.mock('../lib/motion', () => ({
  afterLaunch: (start: () => void) => {
    start();
    return () => {};
  },
}));
const queries = new Map<string, EventTarget & { matches: boolean }>();
const pending = new Map<number, FrameRequestCallback>();
const put = vi.fn();
let id = 0;
let pixels: Uint8ClampedArray;
beforeEach(() => {
  queries.clear();
  pending.clear();
  put.mockClear();
  document.documentElement.classList.remove('dark');
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.stubGlobal('matchMedia', (query: string) => {
    if (!queries.has(query))
      queries.set(query, Object.assign(new EventTarget(), { matches: false }));
    return queries.get(query);
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    pending.set(++id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => pending.delete(handle));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    createImageData: (width: number, height: number) => {
      pixels = new Uint8ClampedArray(width * height * 4);
      return { data: pixels, width, height };
    },
    putImageData: put,
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function frame(now: number) {
  act(() => {
    const [handle, callback] = [...pending][0];
    pending.delete(handle);
    callback(now);
  });
}
function media(query: string, matches: boolean) {
  act(() => {
    const target = queries.get(query)!;
    target.matches = matches;
    target.dispatchEvent(new Event('change'));
  });
}

it('renders a decorative low-resolution canvas and evolving pixels at 30 fps', () => {
  const { container } = render(<AmbientWater />);
  expect(container.firstElementChild!.getAttribute('aria-hidden')).toBe('true');
  expect(container.querySelector('canvas')!.width).toBe(128);
  expect(put).toHaveBeenCalledTimes(1);
  frame(100);
  const first = pixels.slice();
  frame(116);
  expect(put).toHaveBeenCalledTimes(2);
  frame(2100);
  expect(pixels).not.toEqual(first);
});
it('renders nothing when disabled', () => {
  const { container } = render(<AmbientWater config={{ enabled: false, intensity: 1 }} />);
  expect(container.childElementCount).toBe(0);
  expect(put).not.toHaveBeenCalled();
  expect(pending.size).toBe(0);
});
it('pauses while hidden, resumes, and cancels on unmount', () => {
  const { container, unmount } = render(<AmbientWater />);
  act(() => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(container.firstElementChild!.getAttribute('data-paused')).toBe('true');
  expect(pending.size).toBe(0);
  expect(put).toHaveBeenCalledTimes(1);
  act(() => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(pending.size).toBe(1);
  unmount();
  expect(pending.size).toBe(0);
});
it('renders exactly one static frame under reduced motion', () => {
  vi.stubGlobal('matchMedia', (query: string) => {
    const target = Object.assign(new EventTarget(), { matches: query.includes('reduced-motion') });
    queries.set(query, target);
    return target;
  });
  render(<AmbientWater />);
  expect(put).toHaveBeenCalledTimes(1);
  expect(pending.size).toBe(0);
  media('(prefers-reduced-motion: reduce)', false);
  expect(pending.size).toBe(1);
});
it.each([
  '(forced-colors: active)',
  '(prefers-contrast: more)',
  '(prefers-reduced-transparency: reduce)',
])('stops rendering when %s changes', (query) => {
  const { container } = render(<AmbientWater />);
  media(query, true);
  expect((container.firstElementChild as HTMLElement).hidden).toBe(true);
  expect(pending.size).toBe(0);
  expect(put).toHaveBeenCalledTimes(1);
  media(query, false);
  expect(pending.size).toBe(1);
});
it.each([-1, NaN, 2])('clamps intensity %s and every light alpha', (intensity) => {
  render(<AmbientWater config={{ enabled: true, intensity }} />);
  for (let i = 3; i < pixels.length; i += 4)
    expect(pixels[i]).toBeLessThanOrEqual(intensity === 2 ? 49 : 0);
});
it('updates the palette on theme mutation and bounds dark alpha', async () => {
  render(<AmbientWater />);
  const light = pixels.slice();
  await act(async () => document.documentElement.classList.add('dark'));
  expect(pixels).not.toEqual(light);
  let cells = 0;
  let shimmer = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    expect(pixels[i + 3]).toBeGreaterThan(0);
    expect(pixels[i + 3]).toBeLessThanOrEqual(64);
    expect(pixels[i + 2]).toBeGreaterThan(pixels[i]);
    const luminance = [0.2126, 0.7152, 0.0722].reduce((sum, weight, channel) => {
      const value = (pixels[i + channel] * pixels[i + 3]) / (255 * 255);
      return sum + weight * (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    }, 0);
    expect(luminance).toBeLessThan(0.012);
    if (pixels[i] < 24) cells++;
    if (pixels[i] > 80) shimmer++;
  }
  expect(cells).toBeGreaterThan(0);
  expect(shimmer).toBeGreaterThan(0);
});
it('keeps pale aqua cells and near-transparent sunlight rims', () => {
  render(<AmbientWater />);
  let rims = 0;
  let cells = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    expect([...pixels.slice(i, i + 3)]).toEqual([115, 175, 201]);
    if (pixels[i + 3] < 3) rims++;
    if (pixels[i + 3] > 38) cells++;
  }
  expect(rims).toBeGreaterThan(0);
  expect(cells).toBeGreaterThan(0);
});
it('clears dark ink and shimmer at zero intensity', async () => {
  render(<AmbientWater config={{ enabled: true, intensity: 0 }} />);
  await act(async () => document.documentElement.classList.add('dark'));
  for (let i = 3; i < pixels.length; i += 4) expect(pixels[i]).toBe(0);
});
it('keeps roughly four broad cells across the viewport', () => {
  const { container } = render(<AmbientWater />);
  const { width, height } = container.querySelector('canvas')!;
  let entries = 0;
  for (let y = 0; y < height; y++) {
    let inRim = false;
    for (let x = 0; x < width; x++) {
      const rim = pixels[(y * width + x) * 4 + 3] < 10;
      if (rim && !inRim) entries++;
      inRim = rim;
    }
  }
  expect(entries / height).toBeGreaterThan(3);
  expect(entries / height).toBeLessThan(6);
});
it('handles an unavailable canvas context without scheduling frames', () => {
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
  render(<AmbientWater />);
  expect(pending.size).toBe(0);
  expect(put).not.toHaveBeenCalled();
});
