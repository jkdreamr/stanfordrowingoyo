// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast';
import { LoadState } from '../shell/LoadState';
function Actions() {
  const { show } = useToast();
  return (
    <>
      <button onClick={() => show({ title: 'Saved' })}>Save</button>
      <button onClick={() => show({ title: 'Not saved', tone: 'error' })}>Fail</button>
    </>
  );
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('expires neutral confirmations after four seconds and errors after eight', () => {
  vi.useFakeTimers();
  render(
    <ToastProvider>
      <Actions />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByText('Save'));
  act(() => vi.advanceTimersByTime(4000));
  expect(screen.queryByText('Saved')).toBeNull();
  fireEvent.click(screen.getByText('Fail'));
  act(() => vi.advanceTimersByTime(4000));
  expect(screen.getByText('Not saved')).toBeTruthy();
  act(() => vi.advanceTimersByTime(4000));
  expect(screen.queryByText('Not saved')).toBeNull();
});
it('pauses on focus, resumes the remaining time and resets pause on a new notification', () => {
  vi.useFakeTimers();
  render(
    <ToastProvider>
      <Actions />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByText('Save'));
  act(() => vi.advanceTimersByTime(1000));
  fireEvent.focus(screen.getByRole('button', { name: 'Dismiss Notification' }));
  act(() => vi.advanceTimersByTime(8000));
  expect(screen.getByText('Saved')).toBeTruthy();
  fireEvent.blur(screen.getByRole('button', { name: 'Dismiss Notification' }));
  act(() => vi.advanceTimersByTime(3000));
  expect(screen.queryByText('Saved')).toBeNull();
  fireEvent.click(screen.getByText('Save'));
  fireEvent.focus(screen.getByRole('button', { name: 'Dismiss Notification' }));
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss Notification' }));
  fireEvent.click(screen.getByText('Fail'));
  act(() => vi.advanceTimersByTime(8000));
  expect(screen.queryByText('Not saved')).toBeNull();
});
it('offers a refresh after a slow load without claiming an empty result', () => {
  vi.useFakeTimers();
  const retry = vi.fn();
  const { rerender } = render(<LoadState retry={retry} />);
  expect(screen.queryByText('Still loading')).toBeNull();
  act(() => vi.advanceTimersByTime(10000));
  fireEvent.click(screen.getByText('Refresh'));
  expect(retry).toHaveBeenCalledOnce();
  rerender(<LoadState error retry={retry} />);
  expect(screen.getByText('Could Not Load This Screen')).toBeTruthy();
  expect(screen.queryByText('Still loading')).toBeNull();
});
