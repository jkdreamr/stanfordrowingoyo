// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { TeamChallenge } from '../../../../shared/types';
import { createQueryClient } from '../../lib/queryClient';
import { createMockApi } from '../../mock/handlers';
import { ToastProvider } from '../../components/ui';
import { TeamChallenges, ChallengeProgress } from '../../components/TeamChallenges';
import Challenges from './Challenges';
const clients: ReturnType<typeof createQueryClient>[] = [];
beforeEach(() => {
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
  clients.splice(0).forEach((c) => c.clear());
  vi.unstubAllGlobals();
});
function mount(node: React.ReactNode, fail = false, rows?: TeamChallenge[]) {
  const mock = createMockApi({ now: () => new Date('2026-11-06T18:00:00Z'), session: 'user-39' });
  const fetch = vi.fn((url: URL, init: RequestInit) =>
    fail && init.method === 'POST'
      ? Promise.reject(new Error('Unavailable'))
      : rows && url.pathname === '/api/challenges'
        ? Promise.resolve(new Response(JSON.stringify(rows)))
        : mock.handle(new Request(String(url), init)),
  );
  vi.stubGlobal('fetch', fetch);
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  clients.push(client);
  return {
    ...render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <ToastProvider>{node}</ToastProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
    fetch,
    mock,
  };
}
it('creates, edits, ends and deletes through mock routes', async () => {
  const { fetch } = mount(<Challenges />);
  await screen.findByText('No Challenges Yet');
  fireEvent.click(screen.getByRole('button', { name: 'New Challenge' }));
  let sheet = await screen.findByRole('dialog', { name: 'New Challenge' });
  expect(
    (within(sheet).getByRole('button', { name: 'Save Challenge' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  fireEvent.change(within(sheet).getByLabelText('Title'), { target: { value: 'Team Distance' } });
  fireEvent.change(within(sheet).getByLabelText('Goal'), { target: { value: '1.001' } });
  expect(
    (within(sheet).getByRole('button', { name: 'Save Challenge' }) as HTMLButtonElement).disabled,
  ).toBe(false);
  fireEvent.click(within(sheet).getByRole('radio', { name: 'km' }));
  expect((within(sheet).getByLabelText('Goal') as HTMLInputElement).value).toBe('1.001');
  fireEvent.change(within(sheet).getByLabelText('Goal'), { target: { value: '5000' } });
  fireEvent.change(within(sheet).getByLabelText('End Date'), { target: { value: '2026-11-18' } });
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save Challenge' }));
  await screen.findByText('Challenge Created');
  const article = screen.getByRole('article', { name: 'Team Distance' });
  expect(within(article).getByText('Active')).toBeTruthy();
  const create = fetch.mock.calls.find(([, init]) => init.method === 'POST');
  expect(JSON.parse(String(create?.[1].body)).goal_m).toBe(5000000);
  fireEvent.click(within(article).getByRole('button', { name: 'Edit' }));
  sheet = await screen.findByRole('dialog', { name: 'Edit Challenge' });
  fireEvent.click(within(sheet).getByRole('radio', { name: 'E-meters' }));
  expect((within(sheet).getByLabelText('Goal') as HTMLInputElement).value).toBe('5000000');
  fireEvent.change(within(sheet).getByLabelText('Goal'), { target: { value: '900000' } });
  fireEvent.change(within(sheet).getByLabelText('Modality'), { target: { value: 'erg' } });
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save Challenge' }));
  await screen.findByText('Challenge Updated');
  expect(article.textContent).toContain('900,000 E-meters');
  fireEvent.click(within(article).getByRole('button', { name: 'End Challenge' }));
  let confirm = await screen.findByRole('dialog', { name: 'End Challenge?' });
  fireEvent.click(within(confirm).getByRole('button', { name: 'End Challenge' }));
  await screen.findByText('Challenge Ended');
  expect(within(article).queryByRole('button', { name: 'Edit' })).toBeNull();
  expect(within(article).getByText('Ended')).toBeTruthy();
  fireEvent.click(within(article).getByRole('button', { name: 'Delete' }));
  confirm = await screen.findByRole('dialog', { name: 'Delete Challenge?' });
  fireEvent.click(within(confirm).getByRole('button', { name: 'Delete Challenge' }));
  await screen.findByText('Challenge Deleted');
  await screen.findByText('No Challenges Yet');
});
it('preserves drafts when create fails', async () => {
  mount(<Challenges />, true);
  await screen.findByText('No Challenges Yet');
  fireEvent.click(screen.getByRole('button', { name: 'New Challenge' }));
  const sheet = await screen.findByRole('dialog', { name: 'New Challenge' });
  fireEvent.change(within(sheet).getByLabelText('Title'), { target: { value: 'Team Distance' } });
  fireEvent.change(within(sheet).getByLabelText('Goal'), { target: { value: '5' } });
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save Challenge' }));
  await screen.findByText('Unavailable');
  expect((within(sheet).getByLabelText('Title') as HTMLInputElement).value).toBe('Team Distance');
});
const row = {
  id: 'challenge',
  title: 'Team Distance',
  unit: 'km',
  goal_m: 5000000,
  progress_m: 6000000,
  percent: 120,
  status: 'active',
  end_date: '2026-11-18',
} as TeamChallenge;
it('caps the progress bar and highlights reached goals, with days left', async () => {
  mount(<TeamChallenges today="2026-11-06" />, false, [row]);
  const bar = await screen.findByRole('progressbar', { name: 'Team Distance' });
  expect(bar.getAttribute('aria-valuenow')).toBe('5000000');
  expect((bar.firstElementChild as HTMLElement).style.width).toBe('100%');
  expect((bar.firstElementChild as HTMLElement).style.background).toBe('var(--highlight)');
  expect(screen.getByText('6,000 / 5,000 km')).toBeTruthy();
  expect(screen.getByText('12 Days Left')).toBeTruthy();
});
it('shows Last Day and cardinal progress below the goal', () => {
  const { container } = render(
    <ChallengeProgress challenge={{ ...row, progress_m: 1000, percent: 0.02 }} />,
  );
  expect(
    (container.querySelector('[role="progressbar"] > div') as HTMLElement).style.background,
  ).toBe('var(--accent)');
});
it('hides none/upcoming challenges and shows Last Day for active end date', async () => {
  const empty = mount(<TeamChallenges today="2026-11-06" />, false, []);
  await waitFor(() => expect(clients.at(-1)!.isFetching()).toBe(0));
  expect(screen.queryByRole('region', { name: 'Team Challenges' })).toBeNull();
  empty.unmount();
  const hidden = mount(<TeamChallenges today="2026-11-06" />, false, [
    { ...row, status: 'upcoming' },
  ]);
  await waitFor(() => expect(clients.at(-1)!.isFetching()).toBe(0));
  expect(screen.queryByRole('region', { name: 'Team Challenges' })).toBeNull();
  hidden.unmount();
  mount(<TeamChallenges today="2026-11-18" />, false, [row]);
  await screen.findByText('Last Day');
});
