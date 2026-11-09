// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { WorldleDay, WorldleGuess } from '../../../../shared/types';
import { api, ApiClientError } from '../../lib/api';
import { qk } from '../../lib/queries';
import { ToastProvider } from '../../components/ui';
import { WorldlePlay, WorldleReveal } from './WorldlePlay';
import WorldleGame from './index';

vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof import('../../lib/api')>()),
  api: vi.fn(),
}));
const DATE = '2026-11-16';
let client: QueryClient;
let current: WorldleDay;
const row = (name = 'United States'): WorldleGuess => ({
  name,
  km: 1000,
  bearing: 45,
  direction: 'NE',
  proximity: 95,
  correct: false,
});
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  localStorage.clear();
  current = {
    date: DATE,
    access: { date: DATE, unlocked: true, reason: 'staff' },
    shape: '0123456789abcdef',
    guesses: [],
    done: false,
    won: false,
    answer: null,
  };
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === 'POST /api/games/worldle/guess') {
      const guess = (options as { body: { guess: string } }).body.guess;
      current = { ...current, guesses: [...current.guesses, row(guess)] };
    }
    return current as never;
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
function mount(node: ReactNode = <WorldlePlay date={DATE} onComplete={() => {}} />) {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ToastProvider>{node}</ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
async function input(text: string) {
  const field = await screen.findByRole('combobox');
  fireEvent.focus(field);
  fireEvent.change(field, { target: { value: text } });
  return field;
}

it('renders six quiet rows, a name-free silhouette and iOS input attributes', async () => {
  mount();
  const field = await screen.findByRole('combobox');
  expect(screen.getAllByRole('listitem')).toHaveLength(6);
  expect(screen.getAllByLabelText(/Guess \d, empty/)).toHaveLength(6);
  expect(screen.getByRole('img', { name: 'Country outline' }).getAttribute('aria-label')).toBe(
    'Country outline',
  );
  expect(screen.queryByText('France')).toBeNull();
  for (const [key, value] of Object.entries({
    inputmode: 'text',
    autocomplete: 'off',
    autocorrect: 'off',
    autocapitalize: 'words',
    enterkeyhint: 'go',
  }))
    expect(field.getAttribute(key)).toBe(value);
});

it('keeps the focused input in view when the visual viewport shrinks and resets keyboard space', async () => {
  const viewport = Object.assign(new EventTarget(), { height: 500, offsetTop: 0 });
  vi.stubGlobal('visualViewport', viewport);
  const { container } = mount();
  const field = await screen.findByRole('combobox');
  const scroll = vi.fn();
  field.scrollIntoView = scroll;
  field.focus();
  viewport.dispatchEvent(new Event('resize'));
  expect(scroll).toHaveBeenLastCalledWith({ block: 'center' });
  expect(
    (container.querySelector('.worldle') as HTMLElement).style.getPropertyValue(
      '--worldle-keyboard',
    ),
  ).toBe(`${window.innerHeight - 500}px`);
  field.blur();
  viewport.height = window.innerHeight;
  viewport.dispatchEvent(new Event('resize'));
  expect(
    (container.querySelector('.worldle') as HTMLElement).style.getPropertyValue(
      '--worldle-keyboard',
    ),
  ).toBe('0px');
});

it('matches aliases, supports keyboard selection and posts the canonical name with the date', async () => {
  mount();
  const field = await input('USA');
  expect(screen.getByRole('option', { name: 'United States' })).toBeTruthy();
  fireEvent.keyDown(field, { key: 'ArrowDown' });
  expect(field.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option').id);
  fireEvent.keyDown(field, { key: 'Enter' });
  expect((field as HTMLInputElement).value).toBe('United States');
  expect(screen.queryByRole('listbox')).toBeNull();
  fireEvent.submit(field.closest('form')!);
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith('POST /api/games/worldle/guess', {
      body: { guess: 'United States', date: DATE },
    }),
  );
  expect(await screen.findByText('1,000 km')).toBeTruthy();
});

it('cycles backward, caps suggestions at six, selects by tap and closes on Escape', async () => {
  mount();
  const field = await input('a');
  const options = screen.getAllByRole('option');
  expect(options).toHaveLength(6);
  fireEvent.keyDown(field, { key: 'ArrowUp' });
  expect(options[5].getAttribute('aria-selected')).toBe('true');
  fireEvent.keyDown(field, { key: 'Escape' });
  expect(screen.queryByRole('listbox')).toBeNull();
  fireEvent.change(field, { target: { value: 'UK' } });
  fireEvent.click(screen.getByRole('option', { name: 'United Kingdom' }));
  expect((field as HTMLInputElement).value).toBe('United Kingdom');
});

it.each([
  [
    'un',
    [
      'United Arab Emirates',
      'United Kingdom',
      'United States',
      'Tanzania',
      'U.S. Virgin Islands',
      'Brunei',
    ],
  ],
  ['kor', ['South Korea', 'North Korea']],
  ['usa', ['United States']],
  ['uk', ['United Kingdom', 'Ukraine']],
  ['ivory', ["Côte d'Ivoire"]],
  ['czech', ['Czechia']],
  ['congo', ['Republic of the Congo', 'Democratic Republic of the Congo']],
] as const)(
  'ranks %s by exact, name prefix, alias prefix, word start, then substring',
  async (query, names) => {
    mount();
    await input(query);
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(names);
  },
);

it('excludes duplicates including aliases and rejects duplicates or unknown names without posting', async () => {
  current.guesses = [row()];
  mount();
  const field = await input('USA');
  expect(screen.queryByRole('option', { name: 'United States' })).toBeNull();
  fireEvent.submit(field.closest('form')!);
  expect(screen.getByText('Already guessed. Choose another country.')).toBeTruthy();
  fireEvent.change(field, { target: { value: 'Atlantis' } });
  fireEvent.submit(field.closest('form')!);
  expect(screen.getByText('Choose a country from the suggestions.')).toBeTruthy();
  expect(vi.mocked(api).mock.calls.every(([path]) => !path.startsWith('POST'))).toBe(true);
});

it('renders distance, bearing and proximity, and persists miles across mounts', async () => {
  current.guesses = [row()];
  const view = mount();
  await screen.findByText('1,000 km');
  expect(screen.getByText('95%')).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Northeast' }).querySelector('svg')!.style.transform).toBe(
    'rotate(45deg)',
  );
  fireEvent.click(screen.getByRole('button', { name: 'mi' }));
  expect(screen.getByText('621 mi')).toBeTruthy();
  expect(localStorage.getItem('oyo:worldle:unit')).toBe('mi');
  view.unmount();
  mount();
  await screen.findByText('621 mi');
});

