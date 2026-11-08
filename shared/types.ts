import type { DiveTier } from './games/dive';
import type { Mark } from './games/wordGuess';

export type Modality = 'erg' | 'bike' | 'run';
export type ErgTestKind = '2k' | '6k';
export interface ErgTestInput {
  kind: ErgTestKind;
  date: string;
  time_s?: number;
  split_s?: number;
}
export interface ErgTest {
  id: string;
  user_id: string;
  kind: ErgTestKind;
  date: string;
  time_s: number;
  split_s: number;
  is_pr: boolean;
  created_at: string;
  updated_at: string;
}
export interface WeeklyRecap {
  week_start: string;
  total_m: number;
  target_m: number;
  percent: number;
  hit_target: boolean;
  entry_count: number;
  by_modality: Record<Modality, number>;
  streak: number;
  best_effort: Entry | null;
  team: { total_m: number; entry_count: number; rowers: number; rowers_hit_target: number };
  rank: number | null;
}
export type ChallengeUnit = 'emeters' | 'km';
export interface TeamChallengeInput {
  title: string;
  unit: ChallengeUnit;
  goal_m: number;
  modality: Modality | null;
  start_date: string;
  end_date: string;
}
export interface TeamChallenge extends TeamChallengeInput {
  id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  ended_at: string | null;
  status: 'upcoming' | 'active' | 'ended';
  progress_m: number;
  percent: number;
}
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
  /** Berkeley finishes each week at this percent of the team's summed targets. */
  berkeley_pace_percent: number;
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
  edited_at?: string | null;
}
export interface CommentWithAuthor extends Comment {
  mentions: PublicUser[];
  author: PublicUser;
}
export interface ReportTarget {
  target_type: 'entry' | 'comment';
  target_id: string;
}
export interface ReportInput extends ReportTarget {
  reason?: string;
}
export interface ContentReport extends ReportTarget {
  id: string;
  entry_id: string;
  reporter: PublicUser;
  reason: string;
  status: 'open' | 'dismissed' | 'deleted';
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  content: { author: PublicUser; body: string; title: string | null } | null;
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
}
export interface MyPlan {
  start_date: string;
  sessions: MyPlanSession[];
  rest_days: { week: 1 | 2; day: number }[];
  planned_m: [number, number];
  /**
   * Stored E-meters of all non-deleted owner workouts, regardless of modality, zone or visibility.
   * Week 1 is start_date..+6; week 2 is +7..+13, inclusive, by workout date.
   * Complete when planned_m[w] > 0 and logged_m[w] >= planned_m[w].
   */
  logged_m: [number, number];
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
  kind: 'kudos' | 'comment' | 'announcement' | 'tag' | 'mention' | 'report';
  actor_id: string;
  entry_id: string | null;
  announcement_id?: string | null;
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
/** One week of Stanford vs Berkeley. Berkeley is a ghost crew pacing a share of the team's targets. */
export interface RaceWeek {
  week_start: string;
  /** Monday 00:00 and the next Monday 00:00, America/Los_Angeles, as ISO instants. */
  starts_at: string;
  ends_at: string;
  status: 'upcoming' | 'live' | 'final';
  /** Active leaderboard rowers counted on both sides. */
  rowers: number;
  stanford_m: number;
  /** Sum of those rowers' weekly targets. */
  target_m: number;
  /** round(target_m × ratio): where Berkeley finishes on Sunday night. */
  berkeley_total_m: number;
  /** Berkeley's position at `as_of`, linear through the week. */
  berkeley_m: number;
}
export interface TeamRace {
  as_of: string;
  ratio: number;
  week: RaceWeek;
  previous: RaceWeek;
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
export type PasskeyTransport =
  'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb';
/** A registered WebAuthn credential; key material is never returned. */
export interface Passkey {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  backed_up: boolean;
}
/** Base64url (no padding) WebAuthn values; `challenge` is single use and expires at `expires_at`. */
export interface PasskeyLoginOptions {
  challenge: string;
  rp_id: string;
  timeout_ms: number;
  expires_at: string;
}
export interface PasskeyRegistrationOptions extends PasskeyLoginOptions {
  rp_name: string;
  user: { id: string; name: string; display_name: string };
  exclude_credentials: { id: string; transports: PasskeyTransport[] }[];
}
export interface PasskeyRegistrationOptionsRequest {
  reauth_token?: string;
}
export interface PasskeyAssertion {
  id: string;
  raw_id: string;
  client_data_json: string;
  authenticator_data: string;
  signature: string;
  user_handle: string | null;
}
export interface PasskeyAttestation {
  id: string;
  raw_id: string;
  client_data_json: string;
  attestation_object: string;
  transports: PasskeyTransport[];
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
/** A teammate referenced from exported content: only the team-visible id and name. */
export interface AccountExportPerson {
  id: string;
  name: string;
}
export interface AccountExportWorkout extends Entry {
  images: ImageMetadata[];
  tagged: AccountExportPerson[];
  kudos_count: number;
  comment_count: number;
}
export interface AccountExportComment extends Comment {
  mentions: AccountExportPerson[];
}
/** Someone else's workout that tags the exporting user. */
export interface AccountExportTag {
  entry_id: string;
  entry_owner_id: string;
  tagged_at: string;
}
/** Someone else's comment that mentions the exporting user; the comment body is not exported. */
export interface AccountExportMention {
  comment_id: string;
  entry_id: string;
  author_id: string;
  created_at: string;
}
export type GameId = string;
export interface DiveNotableAnswer {
  answer: string;
  tier: DiveTier;
  points: number;
}
export interface DiveAnswerResult {
  prompt_index: number;
  answer: string;
  points: number;
  tier: DiveTier;
  count: number;
  total: number;
  hidden: boolean;
  canonical: string | null;
  gem: DiveNotableAnswer;
  notable: DiveNotableAnswer[];
}
export interface DiveRevealGroup {
  normalized: string;
  answer: string;
  count: number;
  points: number;
  tier: DiveTier;
  hidden: boolean;
  mine: boolean;
  canonical: string | null;
  teammates: { user_id: string; name: string }[];
  only_you: boolean;
}
export interface DiveReveal {
  prompt_index: number;
  prompt: string;
  groups: DiveRevealGroup[];
}
export interface DiveDay {
  date: string;
  access: GameAccess;
  prompts: string[];
  answers: DiveAnswerResult[];
  complete: boolean;
  score: number;
  verdict: string;
  result: GameResult | null;
  reveal: DiveReveal[] | null;
}
export interface ConnectionsDay {
  date: string;
  access: GameAccess;
  /** The day's 16 words in shared starting order; empty while locked. */
  words: string[];
}
export interface ConnectionsRevealedGroup {
  name: string;
  words: string[];
  /** 0 easiest to 3 hardest. */
  level: number;
}
export interface ConnectionsCheck {
  outcome: 'correct' | 'one_away' | 'wrong';
  mistakes: number;
  finished: boolean;
  won: boolean;
  /** Solved groups in solve order. */
  solved: ConnectionsRevealedGroup[];
  /** Every group once the board is finished, otherwise null. */
  groups: ConnectionsRevealedGroup[] | null;
}
export type GameScoreDirection = 'higher' | 'lower';
export interface GameAccess {
  date: string;
  unlocked: boolean;
  reason: 'staff' | 'workout' | 'rest_day' | 'locked';
}
export interface WordGuessDay {
  date: string;
  access: GameAccess;
  guesses: { word: string; marks: Mark[] }[];
  done: boolean;
  won: boolean;
  /** Hidden until the game is finished. */
  answer: string | null;
}
export interface GameInfo {
  id: GameId;
  direction: GameScoreDirection;
}
export interface GameResult {
  game_id: GameId;
  date: string;
  user_id: string;
  score: number;
  payload: unknown;
  created_at: string;
  updated_at: string;
}
export interface GamesToday {
  date: string;
  access: GameAccess;
  games: GameInfo[];
  results: GameResult[];
}
export interface GameDayRow {
  rank: number;
  user: PublicUser;
  score: number;
  me: boolean;
}
export interface GameDayLeaderboard {
  game_id: GameId;
  date: string;
  final: boolean;
  players: number;
  rows: GameDayRow[];
}
export interface GamesWeekRow {
  rank: number;
  user: PublicUser;
  points: number;
  days: number;
  me: boolean;
}
export interface GamesWeekLeaderboard {
  week_start: string;
  rows: GamesWeekRow[];
}
export interface DiveAnswerExport {
  date: string;
  user_id: string;
  prompt_index: number;
  answer: string;
  normalized: string;
  canonical: string | null;
  tier: DiveTier;
  points: number;
  hidden_at: string | null;
  hidden_by: string | null;
  created_at: string;
}
/** `GET /api/me/export`: the signed-in user's own data. Image bytes are fetched via `GET /api/images/:id`. */
export interface AccountDataExport {
  game_results: GameResult[];
  dive_answers: DiveAnswerExport[];
  format_version: 1;
  exported_at: string;
  profile: User;
  roster: RosterRow | null;
  weekly_targets: WeeklyTarget[];
  workouts: AccountExportWorkout[];
  erg_tests: Omit<ErgTest, 'is_pr'>[];
  images: ImageMetadata[];
  comments: AccountExportComment[];
  kudos_given: Kudos[];
  plans: MyPlan[];
  tagged_in: AccountExportTag[];
  mentioned_in: AccountExportMention[];
}
export interface AdminUserRemoveRequest {
  confirmation_email: string;
}
export interface IntroStatus {
  completed_at: string | null;
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
  'GET /api/games/dive/today': Endpoint<void, DiveDay>;
  'POST /api/games/dive/answers': Endpoint<
    { prompt_index: number; answer: string },
    DiveAnswerResult
  >;
  'GET /api/games/dive/days/:date': Endpoint<void, DiveDay>;
  'PATCH /api/games/dive/answers': Endpoint<
    { date: string; prompt_index: number; normalized: string; hidden: boolean },
    DiveReveal
  >;
  'GET /api/games/connections/today': Endpoint<void, ConnectionsDay>;
  'GET /api/games/wordguess/today': Endpoint<void, WordGuessDay>;
  'POST /api/games/wordguess/guess': Endpoint<{ guess: string }, WordGuessDay>;
  'POST /api/games/connections/check': Endpoint<{ guesses: string[][] }, ConnectionsCheck>;
  'GET /api/games': Endpoint<void, GamesToday>;
  'GET /api/games/access': Endpoint<void, GameAccess>;
  'POST /api/games/:game/results': Endpoint<{ payload: unknown }, GameResult>;
  'GET /api/games/:game/results/me': Endpoint<void, GameResult | null, { date?: string }>;
  'GET /api/games/:game/leaderboard': Endpoint<void, GameDayLeaderboard, { date?: string }>;
  'GET /api/games/leaderboard': Endpoint<void, GamesWeekLeaderboard, { week?: string }>;
  'GET /api/users/:id/tests': Endpoint<void, ErgTest[]>;
  'POST /api/me/tests': Endpoint<ErgTestInput, ErgTest>;
  'PATCH /api/me/tests/:id': Endpoint<Partial<ErgTestInput>, ErgTest>;
  'DELETE /api/me/tests/:id': Endpoint<void, void>;
  'GET /api/stats/recap': Endpoint<void, WeeklyRecap, { week?: string }>;
  'GET /api/challenges': Endpoint<void, TeamChallenge[]>;
  'GET /api/admin/challenges': Endpoint<void, TeamChallenge[]>;
  'POST /api/admin/challenges': Endpoint<TeamChallengeInput, TeamChallenge>;
  'PATCH /api/admin/challenges/:id': Endpoint<Partial<TeamChallengeInput>, TeamChallenge>;
  'POST /api/admin/challenges/:id/end': Endpoint<void, TeamChallenge>;
  'DELETE /api/admin/challenges/:id': Endpoint<void, void>;
  'GET /api/health': Endpoint<void, { ok: true; schema_version: number }>;
  'POST /api/auth/signup': Endpoint<SignupRequest, User>;
  'POST /api/auth/roster': Endpoint<{ team_code: string }, RosterChoice[]>;
  'POST /api/auth/login': Endpoint<LoginRequest, User>;
  'POST /api/auth/logout': Endpoint<void, void>;
  'GET /api/me': Endpoint<void, User>;
  'GET /api/me/intro': Endpoint<void, IntroStatus>;
  'POST /api/me/intro': Endpoint<void, IntroStatus>;
  'PATCH /api/me': Endpoint<ProfilePatch, User>;
  'POST /api/me/password/verify': Endpoint<PasswordVerifyRequest, PasswordVerifyResponse>;
  'POST /api/me/password': Endpoint<PasswordChangeRequest, void>;
  'POST /api/auth/passkey/options': Endpoint<void, PasskeyLoginOptions>;
  'POST /api/auth/passkey/login': Endpoint<PasskeyAssertion, User>;
  'GET /api/me/passkeys': Endpoint<void, Passkey[]>;
  'POST /api/me/passkeys/options': Endpoint<
    PasskeyRegistrationOptionsRequest,
    PasskeyRegistrationOptions
  >;
  'POST /api/me/passkeys': Endpoint<PasskeyAttestation, Passkey>;
  'DELETE /api/me/passkeys/:id': Endpoint<void, void>;
  'GET /api/me/target': Endpoint<void, CurrentWeeklyTarget>;
  'PUT /api/me/target': Endpoint<{ target_m: number }, WeeklyTarget>;
  'GET /api/config': Endpoint<void, Config>;
  'GET /api/entries': Endpoint<
    void,
    Page<EntryDetail>,
    { scope?: 'feed' | 'mine' | `user:${string}`; cursor?: string }
  >;
  /** Optional Idempotency-Key (8–128 alphanumeric, _ or -): per-user replay returns the original entry (200; first create 201), or 404 if deleted. Mappings are pruned after seven days on insert. */
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
  'PATCH /api/comments/:id': Endpoint<{ body: string; mention_ids?: string[] }, CommentWithAuthor>;
  'POST /api/reports': Endpoint<ReportInput, { id: string }>;
  'GET /api/admin/reports': Endpoint<
    void,
    Page<ContentReport>,
    { status?: ContentReport['status']; cursor?: string }
  >;
  'PATCH /api/admin/reports/:id': Endpoint<{ action: 'dismiss' | 'delete' }, ContentReport>;
  'POST /api/images': Endpoint<Blob, { id: string }>;
  'GET /api/images/:id': Endpoint<void, Blob>;
  'GET /api/stats/week': Endpoint<void, WeekStats, { week?: string; user?: string }>;
  'GET /api/stats/season': Endpoint<
    void,
    SeasonStats,
    ({ season?: number; year?: never } | { year: number; season?: never }) & { user?: string }
  >;
  'GET /api/stats/race': Endpoint<void, TeamRace, { week?: string }>;
  'GET /api/leaderboard': Endpoint<
    void,
    LeaderboardRow[],
    { week?: string; metric?: 'percent' | 'meters' | 'season' }
  >;
  'GET /api/users': Endpoint<void, PublicUser[]>;
  'GET /api/users/:id': Endpoint<void, Profile>;
  'GET /api/announcements': Endpoint<void, Announcement[]>;
  'GET /api/announcements/:id': Endpoint<void, Announcement>;
  'POST /api/announcements': Endpoint<AnnouncementInput, Announcement>;
  'PATCH /api/announcements/:id': Endpoint<Partial<AnnouncementInput>, Announcement>;
  'DELETE /api/announcements/:id': Endpoint<void, void>;
  'GET /api/notifications': Endpoint<void, Notification[]>;
  'POST /api/notifications/read': Endpoint<{ ids: string[] }, void>;
  'GET /api/plan': Endpoint<void, Plan, { group?: GroupKey }>;
  'GET /api/me/plan': Endpoint<void, MyPlan | null, { date?: string }>;
  'PUT /api/me/plan': Endpoint<MyPlanInput, MyPlan>;
  'DELETE /api/me/plan/:start': Endpoint<void, void>;
  'GET /api/me/export': Endpoint<void, AccountDataExport>;
  'GET /api/me/export/workouts': Endpoint<void, string>;
  'GET /api/me/push': Endpoint<void, PushConfig>;
  'PUT /api/me/push': Endpoint<PushSubscriptionInput, void>;
  'DELETE /api/me/push': Endpoint<{ endpoint: string }, void>;
  'GET /api/admin/users': Endpoint<void, User[]>;
  'PATCH /api/admin/users/:id': Endpoint<AdminUserPatch, User>;
  'POST /api/admin/users/:id/reset-password': Endpoint<void, { temporary_password: string }>;
  'POST /api/admin/users/:id/remove': Endpoint<AdminUserRemoveRequest, void>;
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
