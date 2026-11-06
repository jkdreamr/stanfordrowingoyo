// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom';
import { createQueryClient } from '../../lib/queryClient';
import { qk } from '../../lib/queries';
import { createMockApi } from '../../mock/handlers';
import { RequireAuth } from '../shell/RequireAuth';
import { RouteFocus } from '../shell/RouteEffects';
import { AuthLayout } from './AuthLayout';
import Login from '../../pages/Login';
import Signup from '../../pages/Signup';
import ChangePassword from '../../pages/ChangePassword';
import Settings from '../../pages/Settings';
const clients: ReturnType<typeof createQueryClient>[] = [];
beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  clients.forEach((c) => c.clear());
  clients.length = 0;
  vi.unstubAllGlobals();
});
function setup(path: string, session: string | null = null, forced = false) {
  const mock = createMockApi({ session });
  mock.state.users[0].must_change_password = forced;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string | URL, init?: RequestInit) => mock.handle(new Request(String(url), init))),
  );
  const client = createQueryClient();
  clients.push(client);
  const router = createMemoryRouter(
    [
      {
        element: (
          <>
            <RouteFocus />
            <Outlet />
          </>
        ),
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: '/login', element: <Login /> },
              { path: '/signup', element: <Signup /> },
            ],
          },
          { path: '/change-password', element: <ChangePassword /> },
          {
            element: <RequireAuth />,
            children: [
              {
                path: '/feed',
                element: (
                  <main>
                    <h1>Team Feed</h1>
                  </main>
                ),
              },
              { path: '/settings', element: <Settings /> },
              {
                path: '/',
                element: (
                  <main>
                    <h1>Training Home</h1>
                  </main>
                ),
              },
            ],
          },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { mock, client, router };
}
function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
describe('authentication flows', () => {
  it('waits without a login flash and preserves the protected destination', async () => {
    const { router } = setup('/feed');
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Loading Your Training');
    expect(screen.queryByRole('button', { name: 'Log In' })).toBeNull();
    await screen.findByRole('button', { name: 'Log In' });
    expect(router.state.location.search).toBe('?next=%2Ffeed');
    fill('Email', 'maya.chen@stanford.edu');
    fill('Password', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
    const heading = await screen.findByRole('heading', { name: 'Team Feed' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });
  it('redirects signed-in users away from auth screens', async () => {
    const { router } = setup('/signup?next=/feed', 'user-1');
    await screen.findByRole('heading', { name: 'Team Feed' });
    expect(router.state.location.pathname).toBe('/feed');
  });
  it('validates empty credentials, toggles visibility, and explains API failures', async () => {
    setup('/login');
    const button = await screen.findByRole('button', { name: 'Log In' });
    fireEvent.click(button);
    expect(screen.getByText('Enter your password', { selector: 'p' })).toBeTruthy();
    fill('Email', 'maya.chen@stanford.edu');
    fill('Password', 'wrong');
    fireEvent.click(screen.getByRole('button', { name: 'Show Password' }));
    expect(screen.getByLabelText('Password').getAttribute('type')).toBe('text');
    fireEvent.click(button);
    await screen.findByText('Email or password is incorrect');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch')));
    fireEvent.click(button);
    await screen.findByText('Could not connect. Check your connection and try again');
  });
  it('maps signup roster/code and email conflicts to fields, then creates an account', async () => {
    setup('/signup?next=/feed');
    const button = await screen.findByRole('button', { name: 'Sign Up' });
    fill('Name', 'Alex Rower');
    fill('Email', 'new@stanford.edu');
    fill('Password', 'password');
    fireEvent.click(button);
    await waitFor(() =>
      expect(screen.getByLabelText('Team Join Code').getAttribute('aria-invalid')).toBe('true'),
    );
    fill('Email', 'maya.chen@stanford.edu');
    fireEvent.click(button);
    await waitFor(() =>
      expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true'),
    );
    fill('Email', 'new@stanford.edu');
    fill('Team Join Code', 'cardinal-oyo');
    fireEvent.click(button);
    await screen.findByRole('heading', { name: 'Team Feed' });
  });
  it('forces a temporary password change, validates confirmation, and refreshes me', async () => {
    const { client } = setup('/feed', 'user-1', true);
    await screen.findByRole('button', { name: 'Change Password' });
    fill('Current Password', 'password');
    fill('New Password', 'new-password');
    fill('Confirm Password', 'different');
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
    expect(screen.getByText('Passwords do not match', { selector: 'p' })).toBeTruthy();
    fill('Confirm Password', 'new-password');
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
    await screen.findByRole('heading', { name: 'Team Feed' });
    expect(
      client.getQueryData<{ must_change_password: boolean }>(qk.me())?.must_change_password,
    ).toBe(false);
  });
  it('logs out and removes account data from the cache', async () => {
    const { client } = setup('/settings', 'user-1');
    fireEvent.click(await screen.findByRole('button', { name: 'Log Out' }));
    await screen.findByRole('button', { name: 'Log In' });
    expect(client.getQueryData(qk.me())).toBeUndefined();
  });
});
