# Stanford Rowing OYO — Architecture & Product Spec

Source of truth for everyone building this app. Read fully before changing code.

## 1. Product

An "on your own" (OYO) training app for Stanford Rowing. Rowers log extra training (erg, bike, run) done
on top of water sessions and team lifts. Every session converts into **equivalent C2 Erg E meters**
("E-meters"). Rowers set weekly E-meter targets, track progress through the week, see their season/year
totals, share workouts with photos (Strava/Instagram style), and compete on a weekly leaderboard ranked
by % of target completed. Coxswains/coaches run the app (staff powers).

Users: ~60-100 people on phones (iOS Safari / Android Chrome, installed as a PWA) and laptops.

## 2. Training math (from the team spreadsheet — do not change semantics)

```
equivalent_E_meters = distance_m * mode_factor * zone_factor
```

Mode factors (default, staff-editable): Erg 1.0, Bike 0.3333 (= 1/3, "bike is 1/3 the mileage of erg"), Run 1.25.

Zone factors (default, staff-editable), pace offset is seconds per 500m added to the athlete's best 6k split
(A uses best 2k split + 0):

| Zone | Factor | Pace basis | Offset (s/500m) |
| ---- | ------ | ---------- | --------------- |
| R    | 0.80   | 6k         | +20.0           |
| R/E  | 0.90   | 6k         | +17.5           |
| E    | 1.00   | 6k         | +15.0           |
| E/D  | 1.15   | 6k         | +12.5           |
| D    | 1.35   | 6k         | +10.0           |
| D/C  | 1.60   | 6k         | +7.5            |
| C    | 2.10   | 6k         | +5.0            |
| C/B  | 3.00   | 6k         | +2.5            |
| B    | 5.00   | 6k         | +0.0            |
| A    | 9.00   | 2k         | +0.0            |

Checks (must hold in unit tests): 60k E bike → 20,000; 4x5k D erg (20k) → 27,000; campus loop (6,240 m) E run → 7,800 and
D run → 10,530; 3x20k R bike → 16,000; 12k D erg → 16,200. Round equiv_m to the nearest whole meter.

Distance needed for a target (Equivalent Distance Menu): `distance = target / (mode_factor * zone_factor)`.
E.g. 10 E-km target, bike, zone E → 30.0 km; run, zone D → 5.93 km.

Target pace per zone (/500m) = best6kSplit + offset (A: best2kSplit). Shown in the Pace Calculator and on the profile.

Factors are snapshotted on each entry at write time (`mode_factor`, `zone_factor`, `equiv_m` stored).
Staff can change factors (affects new entries) and run "Recalculate all entries" explicitly.

### Weekly volume targets (on top of water + lifts)

| Group               | Key      | Default weekly target |
| ------------------- | -------- | --------------------- |
| U23/Senior hopefuls | `u23`    | 100,000               |
| Normal non-frosh    | `normal` | 80,000                |
| Frosh               | `frosh`  | 60,000                |

Staff edit group defaults. Each rower can set a personal weekly target (overrides group default). Targets are
versioned per week: table `weekly_targets(user_id, week_start, target_m)`. The target for week W is the row with the
greatest `week_start <= W`; if none, the group default. Setting a target applies to the current week onward
(never rewrites past weeks).

### OYO workouts per fortnight (guidance shown on the Plan screen)

| Session            | Splits         | Frequency | Load      |
| ------------------ | -------------- | --------- | --------- |
| D Erg Session      | D 6k +10 ± 2.5 | 1x        | 20k+      |
| Running            | D              | 2x        | 7.5k+     |
| Lifting with Evan* | –              | 2x        | 10k total |

\* Extra lifts are recommended for people who have talked about it with the coaches.

### Weeks, seasons, time zone

- Weeks run **Monday 00:00 → Sunday 23:59, America/Los_Angeles**. `week_start` is the Monday as `YYYY-MM-DD`.
- Entry `date` is a local calendar date `YYYY-MM-DD` chosen by the user (default today in America/Los_Angeles).
- "Season" = Sep 1 → Aug 31 (season start month/day staff-editable in settings). Profile also offers calendar year.

## 3. Seed data

### Workout Menu (presets; equiv in E-meters). `formula` presets use "meters × multiplier" with the user entering meters.

Erg:

- R: 4x5k w/1' rest r18-20 → 16,000 (20,000 m); 3x6k w/1' r18-20 → 14,400 (18,000 m); 2x10k w/2' r18-20 → 16,000 (20,000 m)
- R/E: 4x5k → 18,000; 3x6k → 16,200; 2x10k w/2' → 18,000
- E: 4x5k w/1' r18-20 → 20,000; 3x6k w/1' → 18,000; 2x10k w/2' → 20,000; 2x8k w/90" → 16,000; 3x25' w/1' r18-20 → meters rowed (formula ×1.0)
- E/D: 4x5k w/2' r20-22 → 23,000; 3x6k w/2' → 20,700; 2x10k w/3' → 23,000; 2x8k w/2' → 18,400
- D: 4x5k r2' → 27,000; 12k → 16,200; 3x6k w/2' → 24,300; 4x4k w/2' → 21,600
- D/C: 4x4k r3' → 25,600; 10k r22 → 16,000; 54' pyramid r22 (1'/3'/5'/7'/9'/8'/6'/4'/2' r1') → meters × 1.6
  Bike:
