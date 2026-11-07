/** Invalidation: entries -> entries, stats, leaderboard, users, me/target, me/plan;
 * me/group -> me/target, users, config, stats, leaderboard; target -> me/target, stats, leaderboard;
 * comments -> comments, entries; announcements -> announcements;
 * notifications/read -> notifications; admin writes -> resource, audit,
 * plus config for settings/presets and derived stats for settings/recalculate.
 * Roster writes/unlink also invalidate users and derived stats.
 * Auth changes (not roster lookup) clear caches to prevent cross-session data leaks.
 */
import {
  useInfiniteQuery,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import type { Api, Config, EntryDetail, MyPlan, MyPlanInput, User } from '../../../shared/types';
import { api, ApiClientError, type RequestOptions } from './api';
import { useToast } from '../components/ui/Toast';
import { covers, personalPlan } from './myPlan';
type Get = Extract<keyof Api, `GET ${string}`>;
type Write = Exclude<keyof Api, Get>;
type Query<K extends keyof Api> = Api[K]['query'];
export const qk = {
  all: ['api'] as const,
  root: (resource: string) => ['api', resource] as const,
  request: <K extends Get>(endpoint: K, options: RequestOptions<K>) => {
    const path = endpoint.slice(9).split('/');
    return ['api', path[0], endpoint, options] as const;
  },
  me: () => ['api', 'me', 'GET /api/me', {}] as const,
  target: () => ['api', 'me', 'GET /api/me/target', {}] as const,
  myPlans: () => ['api', 'me', 'GET /api/me/plan'] as const,
  myPlan: (date?: string) =>
    ['api', 'me', 'GET /api/me/plan', { query: date ? { date } : {} }] as const,
  entries: (scope: Query<'GET /api/entries'>['scope'] = 'feed') =>
    ['api', 'entries', 'GET /api/entries', { query: { scope } }] as const,
  entry: (id: string) => ['api', 'entries', 'GET /api/entries/:id', { params: { id } }] as const,
  comments: (id: string) =>
    ['api', 'entries', 'GET /api/entries/:id/comments', { params: { id } }] as const,
  audit: () => ['api', 'admin', 'GET /api/admin/audit', {}] as const,
};
function useSessionEnabled() {
  const loggingOut = useIsMutating({ mutationKey: ['POST /api/auth/logout'] });
  const client = useQueryClient();
  return loggingOut === 0 && client.getQueryData(qk.me()) !== null;
}
function queryHook<K extends Get>(endpoint: K) {
  return (options: RequestOptions<K>, enabled = true) => {
    const sessionEnabled = useSessionEnabled();
    return useQuery({
      queryKey: qk.request(endpoint, options),
      queryFn: ({ signal }) => api(endpoint, { ...options, signal }),
      enabled: enabled && (endpoint === 'GET /api/health' || sessionEnabled),
    });
  };
}
export function useHealth() {
  return queryHook('GET /api/health')({});
}
export function useMe() {
  const enabled = useSessionEnabled();
  return useQuery<User | null>({
    queryKey: qk.me(),
    queryFn: ({ signal }) => api('GET /api/me', { signal }),
    enabled,
  });
}
export function useTarget() {
  return queryHook('GET /api/me/target')({});
}
export function useConfig() {
  return queryHook('GET /api/config')({});
}
export function useEntries(scope: Query<'GET /api/entries'>['scope'] = 'feed', enabled = true) {
  const sessionEnabled = useSessionEnabled();
  return useInfiniteQuery({
    queryKey: qk.entries(scope),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api('GET /api/entries', { query: { scope, cursor: pageParam }, signal }),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: enabled && sessionEnabled,
  });
}
export function useEntry(id: string, enabled = true) {
  return queryHook('GET /api/entries/:id')({ params: { id } }, enabled && !!id);
}
export function useKudosGivers(id: string, enabled: boolean) {
  return queryHook('GET /api/entries/:id/kudos')({ params: { id } }, enabled && !!id);
}
export function useComments(id: string, enabled = true) {
  return queryHook('GET /api/entries/:id/comments')({ params: { id } }, enabled && !!id);
}
export function useImage(id: string) {
  return queryHook('GET /api/images/:id')({ params: { id } }, !!id);
}
export function useWeekStats(query: Query<'GET /api/stats/week'> = {}, enabled = true) {
  return queryHook('GET /api/stats/week')({ query }, enabled);
}
export function useSeasonStats(query: Query<'GET /api/stats/season'> = {}) {
  return queryHook('GET /api/stats/season')({ query });
}
export function useLeaderboard(query: Query<'GET /api/leaderboard'> = {}) {
  return queryHook('GET /api/leaderboard')({ query });
}
export function useUsers() {
  return queryHook('GET /api/users')({});
}
export function useProfile(id: string, enabled = true) {
  return queryHook('GET /api/users/:id')({ params: { id } }, enabled && !!id);
}
export function useAnnouncements() {
  return queryHook('GET /api/announcements')({});
}
export const NOTIFICATION_POLL_MS = 60_000;
/** Pass poll=true from exactly one mounted observer; polling pauses while the page is hidden. */
export function useNotifications(poll = false) {
  return useQuery({
    queryKey: qk.request('GET /api/notifications', {}),
    queryFn: ({ signal }) => api('GET /api/notifications', { signal }),
    refetchInterval: poll ? NOTIFICATION_POLL_MS : false,
    refetchIntervalInBackground: false,
  });
}
export function usePushConfig(enabled = true) {
  return queryHook('GET /api/me/push')({}, enabled);
}
export function usePlan(query: Query<'GET /api/plan'> = {}) {
  return queryHook('GET /api/plan')({ query });
}
export function useMyPlan(date?: string, enabled = true) {
  return queryHook('GET /api/me/plan')({ query: date ? { date } : {} }, enabled);
}
export function usePutMyPlan() {
  const client = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationKey: ['my-plan'],
    mutationFn: (body: MyPlanInput) => api('PUT /api/me/plan', { body }),
    onMutate: async (body) => {
      await client.cancelQueries({ queryKey: qk.myPlans() });
      const snapshots = client.getQueriesData<MyPlan | null>({ queryKey: qk.myPlans() });
      const config = client.getQueryData<Config>(qk.request('GET /api/config', {}));
      if (config)
        for (const [key, previous] of snapshots) {
          const date = (key[3] as { query?: { date?: string } }).query?.date ?? config.today;
          if (covers(body, date)) {
            const next = personalPlan(body, config, new Date().toISOString());
            next.sessions = next.sessions.map((row) => ({
              ...row,
              completed_entry_id:
                previous?.start_date === body.start_date
                  ? (previous.sessions.find(
                      (old) =>
                        old.week === row.week &&
                        old.day === row.day &&
                        old.slot === row.slot &&
                        old.modality === row.modality,
                    )?.completed_entry_id ?? null)
                  : null,
            }));
            client.setQueryData(key, next);
          }
        }
      return snapshots;
    },
    onError: (error, _body, snapshots) => {
      for (const [key, value] of snapshots ?? []) client.setQueryData(key, value);
      toast.show({
        title:
          error instanceof ApiClientError && error.status === 409
            ? 'Plan Overlap'
            : 'Could Not Save Plan',
        tone: 'error',
      });
    },
    onSuccess: (plan) => {
      const config = client.getQueryData<Config>(qk.request('GET /api/config', {}));
      for (const [key] of client.getQueriesData({ queryKey: qk.myPlans() })) {
        const date = (key[3] as { query?: { date?: string } }).query?.date ?? config?.today;
        if (date && covers(plan, date)) client.setQueryData(key, plan);
      }
    },
    onSettled: () => client.invalidateQueries({ queryKey: qk.myPlans() }),
  });
}
export function useDeleteMyPlan() {
  const client = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (start: string) => api('DELETE /api/me/plan/:start', { params: { start } }),
    onError: () => toast.show({ title: 'Could Not Delete Plan', tone: 'error' }),
    onSuccess: async (_result, start) => {
      for (const [key, value] of client.getQueriesData<MyPlan | null>({ queryKey: qk.myPlans() }))
        if (value?.start_date === start) client.setQueryData(key, null);
      await client.invalidateQueries({ queryKey: qk.myPlans() });
    },
  });
}
export function useAdminUsers() {
  return queryHook('GET /api/admin/users')({});
}
export function useRoster() {
  return queryHook('GET /api/admin/roster')({});
}
export function useSettings() {
  return queryHook('GET /api/admin/settings')({});
}
export function usePresets() {
  return queryHook('GET /api/admin/presets')({});
}
export function useAdminPlan() {
  return queryHook('GET /api/admin/plan')({});
}
export function useCompliance(query: Query<'GET /api/admin/compliance'> = {}) {
  return queryHook('GET /api/admin/compliance')({ query });
}
export function useExport(query: Query<'GET /api/admin/export'>, enabled = false) {
  return queryHook('GET /api/admin/export')({ query }, enabled);
}
export function useAudit() {
  const enabled = useSessionEnabled();
  return useInfiniteQuery({
    queryKey: qk.audit(),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api('GET /api/admin/audit', { query: { cursor: pageParam }, signal }),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled,
  });
}
export function invalidationKeys(endpoint: Write): QueryKey[] {
  if (endpoint.includes('/auth/')) return [qk.all];
  if (endpoint === 'PATCH /api/me')
    return ['me', 'users', 'config', 'stats', 'leaderboard', 'entries', 'notifications'].map(
      qk.root,
    );
  if (endpoint === 'POST /api/me/password') return [qk.me()];
  if (endpoint === 'PUT /api/me/target')
    return [qk.target(), qk.root('stats'), qk.root('leaderboard'), qk.root('users')];
  if (endpoint === 'DELETE /api/comments/:id') return [qk.root('entries'), qk.audit()];
  if (endpoint.includes('comments')) return [qk.root('entries')];
  if (endpoint.includes('/entries'))
    return [...['entries', 'stats', 'leaderboard', 'users', 'me'].map(qk.root), qk.audit()];
  if (endpoint.includes('/announcements')) return [qk.root('announcements')];
  if (endpoint.includes('/notifications')) return [qk.root('notifications')];
  if (endpoint.includes('/admin/')) {
    const keys: QueryKey[] = [qk.root('admin')];
    if (/settings|presets/.test(endpoint)) keys.push(qk.root('config'));
    if (/settings|recalculate|users|roster/.test(endpoint))
      keys.push(...['me', 'entries', 'stats', 'leaderboard', 'users'].map(qk.root));
    if (endpoint.includes('/plan')) keys.push(qk.root('plan'));
    return keys;
  }
  return [];
}
function mutationHook<K extends Write>(endpoint: K) {
  return () => {
    const client = useQueryClient();
    return useMutation({
      mutationKey: [endpoint],
      mutationFn: (options: RequestOptions<K>) => api(endpoint, options),
      onMutate: async (options) => {
        if (endpoint === 'POST /api/auth/logout') await client.cancelQueries({ queryKey: qk.all });
        if (endpoint === 'DELETE /api/entries/:id')
          await Promise.all(
            entryQueryKeys(options.params!.id).map((queryKey) =>
              client.cancelQueries({ queryKey, exact: true }),
            ),
          );
      },
      onSuccess: async (data, options) => {
        if (endpoint === 'PATCH /api/me') client.setQueryData(qk.me(), data);
        if (endpoint === 'POST /api/auth/roster') return;
        if (endpoint.includes('/auth/')) {
          client.clear();
          if (endpoint === 'POST /api/auth/logout') client.setQueryData(qk.me(), null);
          return;
        }
        if (endpoint === 'DELETE /api/entries/:id')
          for (const queryKey of entryQueryKeys(options.params!.id))
            client.removeQueries({ queryKey, exact: true });
        await Promise.all(
          invalidationKeys(endpoint).map((queryKey) => client.invalidateQueries({ queryKey })),
        );
      },
    });
  };
}
function entryQueryKeys(id: string) {
  return [
    qk.entry(id),
    qk.comments(id),
    qk.request('GET /api/entries/:id/kudos', { params: { id } }),
  ];
}
export const useSignup = mutationHook('POST /api/auth/signup');
export const useRosterOptions = mutationHook('POST /api/auth/roster');
export const useSignupRoster = useRosterOptions;
export const useLogin = mutationHook('POST /api/auth/login');
export const useLogout = mutationHook('POST /api/auth/logout');
export const useUpdateMe = mutationHook('PATCH /api/me');
export const useChangePassword = mutationHook('POST /api/me/password');
export const useVerifyPassword = mutationHook('POST /api/me/password/verify');
export const useSetTarget = mutationHook('PUT /api/me/target');
export const useCreateEntry = mutationHook('POST /api/entries');
export const useUpdateEntry = mutationHook('PATCH /api/entries/:id');
export const useDeleteEntry = mutationHook('DELETE /api/entries/:id');
export const useCreateComment = mutationHook('POST /api/entries/:id/comments');
export const useDeleteComment = mutationHook('DELETE /api/comments/:id');
export const useUploadImage = mutationHook('POST /api/images');
export const useCreateAnnouncement = mutationHook('POST /api/announcements');
export const useUpdateAnnouncement = mutationHook('PATCH /api/announcements/:id');
export const useDeleteAnnouncement = mutationHook('DELETE /api/announcements/:id');
export const useReadNotifications = mutationHook('POST /api/notifications/read');
export const useUpdateUser = mutationHook('PATCH /api/admin/users/:id');
export const useResetPassword = mutationHook('POST /api/admin/users/:id/reset-password');
export const useCreateRoster = mutationHook('POST /api/admin/roster');
export const useUpdateRoster = mutationHook('PATCH /api/admin/roster/:id');
export const useDeleteRoster = mutationHook('DELETE /api/admin/roster/:id');
export const useUnlinkRoster = mutationHook('POST /api/admin/roster/:id/unlink');
export const useImportRoster = mutationHook('POST /api/admin/roster/import');
export const useUpdateSettings = mutationHook('PATCH /api/admin/settings');
export const useCreatePreset = mutationHook('POST /api/admin/presets');
export const useUpdatePreset = mutationHook('PATCH /api/admin/presets/:id');
export const useDeletePreset = mutationHook('DELETE /api/admin/presets/:id');
export const useReplacePlan = mutationHook('PUT /api/admin/plan');
export const useCreatePlanSlot = mutationHook('POST /api/admin/plan');
export const useDeletePlanSlot = mutationHook('DELETE /api/admin/plan/:group/:week/:day/:slot');
export const useRecalculate = mutationHook('POST /api/admin/recalculate');

