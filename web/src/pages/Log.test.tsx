// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createQueryClient } from '../lib/queryClient';
import { createMockApi } from '../mock/handlers';
import { ToastProvider } from '../components/ui';
import Log from './Log';
import { IDBFactory } from 'fake-indexeddb';
import { loadLogDraft, saveLogDraft } from '../lib/logDraftStore';
import { logDraft } from '../lib/logForm';
import { today } from '../../../shared/dates';
import { useLogout } from '../lib/queries';
import { clearCelebration, pendingCelebration } from '../lib/celebrations';
const clients: ReturnType<typeof createQueryClient>[] = [];
beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  cleanup();
  clients.forEach((c) => c.clear());
  clients.length = 0;
  vi.unstubAllGlobals();
  clearCelebration('user-1');
  localStorage.clear();
});
function setup(
  path = '/log',
  fail = false,
  options: {
    seasonFailure?: boolean;
    profileFailure?: boolean;
    best2k?: number | null;
    best6k?: number | null;
  } = {},
) {
  const mock = createMockApi();
  if (options.best2k !== undefined)
    mock.state.users.find((user) => user.id === 'user-1')!.best2k_split_s = options.best2k;
  if (options.best6k !== undefined)
    mock.state.users.find((user) => user.id === 'user-1')!.best6k_split_s = options.best6k;
  mock.state.imageLinks = {};
  const editId = mock.state.entries.find((e) => e.user_id === 'user-1')!.id;
  if (path === 'edit') {
    mock.state.tags[editId] = ['user-36', 'user-37', 'user-2'];
    path = `/log?edit=${editId}`;
  }
  let profileRequests = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: URL, init: RequestInit) => {
      if (
        new URL(String(url)).pathname === '/api/me' &&
        ++profileRequests === 2 &&
        options.profileFailure
      )
        return Promise.resolve(new Response(null, { status: 500 }));
      if (options.seasonFailure && String(url).includes('/api/stats/season'))
        return Promise.resolve(new Response(null, { status: 500 }));
      if (fail && init?.method === 'POST')
        return Promise.resolve(
          Response.json(
            { error: { code: 'REJECTED', message: 'Could not save session' } },
            { status: 409 },
          ),
        );
      return mock.handle(new Request(String(url), init));
    }),
  );
  const client = createQueryClient();
  clients.push(client);
  const router = createMemoryRouter(
    [
      { path: '/log', element: <Log /> },
      { path: '/', element: <h1>Training Home</h1> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { mock, router, editId };
}
it('links missing zone paces to test history on Me', async () => {
  setup('/log', false, { best2k: null, best6k: null });
  expect((await screen.findByRole('link', { name: 'Add a test on Me' })).getAttribute('href')).toBe(
    '/me#erg-tests',
  );
});
it('prefills validated personal plan values without changing the meter convention', async () => {
  setup('/log?modality=bike&zone=R%2FE&distance=12000');
  expect(((await screen.findByLabelText('Meters')) as HTMLInputElement).value).toBe('12000');
  expect(screen.getByRole('radio', { name: 'Bike' }).getAttribute('aria-checked')).toBe('true');
  expect((screen.getByRole('radio', { name: 'Zone R/E' }) as HTMLInputElement).checked).toBe(true);
});
it('ignores invalid prefill and does not apply it to presets or edits', async () => {
  setup('/log?modality=swim&zone=Z&distance=200001');
  expect(((await screen.findByLabelText('Meters')) as HTMLInputElement).value).toBe('');
  expect(screen.getByRole('radio', { name: 'Erg' }).getAttribute('aria-checked')).toBe('true');
});
it('previews and saves a valid session, with optional details', async () => {
  const { mock } = setup();
  const meters = await screen.findByLabelText('Meters');
  expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(meters, { target: { value: '12000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Details' }));
  fireEvent.change(screen.getByLabelText('Time'), { target: { value: '48:00' } });
  expect(screen.getByText('= 12,000 E-meters')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: 'Training Home' });
  expect(mock.state.entries.at(-1)?.avg_split_s).toBe(120);
  expect(screen.getByText('Session saved')).toBeTruthy();
});
it('captures both season snapshots and queues a derived split best after saving', async () => {
  const { mock } = setup('/log', false, { best2k: 130 });
  fireEvent.change(await screen.findByLabelText('Meters'), { target: { value: '2000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Details' }));
  fireEvent.change(screen.getByLabelText('Time'), { target: { value: '8:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: 'Training Home' });
  expect(pendingCelebration('user-1')?.kind).toBe('split-2k');
  expect(pendingCelebration('user-1')?.value).toBe(120);
  expect(mock.state.users.find((user) => user.id === 'user-1')?.best2k_split_s).toBe(130);
});
it('still saves and navigates when season snapshots fail, without a PR celebration', async () => {
  setup('/log', false, { seasonFailure: true });
  fireEvent.change(await screen.findByLabelText('Meters'), { target: { value: '2000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: 'Training Home' });
  expect(pendingCelebration('user-1')).toBeUndefined();
  expect(screen.getByText('Session saved')).toBeTruthy();
});
it('compares splits against a fresh pre-save profile rather than cached bests', async () => {
  const { mock } = setup('/log', false, { best2k: 130 });
  fireEvent.change(await screen.findByLabelText('Meters'), { target: { value: '2000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Details' }));
  fireEvent.change(screen.getByLabelText('Time'), { target: { value: '8:00' } });
  mock.state.users.find((user) => user.id === 'user-1')!.best2k_split_s = 100;
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: 'Training Home' });
  expect(pendingCelebration('user-1')?.kind).not.toBe('split-2k');
});
it('does not celebrate cached split bests when the fresh profile baseline fails', async () => {
  const { mock } = setup('/log', false, { best2k: 130, profileFailure: true });
  fireEvent.change(await screen.findByLabelText('Meters'), { target: { value: '2000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Details' }));
  fireEvent.change(screen.getByLabelText('Time'), { target: { value: '8:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: 'Training Home' });
  expect(pendingCelebration('user-1')?.kind).not.toBe('split-2k');
  expect(mock.state.entries.at(-1)?.distance_m).toBe(2000);
});
it('shows field errors before submit and disables Save at the worker bounds', async () => {
  setup();
  fireEvent.change(await screen.findByLabelText('Meters'), { target: { value: '1000' } });
  const save = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
  expect(save().disabled).toBe(false);
  for (const [label, value, message] of [
    ['Title', 'x'.repeat(121), 'Keep the title to 120 characters'],
    ['Notes', 'x'.repeat(2001), 'Keep notes to 2,000 characters'],
  ]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    expect(screen.getByText(message)).toBeTruthy();
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(label), { target: { value: '' } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Add Details' }));
  for (const [label, value, message] of [
    ['Stroke Rate', '61', 'Enter a whole stroke rate from 10 to 60'],
    ['Average HR', '241', 'Enter a whole heart rate from 30 to 240'],
    ['Time', '86401', 'Enter a duration from 1 second to 24 hours'],
    ['Split /500m', '10:00.1', 'Enter a split from 1:00.0 to 10:00.0'],
  ]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    expect(screen.getByText(message)).toBeTruthy();
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(label), { target: { value: '' } });
  }
  fireEvent.change(screen.getByLabelText('Time'), { target: { value: '1' } });
  expect(screen.getByText('Enter a split from 1:00.0 to 10:00.0')).toBeTruthy();
  expect(save().disabled).toBe(true);
});
it('retains a draft on failure and confirms unsaved cancellation', async () => {
  setup('/log', true);
  fireEvent.change(await screen.findByLabelText('Meters'), { target: { value: '12000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByText('Could not save session');
  expect((screen.getByLabelText('Meters') as HTMLInputElement).value).toBe('12000');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  const dialog = await screen.findByRole('dialog', { name: 'Discard Changes?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Keep Editing' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Discard Changes' }),
  );
  await screen.findByRole('heading', { name: 'Training Home' });
});
it('selects a formula preset and requests meters', async () => {
  setup();
  await screen.findByLabelText('Meters');
  fireEvent.click(screen.getByRole('button', { name: 'Choose From Workout Menu' }));
  const dialog = screen.getByRole('dialog', { name: 'Workout Menu' });
  const row = within(dialog).getByText('Enter meters rowed').closest('button')!;
  fireEvent.click(row);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect((screen.getByLabelText('Meters') as HTMLInputElement).value).toBe('');
  expect(screen.getByText('Enter meters rowed', { selector: 'p' })).toBeTruthy();
});
it('keeps one create and one key across double submit, automatic retry and manual retry', async () => {
  const { mock } = setup();
  const before = mock.state.entries.length;
  const keys: string[] = [];
  let attempts = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL, init: RequestInit) => {
      const request = new Request(String(url), init);
      if (request.method !== 'POST' || !request.url.endsWith('/api/entries'))
        return mock.handle(request);
      keys.push(request.headers.get('Idempotency-Key')!);
      const response = await mock.handle(request);
      attempts++;
      if (attempts === 1) throw new TypeError('Response lost');
      if (attempts === 2)
        return Response.json(
          { error: { code: 'REJECTED', message: 'Try saving again' } },
          { status: 409 },
        );
      return response;
    }),
  );
  fireEvent.change(await screen.findByLabelText('Meters'), { target: { value: '12000' } });
  const form = screen.getByRole('button', { name: 'Save' }).closest('form')!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  await screen.findByText('Try saving again');
  expect(attempts).toBe(2);
  expect(mock.state.entries).toHaveLength(before + 1);
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: 'Training Home' });
  expect(attempts).toBe(3);
  expect(keys[0]).toMatch(/^[a-f0-9-]{36}$/);
  expect(new Set(keys).size).toBe(1);
  expect(mock.state.entries).toHaveLength(before + 1);
});
it('loads an edit session and deletes only after confirmation', async () => {
  const { mock, editId } = setup('edit');
  await screen.findByRole('heading', { name: 'Edit Session' });
  fireEvent.click(screen.getByRole('button', { name: 'Delete Session' }));
  expect(mock.state.entries.some((e) => e.id === editId)).toBe(true);
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete Session' }),
  );
  await screen.findByRole('heading', { name: 'Training Home' });
  expect(mock.state.entries.some((e) => e.id === editId)).toBe(false);
});

it('selects teammates, excludes self, enforces ten and sends the full tag set', async () => {
  const { mock } = setup();
  fireEvent.change(await screen.findByLabelText('Meters'), { target: { value: '1000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tag Teammates' }));
  const dialog = screen.getByRole('dialog', { name: 'Tag Teammates' });
  await within(dialog).findByRole('button', { name: 'Kannan Alford' });
  expect(within(dialog).queryByRole('button', { name: 'Marcus Albrecht' })).toBeNull();
  fireEvent.change(within(dialog).getByLabelText('Search Teammates'), {
    target: { value: 'Kannan' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Kannan Alford' }));
  fireEvent.change(within(dialog).getByLabelText('Search Teammates'), { target: { value: '' } });
  const rows = within(dialog)
    .getAllByRole('button')
    .filter((b) => b.hasAttribute('aria-pressed'));
  for (const row of rows.filter((b) => b.getAttribute('aria-pressed') === 'false').slice(0, 9))
    fireEvent.click(row);
  expect(rows.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(10);
  expect(
    rows
      .filter((b) => b.getAttribute('aria-pressed') === 'false')
      .every((b) => (b as HTMLButtonElement).disabled),
  ).toBe(true);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: 'Training Home' });
  expect(mock.state.tags[mock.state.entries.at(-1)!.id]).toHaveLength(10);
});
it('prefills edit tags and replaces the full set on PATCH', async () => {
  const { mock, editId } = setup('edit');
  await screen.findByLabelText('Meters');
  expect(screen.getByRole('button', { name: /Tag Teammates.*3 Teammates/ })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Tag Teammates/ }));
  const dialog = screen.getByRole('dialog', { name: 'Tag Teammates' });
  const kannan = await within(dialog).findByRole('button', { name: 'Kannan Alford' });
  expect(kannan.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(kannan);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: 'Training Home' });
  expect(mock.state.tags[editId]).toEqual(['user-37', 'user-2']);
});
async function seedDraft() {
  await saveLogDraft('user-1', {
    draft: { ...logDraft(today()), distance: '8000', title: 'Stored Session' },
    details: true,
    tagged: [],
    photos: [],
    idempotencyKey: 'restored-key',
    savedAt: Date.now(),
  });
}
it('restores before showing fields, overrides URL prefill, preserves the key and clears after success', async () => {
  await seedDraft();
  const { mock } = setup('/log?modality=bike&zone=R&distance=12000');
  expect(screen.queryByLabelText('Meters')).toBeNull();
  expect(((await screen.findByLabelText('Meters')) as HTMLInputElement).value).toBe('8000');
  expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Stored Session');
  expect(screen.getByLabelText('Time')).toBeTruthy();
  expect(await screen.findByText('Draft Restored')).toBeTruthy();
  const before = mock.state.entries.length;
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: 'Training Home' });
  const requests = vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST');
  expect(requests).toHaveLength(1);
  expect(new Headers(requests[0][1]?.headers).get('Idempotency-Key')).toBe('restored-key');
  expect(mock.state.entries).toHaveLength(before + 1);
  expect(localStorage.getItem('oyo-log-draft:user-1')).toBeNull();
  expect(await loadLogDraft('user-1')).toBeNull();
});
it('discards a restored draft back to URL values and removes persisted state', async () => {
  await seedDraft();
  setup('/log?modality=bike&zone=R&distance=12000');
  await screen.findByText('Draft Restored');
  fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
  expect((screen.getByLabelText('Meters') as HTMLInputElement).value).toBe('12000');
  expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('');
  await waitFor(async () => expect(await loadLogDraft('user-1')).toBeNull());
});
it('flushes dirty values on pagehide, deletes clean state and clears on confirmed discard', async () => {
  setup();
  fireEvent.change(await screen.findByLabelText('Meters'), { target: { value: '6000' } });
  fireEvent(window, new Event('pagehide'));
  await waitFor(async () => expect((await loadLogDraft('user-1'))?.draft.distance).toBe('6000'));
  const key = (await loadLogDraft('user-1'))!.idempotencyKey;
  fireEvent.change(screen.getByLabelText('Meters'), { target: { value: '' } });
  await waitFor(async () => expect(await loadLogDraft('user-1')).toBeNull());
  fireEvent.change(screen.getByLabelText('Meters'), { target: { value: '7000' } });
  await waitFor(async () => expect((await loadLogDraft('user-1'))?.idempotencyKey).toBe(key));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Discard Changes' }),
  );
  await screen.findByRole('heading', { name: 'Training Home' });
  expect(await loadLogDraft('user-1')).toBeNull();
});
it('does not restore or overwrite new-entry drafts in edit mode', async () => {
  await seedDraft();
  setup('edit');
  await screen.findByLabelText('Meters');
  expect(screen.queryByText('Draft Restored')).toBeNull();
  fireEvent.change(screen.getByLabelText('Meters'), { target: { value: '5000' } });
  fireEvent(window, new Event('pagehide'));
  expect((await loadLogDraft('user-1'))?.draft.distance).toBe('8000');
});
it('keeps a saved draft and the short message after a NETWORK_ERROR', async () => {
  const { mock } = setup();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL, init: RequestInit) =>
      init.method === 'POST'
        ? Response.json(
            { error: { code: 'NETWORK_ERROR', message: 'No connection. Try again.' } },
            { status: 503 },
          )
        : mock.handle(new Request(String(url), init)),
    ),
  );
  fireEvent.change(await screen.findByLabelText('Meters'), { target: { value: '9000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByText('No connection. Draft saved.');
  expect((await loadLogDraft('user-1'))?.draft.distance).toBe('9000');
});
it('clears all users drafts after logout', async () => {
  await seedDraft();
  const stored = (await loadLogDraft('user-1'))!;
  await saveLogDraft('user-2', stored);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 204 })),
  );
  const client = createQueryClient();
  clients.push(client);
  const { result } = renderHook(() => useLogout(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  await act(async () => {
    await result.current.mutateAsync({});
  });
  expect(await loadLogDraft('user-1')).toBeNull();
  expect(await loadLogDraft('user-2')).toBeNull();
});
it('retains the key of a failed unmodified URL-prefilled submission across repeated reloads', async () => {
  const path = '/log?modality=bike&zone=R&distance=12000';
  const { mock } = setup(path);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL, init: RequestInit) =>
      init.method === 'POST'
        ? Response.json(
            { error: { code: 'NETWORK_ERROR', message: 'No connection' } },
            { status: 503 },
          )
        : mock.handle(new Request(String(url), init)),
    ),
  );
  await screen.findByLabelText('Meters');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByText('No connection. Draft saved.');
  const key = (await loadLogDraft('user-1'))!.idempotencyKey;
  for (let i = 0; i < 2; i++) {
    cleanup();
    setup(path);
    await screen.findByText('Draft Restored');
    fireEvent(window, new Event('pagehide'));
    expect((await loadLogDraft('user-1'))?.idempotencyKey).toBe(key);
  }
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: 'Training Home' });
  const post = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST')!;
  expect(new Headers(post[1]?.headers).get('Idempotency-Key')).toBe(key);
  expect(await loadLogDraft('user-1')).toBeNull();
});