- R: 120' → meters × 0.267; 3x20k w/1' → 16,000; 5x12k w/1' → 60,000 m (math gives 16,000; the sheet's 12.8 is a sheet error); 6x10k w/1' → 16,000
- R/E: 120' → ×0.3; 3x20k → 18,000; 5x12k → 60,000 m (math gives 18,000); 6x10k → 18,000
- E: 120' → ×0.333; 100' → ×0.333; 80k → 26,700; 60k → 20,000; 45k → 15,000; 3x30k w/1' → 30,000
- E/D: 120' → ×0.383; 100' → ×0.383; 80k → 30,700; 60k → 23,000; 40k → 15,300
- D: 2x50' w/2' → ×0.45; 90' → ×0.45; 80k → 36,000; 60k → 27,000; 40k → 18,000
- D/C: 90' → enter meters (meters × 0.533)
  Run:
- E: Campus loop easy → 7,800; Dish loop from A hall easy → 14,100
- D: Campus loop firm → 10,600; Dish loop from A hall firm → 19,000

Rule: a preset stores `modality`, `zone`, `name`, and either a fixed `distance_m` (so equiv = math) or is
"enter meters" (time-based pieces like 120' or 3x25'). Always compute equiv with the math; fixed run presets use real
loop distances so the math reproduces the sheet: campus loop = 6,240 m, Dish loop from A hall = 11,280 m. Presets are
staff-editable.

### Sample fortnights (Plan screen; staff-editable). Slots: AM, PM1, PM2 for Mon..Sun. Kind: `team` (white), `oyo` (zone colored), `off`.

Frosh W1: Mon AM Team Row E, PM1 Team Erg C (counts for OYO extra meters) | Tue AM Team Row C Stake Race, PM1 Team Lift |
Wed AM OYO E Erg 3x6k r1' (18k) | Thu AM Team Row E, PM1 Team Lift | Fri AM Team Row E/D, PM1 OYO E Bike 42k (14k), PM2 OYO E campus loop run (8k) |
Sat AM Team Row D/C | Sun Off. Total "40k Equivalent + Monday PM".
Frosh W2: Mon AM Team Row E, PM1 OYO D Erg 3x5k r2' (20k), PM2 OYO D campus loop run (10k) | Tue AM Team Row D, PM1 Team Lift |
Wed AM OYO E Erg 4x5k r1' (20k) | Thu AM Team Row 30'r20 C Row, PM1 Team Lift | Fri AM Team Row E, PM1 OYO 36k E bike (12k) |
Sat AM Team Row D/C | Sun Off. Total 60k.
Normal W1: Mon AM Team Row E, PM1 Team Erg C (counts) | Tue AM Team Row C Stake Race, PM1 Team Lift | Wed AM OYO E Erg 4x5k r1' (20k), PM1 OYO 36k E bike (12k) |
Thu AM Team Row E, PM1 Team Lift | Fri AM Team Row E/D, PM1 OYO E Bike 60k (20k), PM2 OYO E campus loop run (8k) | Sat AM Team Row D/C | Sun Off. Total "60k + Monday PM".
Normal W2: Mon AM Team Row E, PM1 OYO D Erg 3x5k r2' (20k), PM2 OYO D campus loop run (10k) | Tue AM Team Row D, PM1 Team Lift |
Wed AM OYO E Erg 4x5k r1' (20k), PM1 OYO E Bike 36k (12k) | Thu AM Team Row 30'r20 C Row, PM1 Team Lift | Fri AM Team Row E, PM1 OYO E Erg 3x6k r1' (18k) |
Sat AM Team Row D/C | Sun Off. Total 80k.
U23 W1: Mon AM Team Row E, PM1 Team Erg C (counts) | Tue AM Team Row C Stake Race, PM1 Team Lift | Wed AM OYO E Erg 4x6k r1' (24k), PM1 OYO 48k E bike (16k) |
Thu AM Team Row E, PM1 Team Lift, PM2 OYO E Erg 2x6k r1' | Fri AM Team Row E/D, PM1 OYO E Bike 60k (20k), PM2 OYO E campus loop run (8k) | Sat AM Team Row D/C | Sun Off. Total "80k + Monday PM".
U23 W2: Mon AM Team Row E, PM1 OYO D Erg 4x5k r2' (27k), PM2 OYO D campus loop run (10k) | Tue AM Team Row D, PM1 Team Lift |
Wed AM OYO E Erg 4x6k r1' (24k), PM1 OYO 45k E bike (15k) | Thu AM Team Row 30'r20 C Row, PM1 Team Lift | Fri AM Team Row E, PM1 OYO E Erg 4x6k r1' (24k) |
Sat AM Team Row D/C | Sun Off. Total 100k.

