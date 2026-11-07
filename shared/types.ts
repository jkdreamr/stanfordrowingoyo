export type Modality = 'erg' | 'bike' | 'run';
export type Zone = 'R' | 'R/E' | 'E' | 'E/D' | 'D' | 'D/C' | 'C' | 'C/B' | 'B' | 'A';
export type Role = 'rower' | 'coxswain' | 'coach' | 'admin';
export type GroupKey = 'frosh' | 'normal' | 'u23';
export type Side = 'port' | 'starboard' | 'both' | 'cox';
/** Legacy input compatibility; entries are always stored and returned as team-visible. */
export type Visibility = 'team' | 'private';
export interface User {
  id: string;
  email: string;
  name: string;
  must_change_password: boolean;
  role: Role;
  group_key: GroupKey;
  side: Side | null;
  class_year: number | null;
  bio: string;
  avatar_image_id: string | null;
  best6k_split_s: number | null;
  best2k_split_s: number | null;
  on_leaderboard: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}
export interface StoredUser extends User {
  password_hash: string;
  password_salt: string;
}
export type PublicUser = Omit<User, 'email' | 'must_change_password'>;
export interface Session {
  token_hash: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}
export interface RosterRow {
  id: string;
  email: string | null;
  name: string;
  role: Role;
  group_key: GroupKey | null;
  side: Side | null;
  class_year: number | null;
  claimed_by_user_id: string | null;
  added_by: string | null;
  created_at: string;
}
export interface RosterChoice {
  id: string;
  name: string;
  role: Role;
}
export interface Settings {
  team_code: string;
  zone_factors: Record<Zone, number>;
  mode_factors: Record<Modality, number>;
  group_targets: Record<GroupKey, number>;
  season_start: string;
}
export interface CurrentWeeklyTarget {
  week_start: string;
  target_m: number;
  source: 'personal' | 'group';
}
export interface WeeklyTarget {
  user_id: string;
  week_start: string;
  target_m: number;
}
export interface EntryInput {
  date: string;
  modality: Modality;
  zone: Zone;
  distance_m: number;
  duration_s?: number | null;
  avg_split_s?: number | null;
  stroke_rate?: number | null;
  avg_hr?: number | null;
  title: string;
  notes: string;
  preset_id?: string | null;
  visibility: Visibility;
  image_ids?: string[];
  tagged_user_ids?: string[];
}
export interface Entry extends Omit<Required<EntryInput>, 'image_ids' | 'tagged_user_ids'> {
  id: string;
  user_id: string;
  week_start: string;
  mode_factor: number;
  zone_factor: number;
  equiv_m: number;
  created_at: string;
  updated_at: string;
}
export interface ImageMetadata {
  id: string;
  owner_id: string;
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
  created_at: string;
}
export interface StoredImage extends ImageMetadata {
  bytes: ArrayBuffer;
}
export interface EntryImage {
  entry_id: string;
  image_id: string;
  position: number;
}
export interface Kudos {
  entry_id: string;
  user_id: string;
  created_at: string;
}
export interface Comment {
  id: string;
  entry_id: string;
  user_id: string;
  body: string;
  created_at: string;
}
export interface CommentWithAuthor extends Comment {
  mentions: PublicUser[];
  author: PublicUser;
}
export interface EntryDetail extends Entry {
  tagged: PublicUser[];
  author: PublicUser;
  images: ImageMetadata[];
  kudos_count: number;
  has_kudos: boolean;
  comment_count: number;
}
export interface Announcement {
  author: PublicUser;
  id: string;
  author_id: string;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
}
export type AnnouncementInput = Pick<Announcement, 'title' | 'body' | 'pinned'>;
export interface Preset {
  id: string;
  modality: Modality;
  zone: Zone;
  name: string;
  distance_m: number | null;
  sort: number;
  active: boolean;
}
export type PresetInput = Omit<Preset, 'id'>;
export interface PlanSlot {
  group_key: GroupKey;
  week: 1 | 2;
  day: number;
  slot: 'AM' | 'PM1' | 'PM2';
  kind: 'team' | 'oyo' | 'off';
  zone: Zone | null;
  text: string;
}
export interface PlanTotal {
  group_key: GroupKey;
  week: 1 | 2;
  label: string;
}
export interface Plan {
  slots: PlanSlot[];
  totals: PlanTotal[];
}
export interface MyPlanSessionInput {
  week: 1 | 2;
  day: number; // 0=Mon..6
  slot: 'AM' | 'PM1' | 'PM2';
  modality: Modality;
  zone: Zone;
  distance_m: number | null; // 1..200000
  note: string; // ≤200
}
export interface MyPlanSession extends MyPlanSessionInput {
  equiv_m: number | null;
  completed_entry_id: string | null;
}
export interface MyPlan {
  start_date: string;
  sessions: MyPlanSession[];
  rest_days: { week: 1 | 2; day: number }[];
  planned_m: [number, number];
  updated_at: string;
}
export interface MyPlanInput {
  start_date: string;
  sessions: MyPlanSessionInput[];
  rest_days: { week: 1 | 2; day: number }[];
}
export interface Notification {
  actor: PublicUser;
  entry_title: string | null;
  id: string;
  user_id: string;
  kind: 'kudos' | 'comment' | 'announcement' | 'tag' | 'mention';
  actor_id: string;
  entry_id: string | null;
  created_at: string;
  read_at: string | null;
}
export interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  target: string;
  detail_json: string;
  created_at: string;
}
export interface RateLimit {
  email: string;
  ip: string;
  window_start: string;
  attempts: number;
}
export interface ApiError {
  error: { code: string; message: string };
}
export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}
export interface Totals {
  total_m: number;
  by_modality: Record<Modality, number>;
  by_zone: Record<Zone, number>;
}
export interface WeekSummary extends Totals {
  week_start: string;
  target_m: number;
  percent: number;
  hit_target: boolean;
}
export interface WeekStats extends WeekSummary {
  by_day: { date: string; equiv_m: number }[];
  entries: EntryDetail[];
}
export interface SeasonStats extends Totals {
  days: { date: string; equiv_m: number }[];
  start: string;
  end: string;
  weeks: WeekSummary[];
  streak: number;
  best_week: WeekSummary | null;
}
export interface LeaderboardRow {
  streak: number;
  entry_count: number;
  user: PublicUser;
  target_m: number;
  total_m: number;
  percent: number;
  rank: number;
}
export interface ComplianceRow extends LeaderboardRow {
  last_log: string | null;
}
export interface Profile {
  user: PublicUser;
  stats: SeasonStats;
}
export interface SignupRequest {
  email: string;
  password: string;
  team_code?: string;
  roster_id?: string;
  group_key?: GroupKey;
}
export interface LoginRequest {
  email: string;
  password: string;
}
export interface PasswordVerifyRequest {
  current_password: string;
}
export interface PasswordVerifyResponse {
  reauth_token: string;
  expires_at: string;
}
export interface PasswordChangeRequest {
  new_password: string;
  reauth_token?: string;
}
export type ProfilePatch = Partial<
  Pick<
    User,
    | 'name'
    | 'bio'
    | 'side'
    | 'class_year'
    | 'best6k_split_s'
    | 'best2k_split_s'
    | 'avatar_image_id'
    | 'group_key'
  >
