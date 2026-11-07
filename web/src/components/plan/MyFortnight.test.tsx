// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { Config } from '../../../../shared/types';
import { createQueryClient } from '../../lib/queryClient';
import { qk } from '../../lib/queries';
import { createMockApi } from '../../mock/handlers';
import { ToastProvider } from '../ui';
import Plan from '../../pages/Plan';
import { TodaysPlan } from './TodaysPlan';
const clients: ReturnType<typeof createQueryClient>[] = [];
beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
  vi.unstubAllGlobals();
});
async function setup(
  options: { home?: boolean; failWrite?: boolean; seed?: 'current' | 'next' | 'previous' } = {},
) {
  const mock = createMockApi({ now: () => new Date('2026-11-02T18:00:00Z') });
  mock.state.entries = [];
  const call = (path: string, method = 'GET', body?: unknown) =>
    mock.handle(
      new Request(`http://localhost${path}`, {
        method,
        ...(body
          ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
          : {}),
      }),
    );
  if (options.seed)
    await call('/api/me/plan', 'PUT', {
      start_date:
        options.seed === 'current'
          ? '2026-11-02'
          : options.seed === 'next'
            ? '2026-11-09'
            : '2026-10-19',
      sessions: [
        {
          week: 1,
          day: 0,
          slot: 'AM',
          modality: 'erg',
          zone: 'E',
          distance_m: 12000,
          note: 'Steady Row',
        },
      ],
      rest_days: [],
    });
  let release: (() => void) | undefined;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL, init: RequestInit) => {
      if (options.failWrite && init?.method === 'PUT') {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return new Response(JSON.stringify({ error: { code: 'CONFLICT', message: 'Overlap' } }), {
          status: 409,
        });
      }
      return mock.handle(new Request(String(url), init));
    }),
  );
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  const config = (await (await call('/api/config')).json()) as Config;
  client.setQueryData(qk.request('GET /api/config', {}), config);
  clients.push(client);
  const router = createMemoryRouter(
    [
      { path: '/plan', element: <Plan /> },
      { path: '/', element: <TodaysPlan today={config.today} /> },
    ],
    { initialEntries: [options.home ? '/' : '/plan?tab=mine'] },
  );
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { mock, call, client, release: () => release?.() };
}
it('starts blank, adds and edits a session with live totals, then deletes it', async () => {
  const { mock } = await setup();
  fireEvent.click(await screen.findByRole('button', { name: 'Start Plan' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Start Blank' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Add Session Monday Week 1' }));
  const sheet = screen.getByRole('dialog', { name: 'Add Session' });
  fireEvent.change(within(sheet).getByLabelText('Meters'), { target: { value: '12000' } });
  fireEvent.change(within(sheet).getByLabelText('Note'), { target: { value: 'Steady Row' } });
  await screen.findByText('12,000 / 80,000 E-meters');
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Edit AM Monday Week 1' }));
  const edit = screen.getByRole('dialog', { name: 'Edit Session' });
  fireEvent.click(within(edit).getByRole('radio', { name: 'Bike' }));
  fireEvent.change(within(edit).getByLabelText('Meters'), { target: { value: '30000' } });
  fireEvent.click(within(edit).getByRole('radio', { name: 'km' }));
  expect((within(edit).getByLabelText('Kilometers') as HTMLInputElement).value).toBe('30');
  await screen.findByText('10,000 / 80,000 E-meters');
  fireEvent.click(within(edit).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(mock.state.myPlans[0].sessions[0]).toMatchObject({ modality: 'bike', distance_m: 30000 });
  fireEvent.click(screen.getByRole('button', { name: 'Edit AM Monday Week 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete Session' }));
  await waitFor(() => expect(mock.state.myPlans[0].sessions).toEqual([]));
});
it('validates distance, exposes only free slots and hides Add at three sessions', async () => {
  await setup({ seed: 'current' });
  fireEvent.click(await screen.findByRole('button', { name: 'Add Session Monday Week 1' }));
  let sheet = screen.getByRole('dialog');
  expect(within(sheet).queryByRole('radio', { name: 'AM' })).toBeNull();
  fireEvent.change(within(sheet).getByLabelText('Meters'), { target: { value: '0' } });
  expect((within(sheet).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  fireEvent.change(within(sheet).getByLabelText('Meters'), { target: { value: '' } });
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Add Session Monday Week 1' }));
  sheet = screen.getByRole('dialog');
  expect(
    within(sheet)
      .getAllByRole('radio')
      .filter((el) => /^(AM|PM1|PM2)$/.test(el.textContent ?? '')),
  ).toHaveLength(1);
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.queryByRole('button', { name: 'Add Session Monday Week 1' })).toBeNull();
});
it('confirms before removing sessions for a rest day and clears rest from the same menu', async () => {
  const { mock } = await setup({ seed: 'current' });
  fireEvent.click(await screen.findByRole('button', { name: 'Monday Week 1 Options' }));
  fireEvent.click(screen.getByRole('button', { name: 'Rest Day' }));
  expect(mock.state.myPlans[0].sessions).toHaveLength(1);
  fireEvent.click(
    within(screen.getByRole('dialog', { name: 'Mark Rest Day' })).getByRole('button', {
      name: 'Cancel',
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Monday Week 1 Options' }));
  fireEvent.click(screen.getByRole('button', { name: 'Rest Day' }));
  fireEvent.click(
    within(screen.getByRole('dialog', { name: 'Mark Rest Day' })).getByRole('button', {
      name: 'Rest Day',
    }),
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(mock.state.myPlans[0].sessions).toHaveLength(0);
  expect(screen.getByText('Rest')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Add Session Monday Week 1' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Monday Week 1 Options' }));
  fireEvent.click(screen.getByRole('button', { name: 'Clear Rest Day' }));
  await screen.findByRole('button', { name: 'Add Session Monday Week 1' });
});
it('shows the upcoming plan instead of empty controls', async () => {
  await setup({ seed: 'next' });
  await screen.findByText('Nov 9 – Nov 22');
  expect(screen.queryByRole('button', { name: 'Start Blank' })).toBeNull();
});
it('offers the just-ended fortnight and repeats into this week', async () => {
  const { mock } = await setup({ seed: 'previous' });
  fireEvent.click(await screen.findByRole('button', { name: 'Start Plan' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Repeat Fortnight' }));
  await screen.findByText('Nov 2 – Nov 15');
  expect(mock.state.myPlans.at(-1)).toMatchObject({
    start_date: '2026-11-02',
    sessions: [{ note: 'Steady Row' }],
  });
});
it('deletes a plan only after confirmation', async () => {
  const { mock } = await setup({ seed: 'current' });
  fireEvent.click(await screen.findByRole('button', { name: 'More' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete Plan' }));
  expect(mock.state.myPlans).toHaveLength(1);
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete Plan' }));
  await screen.findByRole('button', { name: 'Start Plan' });
  expect(mock.state.myPlans).toHaveLength(0);
});
it('optimistically updates every matching date query, rolls back on 409 and retains the sheet draft', async () => {
  const { client, release } = await setup({ seed: 'current', failWrite: true });
  fireEvent.click(await screen.findByRole('button', { name: 'Edit AM Monday Week 1' }));
  const before = client.getQueryData(qk.myPlan());
  client.setQueryData(qk.myPlan('2026-11-03'), before);
  fireEvent.change(screen.getByLabelText('Meters'), { target: { value: '6000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(client.getQueryData(qk.myPlan('2026-11-03'))).toMatchObject({ planned_m: [6000, 0] }),
  );
  release();
  await screen.findByText('Plan Overlap');
  expect(client.getQueryData(qk.myPlan('2026-11-03'))).toEqual(before);
  expect((screen.getByLabelText('Meters') as HTMLInputElement).value).toBe('6000');
});
it.each(['Meters', 'Note'])(
  'keeps optimistic completion consistent when editing %s',
  async (field) => {
    const { client, call, release } = await setup({ seed: 'current', failWrite: true });
    await screen.findByRole('button', { name: 'Edit AM Monday Week 1' });
    const entry = await (
      await call('/api/entries', 'POST', {
        date: '2026-11-02',
        modality: 'erg',
        zone: 'E',
        distance_m: 12000,
        title: 'Steady',
        notes: '',
      })
    ).json();
    await client.invalidateQueries({ queryKey: qk.myPlans() });
    await screen.findByRole('link', { name: 'View Completed AM Monday Week 1' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit AM Monday Week 1' }));
    fireEvent.change(screen.getByLabelText(field), {
      target: { value: field === 'Meters' ? '24000' : 'New note' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(client.getQueryData(qk.myPlan())).toMatchObject({
        sessions: [
          {
            note: field === 'Meters' ? 'Steady Row' : 'New note',
            distance_m: field === 'Meters' ? 24000 : 12000,
            completed_entry_id: field === 'Meters' ? null : entry.id,
          },
        ],
      }),
    );
    release();
    await screen.findByText('Plan Overlap');
    expect(client.getQueryData(qk.myPlan())).toMatchObject({
      sessions: [{ completed_entry_id: entry.id }],
    });
  },
);

it('shows today’s prefilled log link and replaces it with the completed workout link', async () => {
  const { client, call } = await setup({ seed: 'current', home: true });
  await screen.findByRole('heading', { name: "Today's Plan" });
  expect((await screen.findByRole('link', { name: /Steady Row/ })).getAttribute('href')).toBe(
    '/log?modality=erg&zone=E&distance=12000',
  );
  const entry = await (
    await call('/api/entries', 'POST', {
      date: '2026-11-02',
      modality: 'erg',
      zone: 'E',
      distance_m: 12000,
      title: 'Steady',
      notes: '',
    })
  ).json();
  await client.invalidateQueries({ queryKey: qk.myPlans() });
  await waitFor(() =>
    expect(screen.getByRole('link', { name: /Steady Row/ }).getAttribute('href')).toBe(
      `/entries/${entry.id}`,
    ),
  );
  expect(screen.getByLabelText('Completed')).toBeTruthy();
});
it('keeps the completed check inside the edit button and the entry link separate', async () => {
  const { client, call } = await setup({ seed: 'current' });
  await screen.findByRole('button', { name: 'Edit AM Monday Week 1' });
  const entry = await (
    await call('/api/entries', 'POST', {
      date: '2026-11-02',
      modality: 'erg',
      zone: 'E',
      distance_m: 12000,
      title: 'Steady',
      notes: '',
    })
  ).json();
  await client.invalidateQueries({ queryKey: qk.myPlans() });
  const link = await screen.findByRole('link', { name: 'View Completed AM Monday Week 1' });
  const button = screen.getByRole('button', { name: 'Edit AM Monday Week 1' });
  expect(within(button).getByLabelText('Completed')).toBeTruthy();
  expect(link.getAttribute('href')).toBe(`/entries/${entry.id}`);
  expect(button.contains(link)).toBe(false);
  fireEvent.click(button);
  expect(screen.getByRole('dialog', { name: 'Edit Session' })).toBeTruthy();
});
it('links to both fortnights from Home without a current plan', async () => {
  const { client } = await setup({ home: true });
  await waitFor(() => expect(client.getQueryData(qk.myPlan())).toBeNull());
  expect(screen.getByRole('heading', { name: "Today's Plan" })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Sample Fortnight' }).getAttribute('href')).toBe('/plan');
  fireEvent.click(screen.getByRole('link', { name: 'My Fortnight' }));
  expect(await screen.findByRole('button', { name: 'Start Plan' })).toBeTruthy();
});
it('shows Nothing Planned or Rest Day with the My Fortnight link', async () => {
  const { call, client } = await setup({ home: true });
  await waitFor(() => expect(client.getQueryData(qk.myPlan())).toBeNull());
  await call('/api/me/plan', 'PUT', { start_date: '2026-11-02', sessions: [], rest_days: [] });
  await client.invalidateQueries({ queryKey: qk.myPlans() });
  expect((await screen.findByRole('link', { name: 'Edit Plan' })).getAttribute('href')).toBe(
    '/plan?tab=mine',
  );
  await call('/api/me/plan', 'PUT', {
    start_date: '2026-11-02',
    sessions: [],
    rest_days: [{ week: 1, day: 0 }],
  });
  await client.invalidateQueries({ queryKey: qk.myPlans() });
  await screen.findByText('Rest Day');
});
