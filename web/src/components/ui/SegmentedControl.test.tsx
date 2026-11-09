// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { SegmentedControl } from './SegmentedControl';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function Example() {
  const [value, setValue] = useState('erg');
  return (
    <SegmentedControl
      label="Modality"
      value={value}
      onChange={setValue}
      options={[
        { value: 'erg', label: 'Erg' },
        { value: 'bike', label: 'Bike', disabled: true },
        { value: 'run', label: 'Run' },
      ]}
    />
  );
}
describe('SegmentedControl', () => {
  it.each([
    ['', 520],
    ['.52s', 520],
    ['280ms', 280],
  ])('stretches with CSS duration %j only on selection changes', (duration, expected) => {
    const cancel = vi.fn();
    const animate = vi.fn(() => ({ cancel }) as unknown as Animation);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const original = HTMLElement.prototype.animate;
    HTMLElement.prototype.animate = animate;
    try {
      const { unmount, container } = render(<Example />);
      (container.querySelector('.ui-segment-thumb') as HTMLElement).style.setProperty(
        '--dur-travel',
        duration,
      );
      expect(animate).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('radio', { name: 'Run' }));
      expect(animate).toHaveBeenCalledWith(
        [{ scale: '1 1' }, { scale: '1.04 0.98', offset: 0.35 }, { scale: '1 1' }],
        expect.objectContaining({ duration: expected }),
      );
      fireEvent.click(screen.getByRole('radio', { name: 'Run' }));
      expect(animate).toHaveBeenCalledTimes(1);
      unmount();
      expect(cancel).toHaveBeenCalledTimes(1);
    } finally {
      HTMLElement.prototype.animate = original;
    }
  });
  it('does not stretch with reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { container } = render(<Example />);
    const animate = vi.fn();
    container.querySelector('.ui-segment-thumb')!.animate = animate;
    fireEvent.click(screen.getByRole('radio', { name: 'Run' }));
    expect(animate).not.toHaveBeenCalled();
  });
  it('roves focus and selection, skips disabled and wraps', () => {
    render(<Example />);
    const erg = screen.getByRole('radio', { name: 'Erg' });
    const run = screen.getByRole('radio', { name: 'Run' });
    fireEvent.keyDown(erg, { key: 'ArrowRight' });
    expect(run.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(run);
    expect(erg.tabIndex).toBe(-1);
    fireEvent.keyDown(run, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(erg);
    fireEvent.keyDown(erg, { key: 'End' });
    expect(document.activeElement).toBe(run);
    fireEvent.keyDown(run, { key: 'Home' });
    expect(document.activeElement).toBe(erg);
    fireEvent.keyDown(erg, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(run);
  });
  it('selects on click and handles empty options', () => {
    const { rerender } = render(<Example />);
    fireEvent.click(screen.getByRole('radio', { name: 'Run' }));
    expect(screen.getByRole('radio', { name: 'Run' }).tabIndex).toBe(0);
    rerender(<SegmentedControl label="Empty" value="" onChange={() => {}} options={[]} />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });
});