## 4. Roles & auth

Roles: `rower`, `coxswain`, `coach`, `admin`. **Staff** = coxswain | coach | admin. Admin additionally manages other admins.

- Sign up: enter the team code → pick an unclaimed roster name → pick a training group (rowers only) → enter your
  own email and password (min 8). Names and roles come from the roster, never from signup input. Staff's group selector
  is hidden; their group defaults to the roster group or `normal`. Rowers use their selected group, then the roster
  group, then `normal`. Side/class year are adopted from the roster. A valid code is required to discover names;
  discovery returns only id/name/role for unclaimed rows without a bound email. Team/user directories require login.
- Email-bound roster rows are excluded from discovery and can only be claimed by that email (case-insensitive),
  without a team code or roster selection. An explicitly supplied, different roster id is rejected. Normal signup
  requires a valid code and an existing, unclaimed, email-free roster id; an already claimed row returns `409 ROSTER_CLAIMED`.
- Claiming is atomic: after PBKDF2 runs in the stateless Worker, the DO re-validates the email and claims the roster id conditionally inside
  one SQLite transaction, then insert/update the user. Each roster row can have one claimant and each user one row.
- Staff can unlink a mistaken claim: deactivate the user, revoke all sessions and release the roster row atomically,
  with an audit record. An unclaimed row or your own row cannot be unlinked; only admins can unlink an admin user.
  Unlinking does not delete entries. Signing up again with the same email reactivates and reuses an inactive account
  **only if no roster row is still linked to it**: claim a new name, adopt its attributes, set the new password,
  clear the forced-change flag and keep training history. Other duplicate emails return `409 EMAIL_TAKEN`.
- Login: email + password. Passwords: HMAC-SHA256(key=`PASSWORD_PEPPER`, message=password) feeds PBKDF2-SHA256
  in the stateless Worker (WebCrypto, `PASSWORD_ITERATIONS=20000`, 16-byte random salt, pepper version 1).
  `password_hash` stores `pbkdf2-sha256$<iterations>$<pepper_version>$<salt_b64>$<hash_b64>`;
  `password_salt` remains populated for compatibility. Missing/blank `PASSWORD_PEPPER` fails hashing/verifying
  endpoints closed with 500 INTERNAL and logs `PASSWORD_PEPPER secret is not configured`; other endpoints still work.
  Unknown-email login performs the same current HMAC+PBKDF2 work as a current-format verification.
  Every request performs at most one PBKDF2 derivation. Login never rehashes; stronger parameters apply
  on the next password change or admin reset. Legacy unprefixed or unparseable hashes are rejected as
  invalid credentials (401), with a warning that contains no hash material; affected users need a staff reset.
  Versioned hashes verify using their stored parameters. Pepper rotation requires a version bump and a plan
  retaining access to old keys or resetting affected passwords: one configured secret does not retain retired keys.
  The Free plan's 10 ms CPU budget motivates 20k and the one-derivation rule.
  The DO rate-limits before derivation and re-validates account status and unchanged credentials before creating a session.
- Password-operation prechecks authenticate without renewing or deleting sessions. Before Worker HMAC/PBKDF2
  completes, only attempt counters can change: email/IP authentication attempts, and failed team-code attempts
  on rejected signup. Admin-reset prechecks write nothing. Session maintenance, claims, sessions, grants and
  credential writes happen only on the post-hash DO call. A mid-hash interruption leaves those unchanged;
  an immediate retry consumes another attempt, subject to the existing limits and grant expiry.
  This is not general response-loss idempotency: if a commit succeeded but its response was lost, a signup
  retry conflicts, a consumed-grant change requires reauthentication, and another admin reset replaces the
  previous temporary password. These endpoints do not accept idempotency keys.
- Sessions: random 32-byte token in an HttpOnly, Secure, SameSite=Lax cookie `oyo_session`, 60-day sliding expiry;
  only SHA-256(token) stored. Logout deletes it.
- Password reset: staff generate a one-time temporary password for a user (shown once to staff); user must change on next login.
  Password changes and resets derive hashes in the Worker; the DO re-validates sessions, credentials and authorization before writing.
- Normal password changes are two requests: verify the current password, then change using a re-auth grant.
  The grant is a random 32-byte token; store only SHA-256(token), bound to session hash, user and the
  credential hash/salt verified, with a five-minute TTL. Issuing and consuming grants recheck the live
  session, active user and unchanged credentials synchronously after all awaits. Consumption and password
  write are atomic; the write deletes all this user's grants and revokes other sessions. A forced change
  (`must_change_password=1`) needs no grant, since login verified the temporary password. A normal change
  with a missing/invalid/expired/used grant returns 401 REAUTH_REQUIRED. The legacy `current_password`
  field on the change request is rejected with 400; it never triggers a second derivation. The new password
  must be 8–200 characters; it is not compared to the old plaintext password across the two requests.
