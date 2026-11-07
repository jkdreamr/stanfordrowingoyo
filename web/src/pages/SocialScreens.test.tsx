// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type {
  Announcement,
  EntryDetail,
  Notification,
  Profile,
  PublicUser,
} from '../../../shared/types';
import { ApiClientError } from '../lib/api';
import RowerProfile from './RowerProfile';
import Team from './Team';
import Notifications from './Notifications';
import { PageHeader } from '../components/ui';

const state = vi.hoisted(() => ({
  profile: undefined as Profile | undefined,
  error: null as Error | null,
  directoryError: null as Error | null,
  directoryPending: false,
  entries: [] as EntryDetail[],
  users: [] as PublicUser[],
  notifications: [] as Notification[],
  announcements: [] as Announcement[],
  scope: vi.fn(),
  read: vi.fn(),
  retry: vi.fn(),
  chart: vi.fn(),
  profileRequest: vi.fn(),
}));
vi.mock('../lib/queries', () => ({
  useProfile: (id: string, enabled: boolean) => {
    state.profileRequest(id, enabled);
    return {
      data: state.profile,
      error: state.error,
      isError: !!state.error,
      refetch: state.retry,
    };
  },
  useEntries: (scope: string, enabled: boolean) => {
    state.scope(scope, enabled);
    return { data: { pages: [{ items: state.entries }] }, hasNextPage: false };
  },
  useMe: () => ({ data: { id: 'viewer' } }),
  useConfig: () => ({ data: undefined }),
  useUsers: () => ({
    data: state.directoryError || state.directoryPending ? undefined : state.users,
    isError: !!state.directoryError,
    refetch: state.retry,
  }),
  useNotifications: () => ({
    data: state.error ? undefined : state.notifications,
    isError: !!state.error,
    refetch: state.retry,
  }),
  useReadNotifications: () => ({ mutate: state.read }),
  useAnnouncements: () => ({ data: state.announcements }),
}));
vi.mock('../components/social/EntryCard', () => ({
  EntryCard: ({ entry }: { entry: EntryDetail }) => <article>{entry.title}</article>,
}));
vi.mock('../components/ui/SeasonChart', () => ({
  SeasonChart: (props: { userId: string; isMe: boolean }) => {
    state.chart(props);
    return <section aria-label="Season Mileage" />;
  },
}));
const user = {
  id: 'author',
  name: 'José Alvarez',
  role: 'rower',
  side: 'port',
  class_year: 2027,
  group_key: 'u23',
  bio: 'Steady work',
  avatar_image_id: null,
  active: true,
} as PublicUser;
const profile = {
  user: { ...user, email: 'private@example.com', password_hash: 'not-public' },
  stats: { total_m: 42000, weeks: [], streak: 3, best_week: null },
} as unknown as Profile;
let onHeaderIntersection: IntersectionObserverCallback;
beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        onHeaderIntersection = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  state.profile = profile;
  state.error = null;
  state.directoryError = null;
  state.directoryPending = false;
  state.entries = [];
  state.users = [user];
  state.notifications = [];
  state.announcements = [];
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function profileScreen() {
  return (
    <MemoryRouter initialEntries={['/users/author']}>
      <Routes>
        <Route path="/users/:id" element={<RowerProfile />} />
      </Routes>
    </MemoryRouter>
  );
}
it('uses only the public identity, server streak and user-scoped API entries', () => {
  state.entries = [{ id: 'public', title: 'Public Row' }] as EntryDetail[];
  const { container } = render(profileScreen());
  expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: user.name })).toBeTruthy();
  expect(screen.getByText('3 weeks').className).toContain('text-highlight-ink');
  expect(screen.getByText('Public Row')).toBeTruthy();
  expect(state.scope).toHaveBeenCalledWith('user:author', true);
  expect(state.chart).toHaveBeenCalledWith({ userId: 'author', isMe: false });
  expect(screen.getByRole('region', { name: 'Season Mileage' })).toBeTruthy();
  expect(screen.getByText('Season Total')).toBeTruthy();
  expect(screen.getByText('Best Week')).toBeTruthy();
  expect(container.textContent).not.toMatch(/private@example.com|not-public/);
  expect(screen.queryByRole('link', { name: 'Edit Profile' })).toBeNull();
});
it('shows empty workouts and handles a missing or failed profile', () => {
  const view = render(profileScreen());
  expect(screen.getByText('No Workouts Yet')).toBeTruthy();
  state.profile = undefined;
  state.error = new ApiClientError(404, { code: 'NOT_FOUND', message: 'Missing' });
  view.rerender(profileScreen());
  expect(screen.getByText('Rower Not Found')).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'Season Mileage' })).toBeNull();
  state.error = new Error('offline');
  view.rerender(profileScreen());
  fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
  expect(state.retry).toHaveBeenCalledOnce();
});
it('shows a departed-user state without enabling profile, workouts or charts', () => {
  state.users = [];
  render(profileScreen());
  expect(screen.getByText('No Longer On The Team')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'View Team' }).getAttribute('href')).toBe('/team');
  expect(state.profileRequest).toHaveBeenCalledWith('author', false);
  expect(state.scope).toHaveBeenCalledWith('user:author', false);
  expect(state.chart).not.toHaveBeenCalled();
});
it('waits for team membership and retries directory failures without per-user requests', () => {
  state.directoryPending = true;
  const view = render(profileScreen());
  expect(state.profileRequest).toHaveBeenLastCalledWith('author', false);
  expect(state.scope).toHaveBeenLastCalledWith('user:author', false);
  state.directoryPending = false;
  state.directoryError = new Error('offline');
  view.rerender(profileScreen());
  fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
  expect(state.retry).toHaveBeenCalledOnce();
  expect(state.chart).not.toHaveBeenCalled();
});
it('searches names case- and diacritic-insensitively with empty and error states', () => {
  state.users = [user, { ...user, id: 'coach', name: 'Coach Lee', role: 'coach' }];
  const view = render(
    <MemoryRouter>
      <Team />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: 'Coxswains & Staff' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Search Team'), { target: { value: 'JOSE' } });
  expect(screen.getByRole('link', { name: /José/ }).getAttribute('href')).toBe('/users/author');
  expect(screen.queryByText('Coach Lee')).toBeNull();
  fireEvent.change(screen.getByLabelText('Search Team'), { target: { value: 'missing' } });
  expect(screen.getByText('No Matches')).toBeTruthy();
  state.directoryError = new Error('offline');
  view.rerender(
    <MemoryRouter>
      <Team />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
  expect(state.retry).toHaveBeenCalledOnce();
});
it('snapshots unread notifications once, groups kudos and opens the matching announcement', () => {
  const first = {
    id: 'one',
    actor: user,
    actor_id: user.id,
    kind: 'kudos',
    entry_id: 'entry',
    entry_title: 'Morning Row',
    created_at: '2026-11-06T10:00:00Z',
    read_at: null,
  } as Notification;
  state.notifications = [
    first,
    { ...first, id: 'two', actor_id: 'other', actor: { ...user, id: 'other', name: 'Alex Kim' } },
    { ...first, id: 'three', kind: 'announcement' },
  ];
  state.announcements = [
    {
      id: 'announcement',
      author_id: user.id,
      author: user,
      title: 'Meet At The Boathouse',
      body: 'Bring your kit',
      created_at: first.created_at,
    },
  ] as Announcement[];
  const view = render(
    <MemoryRouter>
      <Notifications />
    </MemoryRouter>,
  );
  expect(screen.getAllByRole('listitem').length).toBe(2);
  const kudos = screen.getByRole('link', {
    name: /José Alvarez and 1 other gave kudos to Morning Row/,
  });
  expect(kudos.textContent).toContain('José Alvarez and 1 other gave kudos to Morning Row');
  expect(screen.getByText('José Alvarez and 1 other').className).toBe('font-semibold');
  expect(screen.getByText('Morning Row').className).toBe('font-semibold');
  expect(screen.getByText('gave kudos to').parentElement?.className).toContain(
    'font-normal text-text',
  );
  expect(screen.getAllByText('Unread').length).toBe(2);
  expect(state.read).toHaveBeenCalledExactlyOnceWith({ body: { ids: ['one', 'two', 'three'] } });
  state.notifications = state.notifications.map((n) => ({ ...n, read_at: '2026-11-06T11:00:00Z' }));
  view.rerender(
    <MemoryRouter>
      <Notifications />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: 'New' })).toBeTruthy();
  expect(state.read).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: /posted an announcement/ }));
  expect(screen.getByRole('dialog', { name: 'Announcements' }).textContent).toContain(
    'Bring your kit',
  );
});
it('merges unread notifications from a refetch into this visit and marks each ID once', () => {
  const cached = {
    id: 'cached',
    actor: user,
    actor_id: user.id,
    kind: 'comment',
    entry_id: 'entry',
    entry_title: 'Cached Row',
    created_at: '2026-11-06T10:00:00Z',
    read_at: '2026-11-06T11:00:00Z',
  } as Notification;
  state.notifications = [cached];
  const surface = () => (
    <MemoryRouter>
      <Notifications />
    </MemoryRouter>
  );
  const view = render(surface());
  expect(state.read).not.toHaveBeenCalled();
  state.notifications = [
    cached,
    { ...cached, id: 'fresh', entry_title: 'Fresh Row', read_at: null },
  ];
  view.rerender(surface());
  expect(screen.getByRole('heading', { name: 'New' }).parentElement?.textContent).toContain(
    'Fresh Row',
  );
  expect(screen.getByText('Unread')).toBeTruthy();
  expect(state.read).toHaveBeenCalledExactlyOnceWith({ body: { ids: ['fresh'] } });
  state.notifications = state.notifications.map((n) => ({ ...n }));
  view.rerender(surface());
  state.notifications = state.notifications.map((n) => ({ ...n, read_at: cached.read_at }));
  view.rerender(surface());
  expect(screen.getByRole('heading', { name: 'New' }).parentElement?.textContent).toContain(
    'Fresh Row',
  );
  expect(screen.getByText('Unread')).toBeTruthy();
  expect(state.read).toHaveBeenCalledOnce();
});
it('shows empty and error notification states', () => {
  const view = render(
    <MemoryRouter>
      <Notifications />
    </MemoryRouter>,
  );
  expect(screen.getByText('No Notifications Yet')).toBeTruthy();
  state.error = new Error('offline');
  view.rerender(
    <MemoryRouter>
      <Notifications />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
  expect(state.retry).toHaveBeenCalledOnce();
});
it('shows the large Feed title at the top and compact title when its observed boundary scrolls behind the nav', () => {
  const view = render(
    <MemoryRouter>
      <PageHeader title="Feed" />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: 'Feed' })).toBeTruthy();
  expect((view.container.querySelector('.ui-page-compact') as HTMLElement).style.opacity).toBe('0');
  const intersect = (isIntersecting: boolean, top: number) =>
    act(() =>
      onHeaderIntersection(
        [{ isIntersecting, boundingClientRect: { top } } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
  intersect(false, 55);
  expect((view.container.querySelector('.ui-page-compact') as HTMLElement).style.opacity).toBe('1');
  intersect(false, 125);
  expect((view.container.querySelector('.ui-page-compact') as HTMLElement).style.opacity).toBe('0');
  intersect(true, 55);
  expect((view.container.querySelector('.ui-page-compact') as HTMLElement).style.opacity).toBe('0');
});

it('renders tag, mention and unknown notification kinds without crashing', () => {
  state.notifications = ['tag', 'mention', 'future'].map(
    (kind, index) =>
      ({
        id: 'new-' + index,
        user_id: 'viewer',
        actor_id: user.id,
        actor: user,
        kind,
        entry_id: index === 2 ? null : 'workout',
        entry_title: 'Morning Erg',
        created_at: '2026-11-06T12:00:00Z',
        read_at: null,
      }) as Notification,
  );
  render(
    <MemoryRouter>
      <Notifications />
    </MemoryRouter>,
  );
  expect(screen.getByText('tagged you in')).toBeTruthy();
  expect(screen.getByText('mentioned you in')).toBeTruthy();
  expect(screen.getByText('shared')).toBeTruthy();
  expect(screen.getByRole('link', { name: /tagged you in/ }).getAttribute('href')).toBe(
    '/entries/workout',
  );
  expect(screen.getByRole('link', { name: /mentioned you in/ }).getAttribute('href')).toBe(
    '/entries/workout#comments',
  );
});
