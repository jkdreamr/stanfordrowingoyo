// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../lib/queryClient';
import { createMockApi } from '../mock/handlers';
import { qk } from '../lib/queries';
import { ToastProvider } from '../components/ui';
import Home from './Home';
import EntryDetail from './EntryDetail';
import Log from './Log';

const clients: ReturnType<typeof createQueryClient>[] = [];
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
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
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup(
  scope: 'home' | 'other' | 'missing' = 'home',
  options: { staff?: boolean; failDelete?: boolean } = {},
) {
  const mock = createMockApi({
    now: () => new Date('2026-11-06T18:00:00Z'),
    session: options.staff ? 'user-39' : 'user-1',
  });
  const entry = mock.state.entries.find((e) => e.user_id === 'user-1' && e.date >= '2026-11-02')!;
  entry.title = 'Evening Erg';
  const other = mock.state.entries.find((e) => e.user_id !== 'user-1' && e.visibility === 'team')!;
  const requests: { method: string; path: string; status: number }[] = [];
  const fetcher = vi.fn(async (url: URL, init: RequestInit) => {
    const response =
      options.failDelete && init.method === 'DELETE'
        ? new Response(
            JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Unavailable' } }),
            { status: 500 },
          )
        : await mock.handle(new Request(String(url), init));
    requests.push({ method: init.method ?? 'GET', path: url.pathname, status: response.status });
    return response;
  });
  vi.stubGlobal('fetch', fetcher);
  const client = createQueryClient();
  clients.push(client);
  const router = createMemoryRouter(
    [
      { path: '/', element: <Home /> },
      { path: '/entries/:id', element: <EntryDetail /> },
      { path: '/log', element: <Log /> },
      { path: '/feed', element: <h1>Feed</h1> },
    ],
    {
      initialEntries: [
        scope === 'home' ? '/' : `/entries/${scope === 'other' ? other.id : 'missing'}`,
      ],
    },
  );
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { entry, router, client, mock, requests };
}
it('keeps Home rows linked to detail and reaches a prefilled own-session editor', async () => {
  const { entry, router } = setup();
  const row = await screen.findByRole('link', { name: /Evening Erg/ });
  expect(row.getAttribute('href')).toBe(`/entries/${entry.id}`);
  fireEvent.click(row);
  fireEvent.click(await screen.findByRole('button', { name: 'More' }));
  fireEvent.click(await screen.findByRole('link', { name: 'Edit Workout' }));
  await screen.findByRole('heading', { name: 'Edit Session' });
  expect(router.state.location.pathname).toBe('/log');
  expect(router.state.location.search).toBe(`?edit=${entry.id}`);
  expect(((await screen.findByLabelText('Title')) as HTMLInputElement).value).toBe(entry.title);
  expect((screen.getByLabelText('Meters') as HTMLInputElement).value).toBe(
    String(entry.distance_m),
  );
  expect(screen.getByRole('button', { name: 'Delete Session' })).toBeTruthy();
});
for (const scope of ['other', 'missing'] as const) {
  it(`limits workout actions for ${scope} entries`, async () => {
    const { client } = setup(scope);
    await screen.findByRole('heading', {
      name: scope === 'missing' ? 'Workout Not Found' : 'Workout',
    });
    await waitFor(() => expect(client.isFetching()).toBe(0));
    if (scope === 'missing') expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
    else {
      fireEvent.click(screen.getByRole('button', { name: 'More' }));
      expect(await screen.findByRole('button', { name: 'Report Workout' })).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'Edit Workout' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Delete Workout' })).toBeNull();
    }
  });
}

it('opens the With sheet and inserts, posts and links selected mentions', async () => {
  const { mock, router } = setup();
  await screen.findByText('Evening Erg');
  await router.navigate(
    '/entries/' + mock.state.entries.find((e) => e.title === 'Evening Erg')!.id,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'with Kannan Alford and 2 others' }));
  expect((await screen.findByRole('link', { name: 'Kannan Alford' })).getAttribute('href')).toBe(
    '/users/user-36',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  const composer = await screen.findByRole('combobox', { name: 'Comment' });
  fireEvent.change(composer, { target: { value: '@Kan', selectionStart: 4 } });
  await screen.findByRole('option', { name: 'Kannan Alford' });
  fireEvent.keyDown(composer, { key: 'ArrowDown' });
  fireEvent.keyDown(composer, { key: 'ArrowUp' });
  fireEvent.keyDown(composer, { key: 'Escape' });
  expect(screen.queryByRole('listbox')).toBeNull();
  fireEvent.change(composer, { target: { value: '@Kanna', selectionStart: 6 } });
  fireEvent.keyDown(composer, { key: 'Enter' });
  expect((composer as HTMLTextAreaElement).value).toBe('@Kannan Alford ');
  fireEvent.click(screen.getByRole('button', { name: 'Post Comment' }));
  const link = await screen.findByRole('link', { name: '@Kannan Alford' });
  expect(link.getAttribute('href')).toBe('/users/user-36');
  const posted = mock.state.comments.at(-1)!;
  expect(mock.state.mentions[posted.id]).toEqual(['user-36']);
});

