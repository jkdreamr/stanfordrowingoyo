// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { SegmentedControl } from './SegmentedControl';
afterEach(cleanup);
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
