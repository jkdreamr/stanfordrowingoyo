// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { createQueryClient } from '../../lib/queryClient';
import { createMockApi } from '../../mock/handlers';
import { ToastProvider } from '../../components/ui';
import Game from '../../pages/Game';
import Games from '../../pages/Games';
import GamesLeaderboard from '../../pages/GamesLeaderboard';
import PinpointGame from './index';
import { PinpointPlay } from './PinpointPlay';

const DATE = '2026-11-16';
const complete = vi.fn();
const clients: ReturnType<typeof createQueryClient>[] = [];
const scroll = vi.fn();
let reduced = false;
beforeEach(() => {
  reduced = false;
  complete.mockClear();
  scroll.mockClear();
  Object.defineProperty(Element.prototype, 'scrollIntoView', { value: scroll, configurable: true });
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal('matchMedia', () => ({
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
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
  clients.forEach((client) => client.clear());
  clients.length = 0;
  vi.unstubAllGlobals();
});

function mount(
  node: ReactNode = <PinpointPlay date={DATE} onComplete={complete} />,
  role: 'coach' | 'rower' | 'coxswain' = 'coach',
  intercept?: (request: Request) => Promise<Response | undefined>,
  route = '/',
) {
  const mock = createMockApi({ now: () => new Date(`${DATE}T18:00:00Z`), session: 'user-1' });
  mock.state.users.find((user) => user.id === 'user-1')!.role = role;
  mock.state.entries = [];
  const requests: { path: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', async (url: URL, init?: RequestInit) => {
    const request = new Request(String(url), init);
    requests.push({
      path: new URL(request.url).pathname,
      body: request.method === 'POST' ? await request.clone().json() : null,
    });
    return (await intercept?.(request.clone())) ?? mock.handle(request);
  });
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  clients.push(client);
  render(
    <MemoryRouter initialEntries={[route]}>
      <QueryClientProvider client={client}>
        <ToastProvider>{node}</ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { requests, mock };
}
async function guess(text: string) {
  const input = await screen.findByRole('textbox', { name: 'Your Category' });
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Guess' }));
}

it('renders five ordered slots but only server-revealed text, with an empty guess disabled', async () => {
  mount();
  expect(await screen.findByText('Demo alpha')).toBeTruthy();
  expect(within(screen.getByRole('list', { name: 'Clues' })).getAllByRole('listitem')).toHaveLength(
    5,
  );
  expect(screen.getAllByText('Not Revealed')).toHaveLength(4);
  expect(screen.queryByText('Demo beta')).toBeNull();
  expect(screen.queryByText('Mock alphabet')).toBeNull();
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Guess' }).disabled).toBe(true);
  const input = screen.getByRole('textbox');
  expect(input.getAttribute('enterkeyhint')).toBe('go');
  expect(input.getAttribute('autocapitalize')).toBe('off');
  expect(input.getAttribute('spellcheck')).toBe('false');
});

it('submits an authoritative guess and date, reveals a clue, announces it and restores input focus', async () => {
  const { requests } = mount();
  await guess('Wrong category');
  expect(await screen.findByText('Demo beta')).toBeTruthy();
  expect(screen.queryByText('Demo gamma')).toBeNull();
  expect(
    within(screen.getByRole('region', { name: 'Previous Guesses' })).getByText('Wrong category'),
  ).toBeTruthy();
  expect(requests.find((request) => request.path.endsWith('/guess'))?.body).toEqual({
    guess: 'Wrong category',
    date: DATE,
  });
  expect(document.activeElement).toBe(screen.getByRole('textbox'));
  expect(screen.getByText('Clue 2: Demo beta')).toBeTruthy();
  expect(screen.getByText('Demo beta').className).toContain('pp-reveal');
});

it('skips with an empty guess, without adding an empty previous guess', async () => {
  const { requests } = mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Reveal Next Clue' }));
  await screen.findByText('Demo beta');
  expect(requests.find((request) => request.path.endsWith('/guess'))?.body).toEqual({
    guess: '',
    date: DATE,
  });
  expect(screen.queryByRole('region', { name: 'Previous Guesses' })).toBeNull();
});

it('shows duplicate 400 errors inline without consuming a clue or clearing the input', async () => {
  mount();
  await guess('Wrong');
  await screen.findByText('Demo beta');
  await guess('Wrong');
  expect((await screen.findByRole('alert')).textContent).toBe('Empty or repeated guess.');
  expect(screen.queryByText('Demo gamma')).toBeNull();
  expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe('Wrong');
  expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true');
});

it('blocks double submissions and disables actions while pending', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { requests } = mount(undefined, 'coach', async (request) => {
    if (request.method === 'POST') await gate;
    return undefined;
  });
  await guess('Wrong');
  await waitFor(() =>
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Reveal Next Clue' }).disabled,
    ).toBe(true),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Guess' }));
  expect(requests.filter((request) => request.path.endsWith('/guess'))).toHaveLength(1);
  release();
  await screen.findByText('Demo beta');
});

it.each([403, 409])('handles %s as an access/day-change boundary', async (status) => {
  mount(undefined, 'coach', async (request) =>
    request.method === 'POST'
      ? Response.json(
          { error: { code: status === 403 ? 'GAME_LOCKED' : 'DAY_CHANGED', message: 'Boundary' } },
          { status },
        )
      : undefined,
  );
  await guess('Wrong');
  if (status === 403) expect(await screen.findByRole('link', { name: 'Log Workout' })).toBeTruthy();
  else expect(await screen.findByRole('button', { name: 'Reload' })).toBeTruthy();
  expect(screen.queryByRole('textbox')).toBeNull();
});

it('resumes from the server after an uncertain network failure', async () => {
  mount(undefined, 'coach', async (request) =>
    request.method === 'POST'
      ? Response.json(
          { error: { code: 'NETWORK_ERROR', message: 'No connection. Try again.' } },
          { status: 503 },
        )
      : undefined,
  );
  await guess('Wrong');
  expect((await screen.findByRole('alert')).textContent).toBe('No connection. Try again.');
  expect(screen.queryByText('Demo beta')).toBeNull();
  expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe('Wrong');
});

it('uses the reduced-motion class and scrolls focused input into the resized visual viewport', async () => {
  reduced = true;
  const viewport = Object.assign(new EventTarget(), { height: 500, offsetTop: 0 });
  vi.stubGlobal('visualViewport', viewport);
  mount();
  const input = await screen.findByRole('textbox');
  input.getBoundingClientRect = () => ({ top: 600, bottom: 644 }) as DOMRect;
  expect(input.closest('.pp')?.className).toContain('pp-reduced-motion');
  input.focus();
  viewport.dispatchEvent(new Event('resize'));
  await waitFor(() =>
    expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: 'instant' }),
  );
});