it('reports save failures without counting guesses or erasing the input', async () => {
  vi.mocked(api).mockImplementation(async (path) => {
    if (path.startsWith('POST')) throw new Error('No connection. Try again.');
    return current as never;
  });
  mount();
  const field = await input('USA');
  fireEvent.submit(field.closest('form')!);
  expect(await screen.findByText('No connection. Try again.')).toBeTruthy();
  expect((field as HTMLInputElement).value).toBe('USA');
  expect(screen.getAllByLabelText(/Guess \d, empty/)).toHaveLength(6);
});

it('refreshes the game and config roots on DAY_CHANGED without saving a guess', async () => {
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  vi.mocked(api).mockImplementation(async (path) => {
    if (path.startsWith('POST'))
      throw new ApiClientError(409, {
        code: 'DAY_CHANGED',
        message: 'A New Day Has Started. Reload to Play.',
      });
    return current as never;
  });
  mount();
  const field = await input('France');
  fireEvent.submit(field.closest('form')!);
  await screen.findByText('A New Day Has Started. Reload to Play.');
  expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.root('games') });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.root('config') });
  expect(screen.getAllByLabelText(/Guess \d, empty/)).toHaveLength(6);
});

it('notifies the server-complete frame after a final guess', async () => {
  const onComplete = vi.fn();
  vi.mocked(api).mockImplementation(async (path) => {
    if (path.startsWith('POST'))
      current = {
        ...current,
        guesses: [{ ...row('France'), km: 0, correct: true, proximity: 100 }],
        done: true,
        won: true,
        answer: { name: 'France', lat: 46.51, lon: 2.57 },
      };
    return current as never;
  });
  mount(<WorldlePlay date={DATE} onComplete={onComplete} />);
  const field = await input('France');
  fireEvent.submit(field.closest('form')!);
  await waitFor(() => expect(onComplete).toHaveBeenCalledWith({ guesses: ['France'] }));
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(screen.getByRole('img', { name: 'Correct' })).toBeTruthy();
});