- Bootstrap: the roster is seeded with Joshua Koo (`joskoo@stanford.edu`) as `admin`. On first boot, `team_code` uses the trimmed optional
  `TEAM_CODE` Worker secret, or a generated UUID when absent. Codes must be 4–64 letters, numbers or hyphens
  after trimming, including in admin settings PATCH. Invalid secrets (blank, short, long or invalid characters)
  are logged without their values and replaced by a generated UUID, not a startup failure.
  Existing settings are never overwritten; staff can change the code in Admin → Team settings.
  Join codes are compared trimmed and case-insensitively (constant-time) in roster discovery and signup.
- Rate-limit login/signup (also password verification and change prechecks) with independent counters: 10 attempts per
  normalized email across IPs and 150 attempts per IP across emails, each over 15 minutes. The shared-IP
  budget permits campus NAT onboarding (60 signups plus later logins) while bounding authenticated abuse.
  Both are checked atomically in the DO before Worker crypto. Failures count; success clears only the
  email bucket, never the aggregate IP budget. Exhaustion returns 429 with Retry-After.
- A separate failed-team-code budget is shared across public roster discovery and normal signup:
  20 wrong/missing/invalid codes per IP per 15 minutes (window starts on the first failure).
  Check it before validating a code; after 20 failures, even a correct code gets 429 with Retry-After
  until expiry. Valid codes neither increment nor clear this counter. Email-bound bootstrap skips
  code validation and this counter entirely. This replaces the old 10/IP discovery-attempt limit:
  correct-code roster discovery is not capped, so the whole team can discover from one boathouse IP.
  Wrong-code signup also consumes the unchanged 10/email and 150/IP signup-attempt budgets above.
- Only rowers appear on leaderboards by default (`on_leaderboard` flag, staff-editable); all staff, including admins,
  default false. Roster seeds in `shared/seed.ts`: 35 rowers, three coxswains, Joshua Koo; no coaches.

## 5. Data model (SQLite inside one Durable Object `TeamDO`, id name "stanford")

```
users(id TEXT PK, email TEXT UNIQUE (lowercase), name, password_hash, password_salt, must_change_password INT,
      role, group_key ('frosh'|'normal'|'u23'), side ('port'|'starboard'|'both'|'cox'|NULL), class_year INT NULL,
      bio TEXT, avatar_image_id TEXT NULL, best6k_split_s REAL NULL, best2k_split_s REAL NULL,
      on_leaderboard INT, active INT, created_at, updated_at)
sessions(token_hash PK, user_id, expires_at, created_at)
roster(id TEXT PK, name NOT NULL, email NULL, role, group_key NULL, side, class_year,
       claimed_by_user_id NULL REFERENCES users(id), added_by, created_at)
       -- unique lower(email) where not null; unique claimed_by_user_id where not null
settings(key PK, value_json)            -- team_code, zone_factors, mode_factors, group_targets, season_start ("09-01")
weekly_targets(user_id, week_start, target_m, PK(user_id, week_start))
entries(id PK, user_id, date, week_start, modality ('erg'|'bike'|'run'), zone, distance_m INT, duration_s INT NULL,
        avg_split_s REAL NULL, stroke_rate INT NULL, avg_hr INT NULL, title, notes, preset_id NULL,
        mode_factor REAL, zone_factor REAL, equiv_m INT, visibility ('team'; legacy 'private' input ignored),
        created_at, updated_at)          -- index (week_start), (user_id, date)
images(id PK, owner_id, mime, width, height, bytes BLOB, created_at)   -- <= 1.5 MB each, client resizes
entry_images(entry_id, image_id, position, PK(entry_id, position))     -- up to 4 per entry
entry_tags(entry_id TEXT NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL, PK(entry_id,user_id)) -- index (user_id)
kudos(entry_id, user_id, created_at, PK(entry_id, user_id))
comments(id PK, entry_id, user_id, body (<=1000), created_at, edited_at TEXT NULL)
comment_mentions(comment_id TEXT NOT NULL, entry_id TEXT NOT NULL, user_id TEXT NOT NULL, PK(comment_id,user_id)) -- index (entry_id)
comment_mention_history(comment_id, entry_id, user_id, PK(comment_id,user_id)) -- index (entry_id)
content_reports(id PK, target_type ('entry'|'comment'), target_id, entry_id, reporter_id, reason (<=300),
                status ('open'|'dismissed'|'deleted'), created_at, reviewed_at NULL, reviewed_by NULL)
                -- unique (reporter_id,target_type,target_id); no cascading foreign keys
                -- indexes (status,created_at DESC,id DESC), (target_type,target_id,status), (entry_id,status)
announcements(id PK, author_id, title, body, pinned INT, created_at)
presets(id PK, modality, zone, name, distance_m INT NULL, sort INT, active INT)   -- NULL distance = user enters meters
plan_slots(group_key, week INT (1|2), day INT (0=Mon..6), slot ('AM'|'PM1'|'PM2'), kind ('team'|'oyo'|'off'), zone NULL, text,
           PK(group_key, week, day, slot))
plan_totals(group_key, week, label)     -- e.g. "60k Equivalent"
my_plans(user_id, start_date, rest_days_json, updated_at, PK(user_id, start_date))
my_plan_sessions(user_id, start_date, week, day, slot, modality, zone, distance_m NULL, note,
                 PK(user_id, start_date, week, day, slot))
notifications(id PK, user_id, kind ('kudos'|'comment'|'announcement'|'tag'|'mention'|'report'), actor_id, entry_id NULL, created_at, read_at NULL)
audit_log(id PK, actor_id, action, target, detail_json, created_at)
```

