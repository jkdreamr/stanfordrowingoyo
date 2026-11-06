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
import { ThemeProvider } from '../../lib/theme';
import { ToastProvider } from '../ui';
const clients: ReturnType<typeof createQueryClient>[] = [];
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
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
      <ThemeProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return { mock, client, router };
}
function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
async function joinRoster(name: string) {
  await screen.findByLabelText('Team Join Code');
  fill('Team Join Code', 'cardinal-oyo');
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(await screen.findByRole('radio', { name: new RegExp(`^${name}`) }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
}
describe('authentication flows', () => {
  it('waits without a login flash and preserves the protected destination', async () => {
    const { router } = setup('/feed');
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Loading Your Training');
    expect(screen.queryByRole('button', { name: 'Log In' })).toBeNull();
    await screen.findByRole('button', { name: 'Log In' });
    expect(router.state.location.search).toBe('?next=%2Ffeed');
    fill('Email', 'marcus.albrecht@stanford.edu');
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
    fill('Email', 'marcus.albrecht@stanford.edu');
    fill('Password', 'wrong');
    fireEvent.click(screen.getByRole('button', { name: 'Show Password' }));
    expect(screen.getByLabelText('Password').getAttribute('type')).toBe('text');
    fireEvent.click(button);
    await screen.findByText('Email or password is incorrect');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch')));
    fireEvent.click(button);
    await screen.findByText('Could not connect. Check your connection and try again');
  });
  it('finds a roster name, chooses a group, handles email conflicts and creates an account', async () => {
    const { mock } = setup('/signup?next=/feed');
    await joinRoster('Sandro Scalfi');
    expect(screen.getByText('Step 3 of 4')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'U23-Senior Hopefuls' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fill('Email', 'marcus.albrecht@stanford.edu');
    fill('Password', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    await screen.findByText('This email is already registered. Log in instead', { selector: 'p' });
    fill('Email', 'sandro@stanford.edu');
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    await screen.findByRole('heading', { name: 'Team Feed' });
    expect(mock.state.users.at(-1)).toMatchObject({
      name: 'Sandro Scalfi',
      email: 'sandro@stanford.edu',
      group_key: 'u23',
      on_leaderboard: true,
    });
  });
  it('validates the code, handles 403 and network failures, and supports empty search and Back', async () => {
    setup('/signup');
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Enter your team join code', { selector: 'p' })).toBeTruthy();
    fill('Team Join Code', 'wrong');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText('That code is not correct. Ask your team for the join code', {
      selector: 'p',
    });
    fill('Team Join Code', 'cardinal-oyo');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('heading', { name: 'Find Your Name' });
    fill('Search Names', 'unknown');
    expect(screen.getByText('No Matching Names')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch')));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText('Could not connect. Check your connection and try again');
  });
  it('skips group selection for a coxswain and preserves native Back behavior', async () => {
    const { mock } = setup('/signup');
    await joinRoster('Ginger Bernstein');
    expect(screen.getByText('Step 3 of 3')).toBeTruthy();
    expect(screen.queryByLabelText('Your Group')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'Find Your Name' });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fill('Email', 'ginger@stanford.edu');
    fill('Password', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    await screen.findByRole('heading', { name: 'Training Home' });
    expect(mock.state.users.at(-1)).toMatchObject({
      role: 'coxswain',
      group_key: 'normal',
      on_leaderboard: false,
    });
  });
  it('refreshes the name list after a concurrent claim and returns to selection', async () => {
    const { mock } = setup('/signup');
    await joinRoster('Sandro Scalfi');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    mock.state.roster.find((r) => r.name === 'Sandro Scalfi')!.claimed_by_user_id = 'user-1';
    fill('Email', 'sandro@stanford.edu');
    fill('Password', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    await screen.findByRole('heading', { name: 'Find Your Name' });
    expect(
      screen.getByText('That name was already claimed. Ask a coxswain to free it up.'),
    ).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('radio', { name: 'Sandro Scalfi' })).toBeNull());
  });
  it('uses the email-only bootstrap path without a code or roster selection', async () => {
    const { mock } = setup('/signup');
    mock.state.users = mock.state.users.filter((u) => u.role !== 'admin');
    mock.state.roster.find((r) => r.role === 'admin')!.claimed_by_user_id = null;
    fireEvent.click(await screen.findByRole('button', { name: 'Have an Invite Email?' }));
    expect(screen.queryByLabelText('Team Join Code')).toBeNull();
    fill('Email', 'joskoo@stanford.edu');
    fill('Password', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    await screen.findByRole('heading', { name: 'Training Home' });
    expect(mock.state.users.at(-1)).toMatchObject({
      name: 'Joshua Koo',
      role: 'admin',
      on_leaderboard: false,
    });
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
    fireEvent.click(screen.getByRole('dialog').querySelector('footer button:last-child')!);
    await screen.findByRole('button', { name: 'Log In' });
    expect(client.getQueryData(qk.me())).toBeUndefined();
  });
});