it.each([
  ['France', 46.51, 2.57, 182.57, 43.49],
  ['Japan', 37.42, 137.6, 317.6, 52.58],
  ['United States', 39.89, -98.8, 81.2, 50.11],
  ['Australia', -25.77, 134.3, 314.3, 115.77],
])('projects %s on the exact equirectangular locator', (name, lat, lon, x, y) => {
  const { container } = mount(
    <WorldleReveal answer={{ name: String(name), lat: Number(lat), lon: Number(lon) }} />,
  );
  const map = screen.getByRole('img');
  expect(map.getAttribute('viewBox')).toBe('0 0 360 180');
  expect(Number(container.querySelector('circle')!.getAttribute('cx'))).toBeCloseTo(Number(x));
  expect(Number(container.querySelector('circle')!.getAttribute('cy'))).toBeCloseTo(Number(y));
});

it.each([true, false])(
  'reveals a finished game (won=%s) and shares no country names',
  async (won) => {
    current = {
      ...current,
      guesses: [{ ...row('France'), correct: won, km: won ? 0 : 1000, proximity: won ? 100 : 95 }],
      done: true,
      won,
      answer: { name: 'France', lat: 46.51, lon: 2.57 },
    };
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    vi.stubGlobal('scrollTo', vi.fn());
    vi.mocked(api).mockImplementation(async (path) => {
      if (path === 'GET /api/games/access') return current.access as never;
      if (path === 'GET /api/games/:game/results/me')
        return {
          game_id: 'worldle',
          date: DATE,
          score: won ? 6 : 0,
          payload: { solved: won, tries: 1, rows: current.guesses },
        } as never;
      if (path === 'GET /api/config') return { today: DATE } as never;
      if (path === 'GET /api/games/:game/leaderboard')
        return { date: DATE, rows: [], players: 0, final: false } as never;
      return current as never;
    });
    mount(<WorldleGame />);
    await screen.findByText(won ? 'Solved in 1/6' : 'Out of guesses');
    const answer = await screen.findByRole('region', { name: 'Answer' });
    expect(within(answer).getByRole('heading', { name: 'France' })).toBeTruthy();
    expect(
      screen.getByRole('img', { name: 'Country outline' }).getAttribute('aria-label'),
    ).not.toContain('France');
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain(`OYO Worldle ${DATE} ${won ? '1' : 'X'}/6`);
    expect(writeText.mock.calls[0][0]).not.toMatch(/France|United States/);
  },
);

it('uses the frame access gate instead of fetching a locked silhouette', async () => {
  vi.mocked(api).mockResolvedValue({ date: DATE, unlocked: false, reason: 'locked' } as never);
  mount(<WorldleGame />);
  expect(await screen.findByRole('link', { name: 'Log Workout' })).toBeTruthy();
  expect(screen.queryByRole('img', { name: 'Country outline' })).toBeNull();
  expect(vi.mocked(api).mock.calls.some(([path]) => path === 'GET /api/games/worldle/today')).toBe(
    false,
  );
});