Schema migrations: a `schema_version` setting; migrations run in the DO constructor via `blockConcurrencyWhile`.
Version 7 adds idempotent tag/mention tables and indexes.
Version 8 adds personal plans and sessions after version 7; both migrations are idempotent and transactional.
Entry deletion removes tags and mentions; comment deletion transactionally removes its mentions.
Tags are social only and never credit the tagged user's meters, statistics or leaderboard.
Version 3 deliberately drops the legacy email-keyed roster and rebuilds/seeds the id-keyed roster (nothing deployed).
Seeds are insert-if-missing by case-insensitive name. The claimant foreign key is initially deferred so the atomic
claim can reserve the row before inserting its user in the same transaction.
Version 4 adds read-path indexes: `entries(visibility,created_at DESC,id DESC)`,
`entries(user_id,created_at DESC,id DESC)`, `comments(entry_id,created_at,id)`, `entry_images(image_id)`,
and `notifications(user_id,created_at DESC,id DESC)`. Feed/mine, comments and notifications order by the matching
timestamp/id direction; image-reference lookups use the image-id index.
Version 5 adds `reauth_grants(token_hash PK, session_hash, user_id, credential_hash, credential_salt, expires_at)`.
Expired grants are cleaned when issuing a new one; deletion consumes a grant, never storing its plaintext token.
Version 6 converts every legacy private entry to `team` without modifying workout content or timestamps. The update
and version advance are atomic and idempotent; its self-contained migration block can be renumbered independently.
Version 8 adds the owner-only personal fortnight tables `my_plans` and `my_plan_sessions`
with idempotent CREATE TABLE IF NOT EXISTS. The composite plan primary key indexes owner/date windows.
Version 13 adds nullable comment `edited_at`, per-comment mention notification history (backfilled from current
mentions), and durable content reports with queue/target/parent indexes. This is one transactional, idempotent
`version < 13` migration; gaps 10–12 are intentional. Reports survive content deletion without a cascade.

## 6. API (JSON, same origin, under `/api`). Errors: `{ error: { code, message } }` with proper HTTP status.

Alongside the group/team Plan, My Fortnight is personal: `GET /api/me/plan?date=YYYY-MM-DD`
returns `MyPlan | null` for the 14-day window containing date (default today in America/Los_Angeles).
`PUT /api/me/plan` takes `MyPlanInput` and atomically replaces the plan starting on its Monday
`start_date`; another start within ±13 days returns 409, while ±14-day neighbours are allowed.
`DELETE /api/me/plan/:start` deletes only the authenticated owner's plan (204; absent = 404).
No route accepts a user parameter or provides staff access to another person's plan. Personal plans
are excluded from CSV exports and audit logs. Existing /me session and deactivation guards apply.
`MyPlanInput` contains `start_date`, `sessions` (at most 42) and `rest_days` (at most 14).
Each session has week 1|2, integer day 0=Monday..6, slot AM|PM1|PM2, valid modality/zone,
nullable integer distance_m 1..200000 and a trimmed note of at most 200 characters.
Session keys and rest days must be unique; sessions on rest days are rejected (400 VALIDATION_ERROR).
`MyPlan` adds `updated_at`, per-week `planned_m: [number, number]`, and per-session
`equiv_m` (null for unknown distance) and `completed_entry_id`. Equivalents are computed on read
with current settings factors, never snapshotted. Completion uses the owner's workout `date`,
without a visibility predicate, within the inclusive 14-day window. Per day, sessions in AM, PM1, PM2
order greedily consume the oldest unmatched same-modality entry by created_at then id.
Deleted entries do not count. GET uses a constant number of SQL queries, including one entry query.

Entry input accepts optional `tagged_user_ids: string[]`: POST sets tags; PATCH replaces the
set only when supplied. Entry itself omits this input-only field; EntryDetail adds
`tagged: PublicUser[]`, active users ordered by tag time then name.
Comment POST accepts `{ body: string; mention_ids?: string[] }`; CommentWithAuthor adds
`mentions: PublicUser[]` (active users). Existing clients may omit either input field.
`PATCH /api/comments/:id` accepts the same body and returns CommentWithAuthor. Only the comment author can
edit, including when the requester is staff; author/staff deletion remains unchanged. Body is trimmed and
must contain 1–1000 characters. `edited_at?: string | null` is always returned at runtime, null initially;
only a changed trimmed body sets it, and a no-op preserves it. UI shows “edited” for non-null timestamps.
An omitted `mention_ids` reparses current active mentions against the new body; a supplied array replaces
the candidate set using the existing validation below. Removed names lose mention metadata. Only newly
mentioned recipients are notified, with durable per-comment history suppressing remove/readd spam.
Editing never sends another ordinary comment notification to the entry owner.

