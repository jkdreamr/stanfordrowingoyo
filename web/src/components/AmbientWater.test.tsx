// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AmbientWater, ambientWaterConfig } from './AmbientWater';

vi.mock('../lib/motion', () => ({
  afterLaunch: (start: () => void) => {
    start();
    return () => {};
  },
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('renders an aria-hidden decorative layer at configured intensity', () => {
  const { container } = render(<AmbientWater />);
  const layer = container.firstElementChild!;
  expect(layer.getAttribute('aria-hidden')).toBe('true');
  expect(layer.getAttribute('data-ready')).toBe('true');
  expect((layer as HTMLElement).style.getPropertyValue('--ambient-intensity')).toBe('1');
  expect(layer.children[0].children).toHaveLength(3);
  expect(layer.querySelector('.ambient-water__swell')).not.toBeNull();
  expect(layer.querySelector('.ambient-water__oar')).toBeNull();
});
it('renders nothing when disabled', () => {
  const { container } = render(<AmbientWater config={{ ...ambientWaterConfig, enabled: false }} />);
  expect(container.childElementCount).toBe(0);
});
it('pauses while hidden and resumes when visible', () => {
  const visibility = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  const { container, unmount } = render(<AmbientWater />);
  const layer = container.firstElementChild!;
  expect(layer.getAttribute('data-paused')).toBe('true');
  act(() => {
    visibility.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(layer.getAttribute('data-paused')).toBe('false');
  act(() => {
    visibility.mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(layer.getAttribute('data-paused')).toBe('true');
  unmount();
  document.dispatchEvent(new Event('visibilitychange'));
});
it.each([-1, 2, NaN])('bounds unsafe intensity %s', (intensity) => {
  const { container } = render(<AmbientWater config={{ enabled: true, intensity }} />);
  expect(
    (container.firstElementChild as HTMLElement).style.getPropertyValue('--ambient-intensity'),
  ).toBe(intensity === 2 ? '1' : '0');
});
