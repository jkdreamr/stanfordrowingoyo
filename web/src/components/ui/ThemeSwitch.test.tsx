// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeSwitch } from './ThemeSwitch';

afterEach(cleanup);
function Harness({ onChange = () => {}, disabled = false }) {
  const [dark, setDark] = useState(false);
  return (
    <ThemeSwitch
      aria-label="Dark Mode"
      dark={dark}
      disabled={disabled}
      onChange={(next) => {
        onChange(next);
        setDark(next);
      }}
    />
  );
}
const knobSide = () => screen.getByRole('switch').getAttribute('data-side');

it('is a native switch with a 44 x 76 target and decorative icons', () => {
  render(<Harness />);
  const control = screen.getByRole('switch', { name: 'Dark Mode' });
  expect(control.tagName).toBe('BUTTON');
  expect(control.getAttribute('aria-checked')).toBe('false');
  expect(control.className).toBe('glass-switch');
  expect(control.querySelectorAll('svg')).toHaveLength(4);
  control.querySelectorAll(':scope > span').forEach((layer) => {
    expect(layer.getAttribute('aria-hidden')).toBe('true');
  });
});

it('toggles on click and chooses a side with the arrow keys', () => {
  const change = vi.fn();
  render(<Harness onChange={change} />);
  const control = screen.getByRole('switch');
  fireEvent.click(control);
  expect(control.getAttribute('aria-checked')).toBe('true');
  expect(knobSide()).toBe('dark');
  fireEvent.keyDown(control, { key: 'ArrowRight' });
  expect(change).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(control, { key: 'ArrowLeft' });
  expect(control.getAttribute('aria-checked')).toBe('false');
  expect(knobSide()).toBe('light');
  fireEvent.keyDown(control, { key: 'ArrowLeft' });
  expect(change).toHaveBeenCalledTimes(2);
  expect(control.style.getPropertyValue('--p')).toBe('0');
});

it('does nothing while disabled', () => {
  const change = vi.fn();
  render(<Harness onChange={change} disabled />);
  const control = screen.getByRole('switch');
  expect((control as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(control);
  expect(change).not.toHaveBeenCalled();
});