it('gates locked rowers through the shared frame', async () => {
  mount(<PinpointGame />, 'rower');
  expect(await screen.findByRole('link', { name: 'Log Workout' })).toBeTruthy();
  expect(screen.queryByRole('textbox')).toBeNull();
});

it.each(['coach', 'coxswain'] as const)(
  'allows %s without a workout and finishes with all clues, board and spoiler-free share',
  async (role) => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    mount(<PinpointGame />, role);
    await guess('Mock alphabet');
    expect(await screen.findByText('1 / 5')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Mock alphabet' })).toBeTruthy();
    expect(screen.getByText('Demo epsilon')).toBeTruthy();
    expect(screen.queryByText('Not Revealed')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(document.querySelector('.pp-won')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(share.mock.calls[0][0].text).toContain(`Pinpoint · ${DATE} · 1/5\n🟩⬜⬜⬜⬜`);
    expect(share.mock.calls[0][0].text).not.toMatch(/Mock alphabet|Demo/);
  },
);

it('loses after five skips and reveals the category, all clues and X/5', async () => {
  mount(<PinpointGame />);
  for (let i = 0; i < 4; i++) {
    fireEvent.click(await screen.findByRole('button', { name: 'Reveal Next Clue' }));
    await screen.findByText(['Demo beta', 'Demo gamma', 'Demo delta', 'Demo epsilon'][i]);
  }
  fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
  expect(await screen.findByText('X / 5')).toBeTruthy();
  expect(await screen.findByRole('heading', { name: 'Mock alphabet' })).toBeTruthy();
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(document.querySelector('.pp-won')).toBeNull();
});

it('redirects a disabled Pinpoint route using the server-enabled list', async () => {
  mount(
    <Routes>
      <Route path="/games/:id/*" element={<Game />} />
      <Route path="/games" element={<p>Daily Games Hub</p>} />
    </Routes>,
    'coach',
    async (request) =>
      new URL(request.url).pathname === '/api/games'
        ? Response.json({ date: DATE, games: [], results: [], streak: 0 })
        : undefined,
    '/games/pinpoint/play',
  );
  expect(await screen.findByText('Daily Games Hub')).toBeTruthy();
  expect(screen.queryByRole('textbox')).toBeNull();
});

it.each([<Games />, <GamesLeaderboard />])(
  'hides disabled Pinpoint from the hub and board navigation',
  async (node) => {
    mount(node, 'coach', async (request) =>
      new URL(request.url).pathname === '/api/games'
        ? Response.json({
            date: DATE,
            games: [{ id: 'wordguess', direction: 'higher' }],
            results: [],
            streak: { current: 0, best: 0 },
            access: { unlocked: true, reason: 'staff' },
          })
        : undefined,
    );
    await screen.findAllByText('Word Guess');
    expect(screen.queryByText('Pinpoint')).toBeNull();
  },
);