Both recipient fields must be arrays of strings, deduplicated with self silently dropped
(entry owner for tags, commenter for mentions). At most ten unique remaining IDs are
allowed and all must identify active users, otherwise 400 VALIDATION_ERROR. Mentions then
silently discard IDs whose full name is absent as `@Full Name` in the body, ignoring case;
the following character must be end, whitespace or punctuation, not a letter/digit.
Validation of the cap and active IDs happens before body filtering.

Writes and notifications share one transaction. Newly added tags notify with kind `tag`,
actor=requester and entry_id; an existing tag notification for that recipient/entry
suppresses untag/retag spam. Mention recipients each get one `mention` notification per
comment with entry_id. An entry owner mentioned in a comment gets only `mention`, not
also `comment`. No self or inactive-user notifications. Notification columns are unchanged.
Tag and mention hydration use one batched query per entry page or comment list, respectively.

Mutation requests must use JSON/image Content-Type or send `X-OYO-CSRF: 1` (including bodyless mutations); cross-site origins are rejected.

Auth: public `POST /api/auth/roster` ({team_code} → RosterChoice[]),
`POST /api/auth/signup` ({team_code?, roster_id?, email, password, group_key?} → User),
`POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/me`, `PATCH /api/me`
(name, bio, group_key, side, class_year, best splits, avatar), `PUT /api/me/target` ({target_m} → current week onward).
Authenticated `POST /api/me/password/verify` takes `{ current_password: string }` and returns
`{ reauth_token: string; expires_at: string }` (ISO). Wrong passwords return 401 INVALID_CREDENTIALS;
verification shares the 10/email and 150/IP per 15 minutes limiter, checked before crypto.
`POST /api/me/password` takes `{ new_password: string; reauth_token?: string }`, returns 204, and
accepts no legacy `current_password` (400 VALIDATION_ERROR). The token is optional only for a forced
change; otherwise missing, invalid, expired or reused tokens return 401 REAUTH_REQUIRED. Revoked sessions
or inactive users return 401 UNAUTHENTICATED; credentials changed in flight return 409 CREDENTIALS_CHANGED.
Config: `GET /api/config` (factors, group targets, season start, presets, zones list, server-computed
`today` and `current_week_start` as YYYY-MM-DD in America/Los_Angeles) — public to logged-in users.
`GET /api/me/target` returns the effective current-week target:
`{ week_start, target_m, source: 'personal' | 'group' }`.
Entries: `GET /api/entries?scope=feed|mine|user:<id>&cursor=` (feed = team-visible, newest first, paginated 20),
`POST /api/entries`, `GET/PATCH/DELETE /api/entries/:id` (owner or staff), `POST/DELETE /api/entries/:id/kudos`,
`GET/POST /api/entries/:id/comments` (both return comments with `author: PublicUser`),
`DELETE /api/comments/:id` (author or staff).
`PATCH /api/comments/:id` is author-only (including staff); details are above.
`GET /api/entries/:id/kudos` returns `PublicUser[]` newest kudos first, ties by user id ascending.
It uses one LEFT JOIN query for entry existence and kudos→users (no N+1); no email/credentials are exposed.
Authentication is required (401); missing entries return 404. Every workout is team-visible.
Visible entries without kudos return `[]`.
Images: `POST /api/images` (raw body, image/jpeg|png|webp, ≤1.5MB) → {id}; `GET /api/images/:id` (immutable cache).
Authenticated image reads require ownership, use as any user's current avatar, or attachment to any existing team entry; otherwise 404, including conditional requests. Fresh unattached uploads remain
owner-readable only. Detaching images, deleting entries and replacing/clearing avatars delete only the affected images
that no entry or current avatar still references; unrelated fresh uploads are not garbage-collected.
Stats: `GET /api/stats/week?week=YYYY-MM-DD&user=` (target, total, by day, by modality/zone, entries),
`GET /api/stats/season?season=YYYY&user=` and `?year=YYYY` (weekly series with targets + hit flags, totals by modality/zone,
streak of consecutive weeks hitting target, best week, and `days: { date: string; equiv_m: number }[]`),
`GET /api/leaderboard?week=YYYY-MM-DD&metric=percent|meters|season`.
SeasonStats `days` is returned for both season/year variants and profile stats. One SQL aggregate query grouped by the
stored PT entry date produces ascending YYYY-MM-DD dates within the selected range through today (or range end).
Only days whose summed E-meters are positive are included; empty/zero-only days are omitted. Visibility rules match
all other stats fields below.
Team: `GET /api/users` (roster directory), `GET /api/users/:id` (public profile + stats summary).
Leaderboard rows also include `streak` (consecutive weeks hitting target up to the selected week)
and `entry_count` for that week.
Week parameters accept real YYYY-MM-DD dates from 2000-01-01 through 365 days after today (otherwise 400), then
normalize to Monday. Season leaderboard selection uses the original requested date, or today when omitted, before
week normalization so a September rollover week selects the correct season. Percent ranking compares exact
meters/target ratios by integer cross-multiplication, then meters; percentages are rounded only for display.
Stats and leaderboard load personal/group target histories once per request and reuse grouped entry aggregates for
weekly totals, counts, streaks and season breakdowns. Season/profile days still use one date aggregate query.
These read routes stay below 20 SQL calls regardless of roster size or number of entries. Target lookup before the
first group-history version uses its earliest version; an empty/missing history falls back to seed group targets.
Announcements: `GET /api/announcements`, staff `POST/PATCH/DELETE`; returned announcements include `author: PublicUser`.
Notifications: `GET /api/notifications`, `POST /api/notifications/read`; returned notifications include
`actor: PublicUser` and `entry_title: string | null`.
Reports: authenticated team members may `POST /api/reports` with
`ReportInput = { target_type: 'entry' | 'comment'; target_id: string; reason?: string }`.
The optional reason is trimmed, defaults to empty, and is limited to 300 characters. The target must exist
for a new report (404 otherwise). One report per reporter/item is enforced permanently: new returns
201 `{ id }`; a duplicate returns 200 with the original id, even after target removal or review, without
replacing the reason or sending notifications. No report read endpoint is available to rowers.
Active staff receive kind `report`, actor=reporter, entry_id=the parent entry, linked by UI to `/admin/reports`.
No new notification columns are needed. Reads filter report notifications using the recipient's current
active/staff status before applying the 100-notification limit, so demoted staff cannot see reporter identity.
Report notifications survive entry deletion; their entry_title then becomes null.
Staff-only `GET /api/admin/reports?status=open|dismissed|deleted&cursor=` defaults to open and returns
`Page<ContentReport>` with 50 items, newest first by created_at then id descending; invalid status/cursor is 400.
`ContentReport` includes id, target_type, target_id, entry_id, reporter: PublicUser, reason, status, created_at,
reviewed_at: string|null, reviewed_by: string|null, and live
`content: { author: PublicUser; body: string; title: string|null } | null`. Entry content uses notes/title;
comment content uses body/null title. Removed content hydrates as null, with no retained content snapshot.
Only staff see reporters/reasons; PublicUser never includes email or credentials.
Staff-only `PATCH /api/admin/reports/:id` takes `{ action: 'dismiss' | 'delete' }` and returns ContentReport.
Review records reviewed_at/by. An already reviewed report returns 409 for a different action; repeating the
same action is an idempotent 200 without additional audits. Delete succeeds even if content is already absent.
Deletion uses the existing entry/comment helpers, closes all other open reports on that target (and open
comment reports on a deleted entry) as deleted, and preserves reviewed reports. Direct author/staff content
deletion also closes open reports, recording the deleter and timestamp. All removal, report state changes,
image/join cleanup, and audit writes share one synchronous transaction. Explicit review audits `report.dismiss`
or `report.delete`, plus `entry.delete`/`comment.delete` when content is removed; auto-closed sibling reports
do not each generate a separate audit. Existing team-visible entries and owner-only My Fortnight are unchanged.
Staff (`/api/admin/*`): users list/edit (role, group, on_leaderboard, active), reset password, roster CRUD + bulk import
(CSV paste: name,email,role,group,side,class_year), settings (team code, factors, group targets, season start),
presets CRUD, plan CRUD, recalculate entries, compliance view for a week (each rower: target, total, %, last log),
CSV export of entries for a date range, audit log.
Roster routes: `GET/POST /api/admin/roster`, `PATCH/DELETE /api/admin/roster/:id`,
`POST /api/admin/roster/import`, `POST /api/admin/roster/:id/unlink` (→ updated RosterRow).
Roster email and group are nullable; roster ids, not emails, identify rows. Unlink is staff-only, returns 404 for
missing rows and `409 NOT_CLAIMED` for unclaimed rows; own-row unlink returns 409, unlinking an admin requires admin.
Roster creation requires a trimmed 1–80 character name and role; email is optional/null and normalized to lowercase.
Names and non-null emails must be unique case-insensitively (409 on conflict). Group, side and class year may be null.
PATCH changes only supplied fields. A claimed row's name, role, group, side and class year changes propagate to its
linked user atomically; an omitted field does not overwrite that user's independently chosen value. Explicitly clearing
the roster group resets a linked user's group to `normal`. Roster email edits do not change the user's login email.
Only admins may create/edit/delete admin rows or edit a row linked to an admin; linked-user demotion preserves the
last-active-admin protection (409). Claimed rows cannot be deleted (409); unlink first. Staff mutations are audited.
CSV accepts an optional header and five columns (`name,role,group,side,class_year`) or six (email after name).
Match by email when supplied, otherwise by case-insensitive name; update with the same PATCH permission/propagation
rules, or insert. Empty nullable cells clear those values; omitting the email column preserves existing email bindings.
Validation, permission and conflict errors are reported per physical row; permitted rows still import atomically per row.
Self-service `PATCH /api/me` validates `group_key` and changes only that user's group, not their roster default.
A self-service name change synchronizes the linked roster name in the same transaction, respecting name uniqueness.
Across the Durable Object, parse request bodies first, then refresh session/user and read, authorize and write
synchronously so no pre-await state is used for authorization or updates. Guards reload current sessions and users;
after password crypto, password changes recheck the live session, active status and verified credential hash/salt in
the write transaction. Login similarly compares credentials and active status after verification. Session-token hashing
finishes before the synchronous session commit; signup claims, user writes and session creation share one transaction.
Staff password resets reload both actor and target after hashing. Record PATCH writes use UPDATE with an existence
check, never replacement inserts; settings, target and plan upserts use ON CONFLICT DO UPDATE without deleting rows.

