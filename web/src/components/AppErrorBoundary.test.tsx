// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AppErrorBoundary, AppErrorScreen } from './AppErrorBoundary';
const suppressExpectedError = (event: ErrorEvent) => {
  if (event.error?.message === 'Sensitive internal stack details') event.preventDefault();
};
beforeEach(() => window.addEventListener('error', suppressExpectedError));
afterEach(() => {
  window.removeEventListener('error', suppressExpectedError);
  cleanup();
  vi.restoreAllMocks();
});
function Broken(): never {
  throw new Error('Sensitive internal stack details');
}
it('preserves healthy content', () => {
  render(
    <AppErrorBoundary>
      <h1>Home</h1>
    </AppErrorBoundary>,
  );
  expect(screen.getByRole('heading', { name: 'Home' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull();
});
for (const scope of ['provider', 'route'] as const) {
  it(`replaces a ${scope} render failure with a friendly screen and working Reload`, () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onReload = vi.fn();
    if (scope === 'provider')
      render(
        <AppErrorBoundary onReload={onReload}>
          <Broken />
        </AppErrorBoundary>,
      );
    else {
      const router = createMemoryRouter([
        {
          errorElement: <AppErrorScreen onReload={onReload} />,
          children: [{ path: '/', element: <Broken /> }],
        },
      ]);
      render(<RouterProvider router={router} />);
    }
    expect(screen.getByRole('heading', { name: 'Something Went Wrong' })).toBeTruthy();
    expect(screen.queryByText(/Sensitive internal stack details/)).toBeNull();
    expect(screen.queryByText(/Unexpected Application Error/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onReload).toHaveBeenCalledOnce();
  });
}