>;
export type AdminUserPatch = Partial<
  Pick<User, 'role' | 'group_key' | 'on_leaderboard' | 'active'>
>;
export type RosterInput = Omit<RosterRow, 'id' | 'claimed_by_user_id' | 'added_by' | 'created_at'>;
export interface Config extends Omit<Settings, 'team_code'> {
  today: string;
  current_week_start: string;
  presets: Preset[];
  zones: Zone[];
}
/** VAPID application server key (base64url, uncompressed P-256); null when push is not configured. */
export interface PushConfig {
  public_key: string | null;
}
/** Browser PushSubscription.toJSON() subset registered for the signed-in user on this device. */
export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
export interface Endpoint<Req, Res, Query = never> {
  request: Req;
  response: Res;
  query: Query;
}
/** Canonical endpoint paths for the backend and typed browser client. Void responses use HTTP 204. */
export interface Api {
  'GET /api/health': Endpoint<void, { ok: true; schema_version: number }>;
  'POST /api/auth/signup': Endpoint<SignupRequest, User>;
  'POST /api/auth/roster': Endpoint<{ team_code: string }, RosterChoice[]>;
  'POST /api/auth/login': Endpoint<LoginRequest, User>;
  'POST /api/auth/logout': Endpoint<void, void>;
  'GET /api/me': Endpoint<void, User>;
  'PATCH /api/me': Endpoint<ProfilePatch, User>;
  'POST /api/me/password/verify': Endpoint<PasswordVerifyRequest, PasswordVerifyResponse>;
  'POST /api/me/password': Endpoint<PasswordChangeRequest, void>;
  'GET /api/me/target': Endpoint<void, CurrentWeeklyTarget>;
  'PUT /api/me/target': Endpoint<{ target_m: number }, WeeklyTarget>;
  'GET /api/config': Endpoint<void, Config>;
  'GET /api/entries': Endpoint<
    void,
    Page<EntryDetail>,
    { scope?: 'feed' | 'mine' | `user:${string}`; cursor?: string }
  >;
  'POST /api/entries': Endpoint<EntryInput, EntryDetail>;
  'GET /api/entries/:id': Endpoint<void, EntryDetail>;
  'PATCH /api/entries/:id': Endpoint<Partial<EntryInput>, EntryDetail>;
  'DELETE /api/entries/:id': Endpoint<void, void>;
  'GET /api/entries/:id/kudos': Endpoint<void, PublicUser[]>;
  'POST /api/entries/:id/kudos': Endpoint<void, void>;
  'DELETE /api/entries/:id/kudos': Endpoint<void, void>;
  'GET /api/entries/:id/comments': Endpoint<void, CommentWithAuthor[]>;
  'POST /api/entries/:id/comments': Endpoint<
    { body: string; mention_ids?: string[] },
    CommentWithAuthor
  >;
  'DELETE /api/comments/:id': Endpoint<void, void>;
  'POST /api/images': Endpoint<Blob, { id: string }>;
  'GET /api/images/:id': Endpoint<void, Blob>;
  'GET /api/stats/week': Endpoint<void, WeekStats, { week?: string; user?: string }>;
  'GET /api/stats/season': Endpoint<
    void,
    SeasonStats,
    ({ season?: number; year?: never } | { year: number; season?: never }) & { user?: string }
  >;
  'GET /api/leaderboard': Endpoint<
    void,
    LeaderboardRow[],
    { week?: string; metric?: 'percent' | 'meters' | 'season' }
  >;
  'GET /api/users': Endpoint<void, PublicUser[]>;
  'GET /api/users/:id': Endpoint<void, Profile>;
  'GET /api/announcements': Endpoint<void, Announcement[]>;
  'POST /api/announcements': Endpoint<AnnouncementInput, Announcement>;
  'PATCH /api/announcements/:id': Endpoint<Partial<AnnouncementInput>, Announcement>;
  'DELETE /api/announcements/:id': Endpoint<void, void>;
  'GET /api/notifications': Endpoint<void, Notification[]>;
  'POST /api/notifications/read': Endpoint<{ ids: string[] }, void>;
  'GET /api/plan': Endpoint<void, Plan, { group?: GroupKey }>;
  'GET /api/me/plan': Endpoint<void, MyPlan | null, { date?: string }>;
  'PUT /api/me/plan': Endpoint<MyPlanInput, MyPlan>;
  'DELETE /api/me/plan/:start': Endpoint<void, void>;
  'GET /api/me/push': Endpoint<void, PushConfig>;
  'PUT /api/me/push': Endpoint<PushSubscriptionInput, void>;
  'DELETE /api/me/push': Endpoint<{ endpoint: string }, void>;
  'GET /api/admin/users': Endpoint<void, User[]>;
  'PATCH /api/admin/users/:id': Endpoint<AdminUserPatch, User>;
  'POST /api/admin/users/:id/reset-password': Endpoint<void, { temporary_password: string }>;
  'GET /api/admin/roster': Endpoint<void, RosterRow[]>;
  'POST /api/admin/roster': Endpoint<RosterInput, RosterRow>;
  'PATCH /api/admin/roster/:id': Endpoint<Partial<RosterInput>, RosterRow>;
  'DELETE /api/admin/roster/:id': Endpoint<void, void>;
  'POST /api/admin/roster/:id/unlink': Endpoint<void, RosterRow>;
  'POST /api/admin/roster/import': Endpoint<
    { csv: string },
    { imported: number; errors: { row: number; message: string }[] }
  >;
  'GET /api/admin/settings': Endpoint<void, Settings>;
  'PATCH /api/admin/settings': Endpoint<Partial<Settings>, Settings>;
  'GET /api/admin/presets': Endpoint<void, Preset[]>;
  'POST /api/admin/presets': Endpoint<PresetInput, Preset>;
  'PATCH /api/admin/presets/:id': Endpoint<Partial<PresetInput>, Preset>;
  'DELETE /api/admin/presets/:id': Endpoint<void, void>;
  'GET /api/admin/plan': Endpoint<void, Plan>;
  'PUT /api/admin/plan': Endpoint<Plan, Plan>;
  'POST /api/admin/plan': Endpoint<PlanSlot, PlanSlot>;
  'DELETE /api/admin/plan/:group/:week/:day/:slot': Endpoint<void, void>;
  'POST /api/admin/recalculate': Endpoint<void, { updated: number }>;
  'GET /api/admin/compliance': Endpoint<void, ComplianceRow[], { week?: string }>;
  'GET /api/admin/export': Endpoint<void, string, { start: string; end: string }>;
  'GET /api/admin/audit': Endpoint<void, Page<AuditLog>, { cursor?: string }>;
}
