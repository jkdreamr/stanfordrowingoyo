/** Invalidation: entries -> entries, stats, leaderboard, users, me/target;
 * me/group -> me/target, users, config, stats, leaderboard; target -> me/target, stats, leaderboard;
 * comments -> comments, entries; announcements -> announcements;
 * notifications/read -> notifications; admin writes -> resource, audit,
 * plus config for settings/presets and derived stats for settings/recalculate.
 * Roster writes/unlink also invalidate users and derived stats.
 * Auth changes (not roster lookup) clear caches to prevent cross-session data leaks.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import type { Api, EntryDetail } from '../../../shared/types';
import { api, type RequestOptions } from './api';
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
  entries: (scope: Query<'GET /api/entries'>['scope'] = 'feed') =>
    ['api', 'entries', 'GET /api/entries', { query: { scope } }] as const,
  entry: (id: string) => ['api', 'entries', 'GET /api/entries/:id', { params: { id } }] as const,
  comments: (id: string) =>
    ['api', 'entries', 'GET /api/entries/:id/comments', { params: { id } }] as const,
  audit: () => ['api', 'admin', 'GET /api/admin/audit', {}] as const,
};
function queryHook<K extends Get>(endpoint: K) {
  return (options: RequestOptions<K>, enabled = true) =>
    useQuery({
      queryKey: qk.request(endpoint, options),
      queryFn: ({ signal }) => api(endpoint, { ...options, signal }),
      enabled,
    });
}
export function useHealth() {
  return queryHook('GET /api/health')({});
}
export function useMe() {
  return queryHook('GET /api/me')({});
}
export function useTarget() {
  return queryHook('GET /api/me/target')({});
}
export function useConfig() {
  return queryHook('GET /api/config')({});
}
export function useEntries(scope: Query<'GET /api/entries'>['scope'] = 'feed') {
  return useInfiniteQuery({
    queryKey: qk.entries(scope),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api('GET /api/entries', { query: { scope, cursor: pageParam }, signal }),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  });
}
export function useEntry(id: string) {
  return queryHook('GET /api/entries/:id')({ params: { id } }, !!id);
}
export function useComments(id: string) {
  return queryHook('GET /api/entries/:id/comments')({ params: { id } }, !!id);
}
export function useImage(id: string) {
  return queryHook('GET /api/images/:id')({ params: { id } }, !!id);
}
export function useWeekStats(query: Query<'GET /api/stats/week'> = {}) {
  return queryHook('GET /api/stats/week')({ query });
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
export function useProfile(id: string) {
  return queryHook('GET /api/users/:id')({ params: { id } }, !!id);
}
export function useAnnouncements() {
  return queryHook('GET /api/announcements')({});
}
export function useNotifications() {
  return queryHook('GET /api/notifications')({});
}
export function usePlan(query: Query<'GET /api/plan'> = {}) {
  return queryHook('GET /api/plan')({ query });
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
  return useInfiniteQuery({
    queryKey: qk.audit(),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api('GET /api/admin/audit', { query: { cursor: pageParam }, signal }),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  });
}
export function invalidationKeys(endpoint: Write): QueryKey[] {
  if (endpoint.includes('/auth/')) return [qk.all];
  if (endpoint === 'PATCH /api/me')
    return ['me', 'users', 'config', 'stats', 'leaderboard'].map(qk.root);
  if (endpoint === 'POST /api/me/password') return [qk.me()];
  if (endpoint === 'PUT /api/me/target')
    return [qk.target(), qk.root('stats'), qk.root('leaderboard'), qk.root('users')];
  if (endpoint.includes('comments')) return [qk.root('entries')];
  if (endpoint.includes('/entries'))
    return ['entries', 'stats', 'leaderboard', 'users', 'me'].map(qk.root);
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
      mutationFn: (options: RequestOptions<K>) => api(endpoint, options),
      onSuccess: async () => {
        if (endpoint === 'POST /api/auth/roster') return;
        if (endpoint.includes('/auth/')) {
          client.clear();
          return;
        }
        await Promise.all(
          invalidationKeys(endpoint).map((queryKey) => client.invalidateQueries({ queryKey })),
        );
      },
    });
  };
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
