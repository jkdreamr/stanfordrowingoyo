// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Ticker } from './Ticker';
import { ProgressRing } from './ProgressRing';

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-entered');
  vi.unstubAllGlobals();
});

for (const entered of [false, true]) {
  it(`starts new figures ${entered ? 'at their value after entry' : 'from zero at launch'}`, () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    if (entered) document.documentElement.dataset.entered = '';
    const { container } = render(
      <>
        <Ticker id={`arrival-${entered}`} value={50} format={String} />
        <ProgressRing id={`arrival-${entered}`} value={50} max={100} label="Meters" />
      </>,
    );
    expect(container.querySelector('.ticker-figure > span')?.textContent).toBe(
      entered ? '50' : '0',
    );
    const circle = container.querySelector('.ui-ring-stroke')!;
    expect(Number(circle.getAttribute('stroke-dashoffset'))).toBeCloseTo(
      2 * Math.PI * 44 * (entered ? 0.5 : 1),
    );
  });
}