Validation: distance 1..200,000 m; date not more than 1 day in the future and not before 2020; zone in list; modality in list.
All entries are always team-visible. POST/PATCH accept the legacy `visibility` field but ignore it and store
`team`. Profiles, feed, week/season/year stats and leaderboard totals include every workout, for all team members.
Schema version 6 idempotently converts existing private entries to team visibility. Entry mutation remains owner/staff-only;
images retain their independent authenticated ownership/avatar/entry-reference authorization rules above.

## 7. Frontend

- Vite + React 18 + TypeScript + Tailwind + React Router + TanStack Query, lucide-react icons. Built assets served by the
  Worker (Workers static assets, SPA fallback). PWA: manifest, icons (192/512/maskable/apple-touch), theme color,
  `apple-mobile-web-app-capable`, safe-area insets, a small service worker for app-shell caching (never cache /api).
- Layout: mobile = bottom tab bar (Home, Feed, + Log (center, prominent), Leaderboard, Me); desktop ≥1024px = left
  sidebar with the same destinations + content column (max ~720px) and a right rail (week ring, announcements).
- Screens: Login/Signup, Home (week progress ring vs target, remaining meters, days left, quick-log presets, this week's
  sessions, pinned announcements, "suggested to hit target" using the distance menu), Log (modality segmented control,
  zone picker, distance or preset, optional time/split/rate/HR, live E-meter preview, notes, photos),
  Feed (cards: avatar, name, time, title, stats, E-meters, photos carousel, kudos, comments), Entry detail,
  Leaderboard (This Week % / This Week Meters / Season; week switcher; podium for top 3; highlight me; ≥100% check),
  Me/Profile (season & year totals, weekly bar chart with target line, modality/zone breakdown, streak, best week, my
  entries, edit profile, set weekly target, splits), Rower profiles, Plan (sample fortnight for my group w/ zone colors,
  fortnight guidance table, Workout Menu, Pace & Distance Calculator), Notifications, Settings (theme, password, logout),
  Admin (roster, compliance, settings & factors, presets, plan editor, announcements, export, audit log).