export function updateCachedKudos(data: unknown, id: string, hasKudos: boolean): unknown {
  if (Array.isArray(data)) return data.map((item) => updateCachedKudos(item, id, hasKudos));
  if (!data || typeof data !== 'object') return data;
  const record = data as Record<string, unknown>;
  if (
    record.id === id &&
    typeof record.has_kudos === 'boolean' &&
    typeof record.kudos_count === 'number'
  ) {
    const entry = record as unknown as EntryDetail;
    return {
      ...entry,
      has_kudos: hasKudos,
      kudos_count: Math.max(
        0,
        entry.kudos_count + (hasKudos === entry.has_kudos ? 0 : hasKudos ? 1 : -1),
      ),
    };
  }
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, updateCachedKudos(value, id, hasKudos)]),
  );
}
export async function optimisticKudos(client: QueryClient, id: string, hasKudos: boolean) {
  await client.cancelQueries({ queryKey: qk.all });
  const snapshots = client
    .getQueriesData({ queryKey: qk.all })
    .filter(([key]) => key[1] === 'entries' || key[1] === 'stats');
  for (const [key, data] of snapshots)
    client.setQueryData(key, updateCachedKudos(data, id, hasKudos));
  return () => {
    for (const [key, data] of snapshots) client.setQueryData(key, data);
  };
}
export function useKudos() {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ['kudos'],
    scope: { id: 'kudos' },
    mutationFn: ({ id, hasKudos }: { id: string; hasKudos: boolean }) =>
      hasKudos
        ? api('POST /api/entries/:id/kudos', { params: { id } })
        : api('DELETE /api/entries/:id/kudos', { params: { id } }),
    onMutate: ({ id, hasKudos }) => optimisticKudos(client, id, hasKudos),
    onError: (_error, _variables, rollback) => rollback?.(),
    onSettled: () =>
      Promise.all(
        ['entries', 'stats'].map((resource) =>
          client.invalidateQueries({ queryKey: qk.root(resource) }),
        ),
      ),
  });
}