it('edits only own comments, cancels drafts and shows edited after saving', async () => {
  const { mock, router, entry } = setup();
  mock.state.comments.push({
    id: 'own-comment',
    user_id: 'user-1',
    entry_id: entry.id,
    body: 'Original comment',
    created_at: '2026-11-06T17:00:00Z',
  });
  mock.state.comments.push({
    id: 'other-comment',
    user_id: 'user-2',
    entry_id: entry.id,
    body: 'Other comment',
    created_at: '2026-11-06T17:00:00Z',
  });
  await router.navigate(`/entries/${entry.id}`);
  const own = (await screen.findByText('Original comment')).closest('li')!;
  const other = screen.getByText('Other comment').closest('li')!;
  expect(within(other).queryByRole('button', { name: 'Edit' })).toBeNull();
  fireEvent.click(within(own).getByRole('button', { name: 'Edit' }));
  let editor = screen.getByRole('form', { name: 'Edit Comment' });
  fireEvent.change(within(editor).getByRole('combobox'), { target: { value: 'Discard me' } });
  fireEvent.click(within(editor).getByRole('button', { name: 'Cancel' }));
  expect(mock.state.comments.find((c) => c.id === 'own-comment')!.body).toBe('Original comment');
  fireEvent.click(within(own).getByRole('button', { name: 'Edit' }));
  editor = screen.getByRole('form', { name: 'Edit Comment' });
  fireEvent.change(within(editor).getByRole('combobox'), { target: { value: 'Updated comment' } });
  fireEvent.click(within(editor).getByRole('button', { name: 'Save' }));
  await screen.findByText('Updated comment');
  expect(within(own).getByText(/edited/)).toBeTruthy();
});

it('reports another workout with an optional reason', async () => {
  const { mock } = setup('other');
  fireEvent.click(await screen.findByRole('button', { name: 'More' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Report Workout' }));
  const sheet = screen.getByRole('dialog', { name: 'Report Workout' });
  fireEvent.change(within(sheet).getByLabelText('Reason (Optional)'), {
    target: { value: 'Please review' },
  });
  fireEvent.click(within(sheet).getByRole('button', { name: 'Send Report' }));
  await screen.findByText('Report sent');
  expect(mock.state.notifications.some((n) => n.kind === 'report' && n.actor_id === 'user-1')).toBe(
    true,
  );
});

for (const staff of [false, true]) {
  it(`deletes a workout as ${staff ? 'staff' : 'owner'} without refetching removed detail or comments`, async () => {
    const { entry, router, client, requests } = setup('home', { staff });
    await router.navigate(`/entries/${entry.id}`);
    await screen.findByText('Evening Erg');
    await waitFor(() => expect(client.isFetching()).toBe(0));
    const before = requests.filter(
      (r) => r.method === 'GET' && r.path.startsWith(`/api/entries/${entry.id}`),
    ).length;
    const cancel = vi.spyOn(client, 'cancelQueries');
    const remove = vi.spyOn(client, 'removeQueries');
    const kudos = qk.request('GET /api/entries/:id/kudos', { params: { id: entry.id } });
    client.setQueryData(kudos, []);
    client.setQueryData(qk.entries(), { pages: [], pageParams: [] });
    client.setQueryData(qk.audit(), { pages: [], pageParams: [] });
    fireEvent.click(await screen.findByRole('button', { name: 'More' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Workout' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete Workout' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/feed'));
    expect(requests.some((r) => r.method === 'DELETE' && r.status === 204)).toBe(true);
    expect(requests.some((r) => r.status === 404)).toBe(false);
    expect(
      requests.filter((r) => r.method === 'GET' && r.path.startsWith(`/api/entries/${entry.id}`)),
    ).toHaveLength(before);
    for (const queryKey of [qk.entry(entry.id), qk.comments(entry.id), kudos]) {
      expect(cancel).toHaveBeenCalledWith({ queryKey, exact: true });
      expect(remove).toHaveBeenCalledWith({ queryKey, exact: true });
      expect(client.getQueryData(queryKey)).toBeUndefined();
    }
    expect(client.getQueryState(qk.entries())?.isInvalidated).toBe(true);
    expect(client.getQueryState(qk.audit())?.isInvalidated).toBe(true);
  });
}
it('retains the workout and comments when deletion fails', async () => {
  const { entry, router, client, requests } = setup('home', { failDelete: true });
  await router.navigate(`/entries/${entry.id}`);
  await screen.findByText('Evening Erg');
  fireEvent.click(await screen.findByRole('button', { name: 'More' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Delete Workout' }));
  fireEvent.click(
    within(await screen.findByRole('dialog', { name: 'Delete Workout' })).getByRole('button', {
      name: 'Delete',
    }),
  );
  await screen.findByText('Could not delete. Try again');
  expect(router.state.location.pathname).toBe(`/entries/${entry.id}`);
  expect(client.getQueryData(qk.entry(entry.id))).toBeTruthy();
  expect(client.getQueryData(qk.comments(entry.id))).toBeDefined();
  expect(requests.some((r) => r.status === 404)).toBe(false);
});
it('deletes a comment and refreshes the surviving workout discussion without 404s', async () => {
  const { entry, router, mock, client, requests } = setup();
  mock.state.comments = [
    {
      id: 'qa-comment',
      entry_id: entry.id,
      user_id: 'user-1',
      body: 'Remove this comment',
      created_at: '2026-11-06T18:00:00Z',
    },
  ];
  await router.navigate(`/entries/${entry.id}`);
  await screen.findByText('Remove this comment');
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  fireEvent.click(
    within(await screen.findByRole('dialog', { name: 'Delete Comment' })).getByRole('button', {
      name: 'Delete',
    }),
  );
  await screen.findByText('Comment deleted');
  expect(screen.queryByText('Remove this comment')).toBeNull();
  expect(client.getQueryData(qk.entry(entry.id))).toBeTruthy();
  expect(client.getQueryData(qk.comments(entry.id))).toEqual([]);
  expect(requests.some((r) => r.status === 404)).toBe(false);
  expect(router.state.location.pathname).toBe(`/entries/${entry.id}`);
});