- Visual (Strava-inspired system, Stanford identity): clean white surfaces, near-black text `#242428`, secondary text
  `#6D6D78`, page/grouped background `#F7F7FA`, dividers `#DFDFE8`. **Cardinal `#8C1515` is the single main accent**
  (pressed `#6F1010`; on dark use `#C0352B`): primary buttons, Log button, progress rings, active tab, links.
  **Strava orange `#FC5200` (pressed `#CC4200`) only for highlights: PRs, streaks, "target hit" celebrations, best week.**
  Dark mode: background `#121214`, surface `#1C1C1F`, dividers `#2C2C31`, text `#F2F2F5`. Zone colors as in the sheet:
  E light green `#CFE6C4`, D green `#8DBE84`, C yellow `#FBE08F` (others interpolate) — used as small tags/chips only.
  Light + dark mode (system default, user toggle). System font stack (-apple-system, "SF Pro", Inter fallback). Native
  feel: 44px+ touch targets, segmented controls, sheets, no tiny tracked uppercase labels, no monospace micro labels,
  text ≥ 12px, Title Case buttons. Skeleton loaders, empty states, optimistic kudos, toast feedback, press states.
- Numbers: show E-meters as `20,000 m` or `20.0k`; never show raw floats.

## 8. Repo layout

```
/worker        Worker + TeamDO (TypeScript). src/index.ts (router), src/do.ts, src/db/*.ts, src/routes/*.ts
/shared        Pure TS shared by both: math.ts (factors, equiv, distance-for-target, paces), dates.ts (LA weeks), types.ts
/web           Vite React app
/docs          This file
wrangler.jsonc (root) — worker name `stanford-oyo`, assets dir web/dist, DO binding TEAM (sqlite class TeamDO)
```

Scripts (root package.json): `dev` (vite + wrangler dev), `build`, `typecheck`, `lint`, `test` (vitest), `deploy`.
