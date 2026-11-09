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
- Passkeys (WebAuthn: Face ID, Touch ID, Android fingerprint, Windows Hello, synced passkeys) are an optional second
  login method; password login is unchanged. Verification is in-house (CBOR + WebCrypto, no dependency) inside the DO:
  ES256 (COSE -7, P-256) and RS256 (COSE -257, RSA ≥ 2048 bits), attestation `none` (statements are not verified),
  user presence and user verification required. `rpId` is the request URL hostname, and `clientData.origin` must be
  `https://<that host>` (`http://localhost`/`127.0.0.1` allowed for local dev), so staging and production hosts each
  get their own credentials and no config is needed. Challenges are 32 random bytes stored server-side
  (`webauthn_challenges`), bound to kind (`register`/`login`) and, for registration, the user and session hash; they
  expire after 5 minutes, are deleted before verification (single use), and at most 2,000 are kept (oldest pruned).
  Login options rate-limit at 300 per IP per 15 minutes. A login assertion consumes one attempt from the existing
  10/email bucket of the credential's owner (unknown credentials: the 150/IP bucket), before signature checks;
  success clears the email bucket. Sessions are created by the same code path as password login (same cookie,
  expiry and active/credential checks). Inactive users get 403 ACCOUNT_INACTIVE. Sign counters: when either the
  stored or presented counter is non-zero, a presented counter that does not increase is rejected (401
  PASSKEY_CLONED, audited as `passkey.counter-regression`); always-zero authenticators (iCloud Keychain, Google
  Password Manager) are accepted. Registration (max 10 per user) needs a session created within 10 minutes or a
  password re-auth grant from `POST /api/me/password/verify` (401 REAUTH_REQUIRED otherwise); the grant is not
  consumed. Add/remove are audited (`passkey.add`, `passkey.remove`, actor = owner). Staff password reset keeps
  passkeys: it revokes sessions and forces a password change, and a passkey login after a reset still lands on the
  forced change (passkey user verification stands in for the temporary password). Staff deactivation/unlink blocks
  passkey login through `active`; re-claiming an inactive account through signup deletes its passkeys so a new owner
  never inherits them. Passkeys of a user who changes their own password are kept.
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
erg_tests(id TEXT PK, user_id TEXT NOT NULL, kind ('2k'|'6k'), date, time_s REAL, split_s REAL, created_at, updated_at) -- index (user_id,kind,date)
challenges(id TEXT PK, title, unit ('emeters'|'km'), goal_m INTEGER, modality NULL, start_date, end_date, created_by, created_at, updated_at, ended_at NULL)
roster(id TEXT PK, name NOT NULL, email NULL, role, group_key NULL, side, class_year,
       claimed_by_user_id NULL REFERENCES users(id), added_by, created_at)
       -- unique lower(email) where not null; unique claimed_by_user_id where not null
settings(key PK, value_json)            -- team_code, zone_factors, mode_factors, group_targets, season_start ("09-01"),
                                        -- berkeley_pace_percent (optional; absent = 90, no migration)
weekly_targets(user_id, week_start, target_m, PK(user_id, week_start))
entries(id PK, user_id, date, week_start, modality ('erg'|'bike'|'run'), zone, distance_m INT, duration_s INT NULL,
        avg_split_s REAL NULL, stroke_rate INT NULL, avg_hr INT NULL, title, notes, preset_id NULL,
        mode_factor REAL, zone_factor REAL, equiv_m INT, visibility ('team'; legacy 'private' input ignored),
        created_at, updated_at)          -- index (week_start), (user_id, date)
images(id PK, owner_id, mime, width, height, bytes BLOB, created_at)   -- <= 1.5 MB each, client resizes
entry_idempotency(user_id TEXT NOT NULL, key TEXT NOT NULL, entry_id TEXT NOT NULL, created_at TEXT NOT NULL, PK(user_id,key)) -- index (created_at)
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
user_intro(user_id PK, completed_at)
audit_log(id PK, actor_id, action, target, detail_json, created_at)
passkeys(id PK (credential id, base64url), user_id, alg INT, public_key (JWK json), sign_count INT,
         transports (json), aaguid, backup_eligible INT, backed_up INT, name, created_at, last_used_at NULL)
         -- index (user_id, created_at)
webauthn_challenges(challenge PK, kind ('register'|'login'), user_id NULL, session_hash NULL, expires_at, created_at)
         -- index (expires_at)
```

For announcement notifications, the existing nullable `notifications.entry_id` storage slot holds the
announcement reference (no foreign key); API hydration exposes it as optional `announcement_id` and keeps
`entry_id` null. Other kinds retain workout references. Legacy announcement rows have no reference and
retain author/time fallback resolution. This is backward compatible and requires no migration (schema v15).

Schema migrations: a `schema_version` setting, currently 19; migrations run in the DO constructor via `blockConcurrencyWhile`.
Version 19 adds Dive-owned `dive_attempts(date,user_id,prompt_index,started_at,wrong_count,
last_guess_at,suggestion_canonical,suggestion_answer,suggestion_status,suggested_at)` with primary
key `(date,user_id,prompt_index)` and index `(user_id,date)`. Its self-contained guarded transaction
uses `CREATE TABLE/INDEX IF NOT EXISTS`; account export includes these private attempt rows and
account removal deletes them. Suggestion status is nullable until issued, then pending/rejected/accepted.
Version 17 adds game progress before version 18. Version 18 adds `users.evening_reminder`
(integer boolean, default 1), nullable `push_outbox.reminder_date`, and `reminder_sends(user_id,date)`
with a composite primary key for daily idempotency. The guarded migrations run in order,
including 17 then 18, on fresh databases and upgrades from 16.
Version 16 adds `game_results(game_id,date,user_id,score,payload_json,created_at,updated_at)`
with primary key `(game_id,date,user_id)` and indexes `(user_id,date)` and `(date,game_id)`;
and `dive_answers(date,user_id,prompt_index,answer,normalized,hidden_at,hidden_by,created_at)`
with primary key `(date,user_id,prompt_index)`, prompt index constrained to 0–6 (the route accepts
0–4 for today's five prompts; the wider check needs no migration), and index
`(date,prompt_index,normalized)`. Both tables and indexes use IF NOT EXISTS in one guarded
idempotent transaction advancing to 16. Exports include the owner's game results (decoded
payload) and Dive answer rows. Account removal deletes both and clears hidden_by references.
Version 10 adds idempotent erg test history, team challenges, and an entries(date) index.
Legacy best splits backfill one test per kind using the user's updated_at team-local date.
Version 13 adds `entry_idempotency` and its created-at index in a self-contained, idempotent transaction.
Mappings survive entry deletion and are opportunistically pruned after seven days when inserting a mapping.
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
Version 11 adds nullable comment `edited_at`, per-comment mention notification history (backfilled from current
mentions), and durable content reports with queue/target/parent indexes. This is one transactional, idempotent
`version < 11` migration. Reports survive content deletion without a cascade.
Version 12 adds `user_intro`, backfilling existing users as complete without skipping intro for new signups.
Version 14 adds web push: `push_subscriptions(endpoint PK, user_id, p256dh, auth, created_at, updated_at)` indexed by
`(user_id,updated_at)`, and `push_outbox(id INTEGER PK AUTOINCREMENT, notification_id, endpoint, attempts, next_at
epoch-ms)` indexed by `(next_at,id)`. Idempotent `CREATE TABLE IF NOT EXISTS`, guarded by `version < 14`.
Version 15 adds `passkeys` and `webauthn_challenges` with idempotent CREATE TABLE/INDEX IF NOT EXISTS in one
self-contained guarded block. Feature migrations run in ascending order 11–18, each advancing its own version.

## 6. API (JSON, same origin, under `/api`). Errors: `{ error: { code, message } }` with proper HTTP status.

### Daily Games

Connections and Perception also use schema v17 `game_progress`. Generic
`POST /api/games/:game/results` submissions for both return 405 after access checks.
Results are written by the Worker transaction that finishes the game.

- Connections `GET /api/games/connections/today` returns `ConnectionsDay`:
  `{date,access,words,guesses,outcomes,outcome,mistakes,solved,finished,won,groups}`.
  Words are empty while locked; only solved groups are revealed before completion;
  `groups` is null until finished. `POST /api/games/connections/guess` takes
  `{guess:string[4]}` and returns the same shape. It atomically appends one guess,
  validates against the board and previous guesses (400, not counted), requires
  access (403), and rejects completion replay (409). Completion uses existing scoring.
  The old whole-log `POST /api/games/connections/check` contract remains solely
  as an explicit 405 retirement response, never a stateless replay oracle.
  Shuffle changes presentation only; localStorage never owns progress.
- Perception `GET /api/games/perception/today` returns `PerceptionDay`:
  `{date,access,round,rounds,scores,done}`. `rounds` is today's five stable string ids in play order.
  Round is the next zero-based index (0..4, 5 done);
  score keys are only completed rounds. **A resume read consumes any started,
  unanswered round as zero**, advances to the next, and finalizes if it was round 5.
  Repeated reads do not skip unstarted rounds. The client reads on mount, not background
  focus/reconnect, and resumes after uncertain network errors.
- `POST /api/games/perception/start` takes `{round}` and returns
  `PerceptionStart = PerceptionDay & {stimulus}`. Only the current round's stimulus is
  returned: `{clockMs}`, `{hue}`, `{dot}`, `{cells}`, `{reactionDelayMs}`, `{angle,rotation}`,
  `{length}`, `{countDots}`, `{digits}`, `{shade,shadeBackgrounds}`, `{endpoints}`, or `{contact}`.
  Coordinates and lengths are thousandths of the board. `countDots` is an array of dot centres;
  `endpoints` contains two points. `contact` contains `{visibleMs,hiddenMs,from,occlusion,finish}`;
  motion from `from` to `occlusion` is visible, then continues at the same speed behind an occluder to `finish`.
  The start timestamp is committed before responding; only then does the client show it.
  Repeated starts, out-of-order rounds, answers without a start and replay return 409.
- `POST /api/games/perception/answer` takes `{round,answer}`, with only that round's
  field (`clockMs/hue/dot/cells/reactionMs/angle/length/count/digits/shade/bisect/contactMs`), and returns PerceptionDay. Invalid or extra fields
  return 400 without changing progress. Both writes require access (403). Scores are
  server-computed. Round 5 atomically writes one result. Existing completed results cannot
  be replayed. Leaving before a round starts has no penalty.
- Perception generation is Worker-only. The web receives
  no future targets. A build guard excludes its private generator marker and checks web
  import boundaries. Current-round stimuli remain inspectable while shown, as in any
  browser memory game; this is not tamper-proof proctoring.
- Timing uses client measurements bounded by server elapsed time since start. Clock
  hold cannot exceed elapsed +1000ms. A non-false-start reaction cannot arrive before
  its signal delay, nor claim more than elapsed minus delay +1000ms. A false start (-1)
  scores zero. The upper slack tolerates scheduling and precision; network latency
  expands the server window rather than penalizing honest play. These are plausibility
  checks, not proof of honest timing. Mock mode uses artificial, non-production targets.
  V2 also rejects answers before the entire memory exposure finishes (span: digits × 450ms),
  and contact answers before `visibleMs` or claiming `contactMs > elapsed - visibleMs + 1000`.
  All timing rejections are 400, `Timing is not plausible for this round.` No progress is consumed.

#### Enabled games for launch

`DIVE_ENABLED = false` in `worker/src/games/features.ts` is the single production
switch for Dive. Launch includes Word Guess, Connections and Perception only.
Set it to `true` and rebuild to restore Dive; no data migration or browser flag is needed.
`GET /api/games` returns only enabled games, results and enabled-game streaks.
Clients use this list for the hub, game navigation and day boards; disabled game
routes (including `/games/dive/*`) redirect to `/games`. Dive API paths return 404
for everyone, including admins. Existing Dive answers and results remain untouched,
including in account exports; they do not contribute to weekly boards, played counts
or recap highlights while disabled. A game streak requires playing any enabled game
on consecutive team dates, not all games. Recap `best_dive` remains nullable and is
null while Dive is disabled. Generic unlock/reminder copy refers to the enabled games.

#### Perception rotation and scoring

`PERCEPTION_V2_FROM = '2026-11-10'` uses the America/Los_Angeles team date, not UTC.
Before cutover, generation and scoring remain exactly the original clock/color/dot/pattern/reaction
sequence (7 pattern cells; exposure 1500/900/1600ms; typical misses 600ms/25°/8%/2 cells;
reaction `closeness(max(0,ms−150),200)`). Captured puzzle/score fixtures pin three legacy dates.
From cutover, five distinct types are selected deterministically from the twelve below and their
play order is date-seeded. Consecutive days share at most two types (so never the same set),
including the last legacy day and cutover day; the scaffold starts after the five legacy types.
Every type appears in every five-day v2 window. Two-year tests also reject periods 1–29, including
set-only periods. Generation uses independent 60-day epochs, a valid 12-type cyclic scaffold,
and exactly 320 seeded candidate slot swaps, rejecting any swap violating distinctness, overlap
or coverage. Four boundary days at each end stay fixed so cross-epoch windows remain valid.
This is bounded work even far after cutover, with a two-epoch cache; no replay from launch date.
Round order is independently shuffled per date, including the boundary days.

Each score is `round(100 × exp(−0.494 × (miss / typical)²))`, clamped by the objective
metric to 0–100: 100 perfect, **61 at the typical miss**. Five rounds total at most 500.
Exposure constants are public; seeded targets and lineup generation remain Worker-only.

| Type / answer field   | Exposure / final parameters                                                                                 | Miss metric                                | Typical miss        | Score at typical |
| --------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------- | ---------------- |
| clock / clockMs       | Hold 3.0–8.0s, no visual; answer 0–30000ms                                                                  | Absolute timing error                      | 250ms               | 61               |
| color / hue           | 700ms; hue 0–359°, recall dial                                                                              | Circular hue distance                      | 12°                 | 61               |
| dot / dot             | 400ms; centre 100–900 per axis; answer 0–1000                                                               | Euclidean board distance                   | 40 thousandths (4%) | 61               |
| pattern / cells       | 1000ms; 5×5, exactly 9 distinct cells                                                                       | 9 minus correct cells                      | 2 cells             | 61               |
| reaction / reactionMs | Signal after 1.5–5.0s; −1 false start; 0–3000ms                                                             | max(0, ms−160); under 100ms scores 0       | 110ms               | 61               |
| angle / angle         | 800ms; 15–165° with rotation 0–359°; integer answer 0–180°                                                  | Absolute angle error                       | 5°                  | 61               |
| length / length       | 800ms; horizontal reference 250–800; reproduce vertically, integer 1–1000                                   | Absolute error / reference × 100           | 5%                  | 61               |
| count / count         | 600ms; 30–80 irregular dots, ≥70 thousandths apart (bounded rejection sampling); integer answer 1–200       | abs(log2(answer / count)) × 100            | 18                  | 61               |
| span / digits         | 8–9 digits × 450ms, leading zeroes retained; answer 1–12 digits                                             | Levenshtein distance                       | 2 edits             | 61               |
| shade / shade         | 800ms; gray 20–80%; backgrounds 10%/90% reversed for recall; integer answer 0–100                           | Absolute lightness error                   | 4 points            | 61               |
| bisect / bisect       | Line stays visible; 50–90% board length, random angle; midpoint answer per axis 0–1000                      | Distance from midpoint / line length × 100 | 2%                  | 61               |
| contact / contactMs   | Visible 1000–1800ms; hidden 700–1800ms; constant-speed geometry fits board; answer 0–6000ms after occlusion | Absolute hidden-time error                 | 110ms               | 61               |

Result payload is `{answer,scores,rounds}`; scores are partial and keyed by the stable type id,
not the round index. Readers of legacy payloads without `rounds` default to the original five ids.
Difficulty regression uses a fixed-seed 3000-day good-player simulation: normal errors with
standard deviation equal to typical miss (independent axes for spatial types), rounded discrete
answers; reaction N(260,40)ms. It requires median 250–350/500, fewer than 3% at 450+,
and separately proves perfect answers score 500. This is calibration, not an observed player study.

Schema v17 adds generic `game_progress(user_id,game,date,state_json,updated_at)` with
primary key `(user_id,game,date)` for server-owned in-progress games. Account removal
deletes the user's progress. Word Guess stores its ordered guesses here, never in a
client-authoritative draft. The Worker-only answer list and seeded daily selection
are unchanged; neither is imported by the web app (including mock mode).

- `GET /api/games/wordguess/today` returns `WordGuessDay`:
  `{date,access,guesses:[{word,marks}],done,won,answer:string|null}`. Date is team-local
  server today. The caller's marks resume on reload; the answer stays null until done.
  Locked callers can read their own state but cannot submit guesses.
- `POST /api/games/wordguess/guess` takes `{guess}` (lowercase five-letter dictionary
  word) and returns the same shape. The transaction rechecks access (403), rejects
  invalid guesses with 400 without counting them, and rejects completed games or an
  existing result with 409 `ALREADY_PLAYED`. It appends one server guess, computes marks,
  and, on a win or sixth guess, inserts the sole `game_results` row atomically using
  existing scoring (6..1 for a win, zero for a loss). Completed result payloads include
  guesses, solved, tries, answer and marks; legacy completed results are enriched on read.
  Generic `POST /api/games/wordguess/results` is disabled (405), even with a forged
  payload; use the guess endpoint. DailyGameFrame's server-complete mode fetches that
  existing result after the tile reveal instead of submitting client scores.
  Mock mode uses a fixed artificial word, not the production answer bank.
  The build runs Word Guess's web-bundle answer-bank exclusion guard alongside Dive's.

`GET /api/games` includes `streak: GamesStreak` (`current`, `best`). A played date
has at least one result for a registered game, counted once in the team timezone
using shared `today()`. Current is the consecutive run ending today, or yesterday
if not played today, otherwise zero. Best is the longest run across all played dates.
The server folds one ordered distinct-date query; no new stored state is needed.
Streaks and weekly recap highlights read the same server-written `game_results` rows.
Share summaries use completed server result payloads, not local drafts or future targets.
Workout mutations invalidate the games query root, including cached Word Guess and
Connections day queries. Perception resumes on mount after access unlocks, never from
background invalidation that would abandon an active round.

Dive adds seven dedicated endpoints without changing the generic hub contract:

- `GET /api/games/dive/today` returns `DiveDay`: team-local date, access, prompts
  (text only, empty when locked), ordered caller answers with their own prompt reveals,
  completion, immutable running score, verdict, caller's generic result and nullable team reveal.
  Only admins may see team groups before completing all five prompts;
  coxswains/coaches retain the same spoiler gate as rowers.
- `POST /api/games/dive/start` takes `{prompt_index}` and returns `DiveStart`
  `{prompt_index,deadline_ms_remaining}` (200). Only the next unanswered prompt can start;
  retries reuse its persisted start, never reset it. The nominal deadline is 25 seconds with
  2 seconds of server latency grace; remaining milliseconds exclude grace and clamp to zero.
- `POST /api/games/dive/guesses` takes `{prompt_index,answer}` and requires start (409 `NOT_STARTED`).
  `DiveGuessResponse` is `{outcome:'scored',answer:DiveAnswerResult}`, or
  `{outcome:'suggestion',suggestion:string,prompt_index,deadline_ms_remaining,attempts_left}`, or
  `{outcome:'not_an_answer',attempts_left}` (all 200). Exact/alias/auto-typo hits score;
  ordinary misses keep the prompt open and increment its wrong count. Only after a miss,
  and only before any suggestion was issued for this prompt, does the Worker run the local
  near-miss matcher. It reveals only the single suggested canonical, never a set or another prompt.
  Suggestions are persisted pending; a subsequent guess implicitly rejects one and charges
  that rejection as a wrong attempt before evaluating the new guess. Every wrong guess counts,
  including repeats. The 15th wrong locks in a miss. Nonempty guesses less than 400 ms apart
  return 429 `TOO_FAST` with `Retry-After: 1`, without changing state. Empty/whitespace input
  gives up immediately; a request after the grace deadline stores an empty-answer miss, even
  with a pending suggestion. Deadline/give-up handling precedes rate limiting.
- `POST /api/games/dive/suggestion` takes only `{prompt_index,accept:boolean}` and returns
  `DiveGuessResponse` (200). Accept re-resolves the stored pending canonical and scores its
  real tier/points, retaining the original typed guess as `answer`. Reject marks it rejected,
  charges one wrong attempt and returns `not_an_answer` (or scored miss at the limit).
  There is at most one suggestion per prompt ever. No pending suggestion returns 409
  `NO_SUGGESTION`; replay after scoring returns 409 `ALREADY_ANSWERED`. After the deadline,
  resolution stores a miss instead. Neither the body nor another user's/prompt's state can
  supply a canonical. All writes recheck access and sequence inside a synchronous transaction.
  All three write routes share the existing `OUT_OF_ORDER`/`ALREADY_ANSWERED` checks.
  `DiveDay.pending` resumes only the caller's active started prompt:
  `{prompt_index,deadline_ms_remaining,suggestion:string|null,attempts_left}` or null.
  It is null for completed, past or locked games; expired pending suggestions are not returned.
- `POST /api/games/dive/answers` takes `{prompt_index,answer}`, returns the final scored
  `DiveAnswerResult` (201). The server uses today, checks access inside the transaction,
  accepts only the next index (409 `OUT_OF_ORDER`) and forbids duplicates (409 `ALREADY_ANSWERED`).
  This compatibility endpoint still scores immediately without requiring start, but an existing
  expired start forces an empty-answer miss. Empty answers represent timeouts. Trimmed answers are at most 60 characters; control characters
  are rejected. Canonical match (nullable), tier and points are stored at submit time in
  v16's Dive-owned `dive_answers` columns `canonical TEXT`, `tier TEXT NOT NULL`,
  `points INTEGER NOT NULL`. The first answer creates a generic result; payload is
  `{answered:n}`. In the same transaction its score increments by those stored points.
  Neither other players nor moderation can change them. The response includes the current
  prompt's `gem` and at most five `notable` answers (three familiar Surface answers and two
  Deep Cuts), never a whole set or reveals for unanswered prompts.
- `GET /api/games/dive/days/:date` returns `DiveDay` with revealed prompt groups for past
  dates only if the caller finished that date’s Dive, unless admin (403 `PLAY_FIRST`).
  Future dates are invalid.
- `PATCH /api/games/dive/answers` requires staff plus completion of that date’s Dive
  and today’s Dive (admins bypass both completion checks), takes
  `{date,prompt_index,normalized,hidden:boolean}` and returns that prompt's `DiveReveal`.
  It hides/unhides a whole group, sets/clears `hidden_at` and `hidden_by`, and audits
  `dive.hide`/`dive.unhide`. Moderation is display-only: neither stored answer points/tiers
  nor `game_results` scores/timestamps change. Later matching submissions inherit hidden
  display state but still earn their curated points. Non-staff see no hidden groups except
  their own answer marked `hidden` (without other hidden members/names/counts). Staff can
  inspect all groups after completion; admins can inspect them at any time. Groups use normalized canonical keys for matches (aliases and fuzzy
  matches converge), normalized free text for misses, and include `canonical`, `teammates`
  (`user_id`, `name`), count and `only_you` (caller is in a group with no teammate).
  `count`, `total`, `mine` and group `points`/`tier` are retained for the existing client;
  counts are informational, never used to award points. No crowd-ranking CTE remains.

The general-knowledge bank includes 203 active complete constrained prompts, alongside the broad
curated bank. The catalog has 522 active and 82 inactive/loadable prompts, each
with a theme and optional cluster; related Japanese content shares `japan`. Constrained sets
have ≥8 canonical answers and no size cap; broad active sets retain ≥200 and their bundle cap.
There are no rowing/team prompts. **Before the cutover, selection uses the frozen 330-prompt legacy
permutation**, not the prospective active catalog. `scripts/dive/legacy.json` preserves the
original order; the same seeded permutation takes five consecutive entries/day
(`DIVE_PROMPTS_PER_DAY`), measured from 2026-01-01 with positive modulo. Any 66 consecutive
days contain no repeated prompt, including wraparound and dates before the epoch.

`dive_answers` persists date/user/prompt index, not prompt IDs. Routes and reveal reads
resolve IDs/text through `diveSelectionFor(date)`/`divePromptsFor(date)` at read/submit time.
Therefore retired legacy prompts remain loadable and all pre-cutover dates must keep this
selector forever. A generated explicit cyclic schedule replaces it from team-local
**2026-11-10** (`DIVE_SCHEDULE_CUTOVER`). The reviewed bank has 253 constrained prompts;
the 64-day cycle uses all 203 active sets plus 117 broad fillers, without repeats. Fifty
constrained sets are inactive but remain loadable: low-depth sets, award-era splits,
NASA selection classes, arbitrary cocktail categories and near-duplicate chemical/vitamin
subsets. Each award has one all-years prompt; the IBA cocktail categories share one complete
prompt. Generation
fails rather than enabling an insufficient or unbalanced bank. The schedule builder
uses all constrained prompts plus preferred broad fillers; each five-prompt day has unique
themes/clusters and a size mix (not all ≤24 or all >120 answers). Python/Worker validators
and the real cycle plus a 64-day fixture cover determinism, loadability, day rules, wraparound and historical
IDs. Do not enable/backdate cutover or edit a live cycle to reinterpret an already-started day.
`shared/games/dive.ts` owns normalization (NFKD, diacritics, lowercase, ampersand expansion,
punctuation removal, hyphen/underscore/slash separation, whitespace, leading article removal,
last-word-only simple plurals), tier constants, emoji and 0–500 verdict bands. Tiers are
`surface` Surface 10 🫧, `tooclever` Too Clever 15 🤡, `school` Midwater 30 🐟,
`rare` Rare 60 🦑, `deep` Deep Cut 85 🐙, `gem` Pearl 100 🦪, `miss` 0 ⬛.
Verdicts: 0 High And Dry; 1–99 Toe Dipper; 100–199 Getting Wet; 200–299 Open Water;
300–399 Deep Diver; 400–499 Abyss Explorer; 500 Pearl Collector. Scores are immediately
real even for the first player. The generic board remains higher-is-better; `final` becomes
true after team midnight (board participation can grow, individual scores never recompute).

`scripts/dive/` is a reproducible Python pipeline with pinned real list sources, ignored raw
fetch caches, contextual English Wikipedia human pageviews (2025 monthly totals), a
Wikidata sitelink breadth, a `wordfreq.zipf_frequency(name,'en')` fallback/tiebreak, and
committed hand overrides. When both entity signals exist, familiarity combines
`0.6*log1p(annual_views/5000) + 0.4*log1p(sitelinks)`; either signal works alone when the
other is missing. QIDs resolve in article batches; sitelinks query in <=300-QID SPARQL
VALUES batches. Disambiguation items and wrong-country city matches are rejected. Within
each prompt, familiarity rank percentiles are Surface <20%, Midwater <55%, Rare <80%,
Deep Cut otherwise for broad sets. Constrained sets reuse same-theme entity signals when
available; explicit Surface anchors leave remaining ranked answers in Midwater/Rare/Deep Cut
(45%/30%/25%) to preserve tier diversity in small sets. Surface anchors, optional Too Clever picks and exactly one fun Pearl
override those ranks. See its README/report for provenance, exclusions and regeneration.
`constrained.json` commits reviewed complete canonical/alias snapshots, exact expected
counts, pinned Wikipedia revisions/extraction recipes and dataset commit/checksums.
`sources.py` verifies MediaWiki oldid/title and dataset SHA-256, with raw responses ignored
under `.cache/`; `generate.py --verify-sources --check` re-extracts and rejects count or
membership drift. Derived country/state predicates apply to canonicals or common English
names in complete reviewed bases. No constrained membership is inferred from word frequency
or silently trimmed. People surnames must be unique within a set; teams accept nicknames;
common short film titles and existing article/typo normalization are preserved.
The pageview candidate pool covers twice the prospective Surface population (at least
100 names), plus all anchors/picks. Unresolved/unqueried names use the conservative
secondary signal below resolved entities. Homographs use explicit contextual article
titles and multiword corrections. ISO 639-1 languages replace the noisy ISO 639-3 tail;
cities are capped at the 500 largest per country, movies at 1,000 per genre by source votes,
plus reviewed additions. See the committed full-prompt review and familiarity snapshot.
Generated Worker-only per-prompt modules contain sorted normalized-key length-bucket
strings, a shared canonical table referenced by base-36 UTF-16
offsets, and constant Pearl/notable metadata. `sets.ts` returns
lazy module data directly: no request parses a set, builds key maps, or incurs parsed-LRU
eviction. Exact canonical/alias lookup searches the key's length bucket for a
newline/key/tab delimiter (no duplicate global index); fuzzy
matching scans only eligible bucket strings, decoding only accepted candidate rows.
The browser imports tier helpers/types only, never answer data.

The pure Worker matcher first checks normalized canonical/alias keys. Otherwise banded,
early-exit Levenshtein uses no fuzzy matching below length 4, distance ≤1 for length 4–7,
distance ≤2 for length ≥8; length-difference prefiltering is mandatory. Only a unique best
canonical wins (aliases of the same canonical do not count as ties); ambiguous, empty,
unknown, timeout and non-answer stopword inputs miss for zero. No external request or
frequency lookup happens at submit time. Data integrity/matcher/selection tests cover all
sets; `scripts/dive/check-web.mjs` checks built web assets for Pearl-string leaks.

The advisory near-miss matcher is separate from scoring: length/letter-bag prefilters feed
banded adjacent-transposition distance, token coverage and a lightweight phonetic key.
Inputs below four normalized characters and non-answer stopwords never suggest; short lone
tokens cannot suggest multiword canonicals. Canonical-level near ties return no suggestion.
DP rows and letter-count buffers are reused within the submit; nothing leaves the Worker.

The Dive client persists each 25-second deadline under a user/date/prompt localStorage key;
reload/visibility changes use the original wall-clock deadline, expiry submits an empty answer,
and rejected/network writes offer Retry. This is a client timer, not an anti-cheat deadline.
An original SVG water column shows the rowing shell, depth ticks and sinking marker; reduced
motion disables sinking. Completed play reveals the log, grouped answers, Copy Result
(`Dive YYYY-MM-DD · N m`, no spoilers) and generic live day board. Staff moderation uses
the shared confirmation sheet. Scores/boards refresh while visible every 30 seconds.
Team Answers with no groups shows its heading and one muted “No teammates have played yet.”
line, without rows. In a mixed reveal, prompts with no groups are plain non-expandable rows
with right-aligned “No teammates yet”; populated groups retain their disclosures/dividers.

Games are separate from training statistics, with no bottom tab. Dates use team-local
America/Los_Angeles `today(ctx.now)` and weeks run Monday–Sunday via `weekStart`.
`oyoGameAccess(storage,user,date)` is THE gate: coxswain/coach/admin always unlock;
rowers unlock with any existing own entry dated today (entries are hard-deleted), or
a rest day in the latest My Fortnight plan starting between today−13 and today.
Rest-day offsets are `(week−1)*7+day`. Otherwise access is locked. Every game write
refreshes the user and requires this rule server-side (403 `GAME_LOCKED`,
"Log a workout today to play."). Deleting a workout can lock future writes again.

- `GET /api/games` returns `GamesToday`: date, access, registered game info (id,
  direction), and the caller's results today; `GET /api/games/access` returns `GameAccess`.
- `POST /api/games/:game/results` takes `{payload: unknown}`. Server registry `score`
  validates and computes a safe integer score and JSON payload; returns `GameResult`
  (201). Date is always server today. Atomic one-result-per-game/day/user gives 409
  `ALREADY_PLAYED` on repeats. Unknown games return 404; no generic scorer returns 405.
- `GET /api/games/:game/results/me?date=` returns own `GameResult | null`.
- `GET /api/games/:game/leaderboard?date=` defaults to today and rejects future dates.
  Every date's board requires completion of that date's game, unless admin (403 `PLAY_FIRST`).
  A partial Dive result does not count: all prompts must be answered. `final` is date < today;
  active players only, competition `RANK()` by the registry's higher/lower direction,
  ties share rank, ordered by rank then name. Results may remain live until day end.
- `GET /api/games/leaderboard?week=` returns `GamesWeekLeaderboard`; a date selects
  its Monday (default current week; future weeks rejected). For each registered game/day
  with N active players, points = N−competition rank+1. Sum across the week; `days`
  counts distinct played dates. Competition rank is by total points descending; ties
  show more days first then name but share rank. A single window-function SQL query
  calculates placements and totals; registered/lower-direction id lists use `json_each(?)`,
  never an expanding bound-parameter list. Weekly standings are independent of PLAY_FIRST.

Coxswains and coaches bypass only the OYO unlock gate (`reason: staff`).
They play without early spoilers, like rowers: no other players' Dive answers or daily
boards until finishing the requested day's game, including past-day views.
Only `role: admin` (including Joshua Koo, joskoo@stanford.edu) bypasses that completion
rule. The Dive UI uses the early review endpoint and moderation before play only for
admins. Coxswains/coaches may moderate from a completed day's reveal, only after
finishing today's Dive too; the Worker enforces this on PATCH. Locked-in per-prompt feedback remains available to
every player. Word Guess answers/Connections groups stay hidden until completion,
and Perception serves only each started round's stimulus; staff status adds no shortcuts.
Weekly aggregate standings remain independent of daily spoiler gating.

All handlers refresh the authenticated user and validate game ids against the registry.
Extension contract: add a `ServerGame` in `worker/src/games/registry.ts` (id matching
`/^[a-z][a-z0-9-]{1,31}$/`, direction, optional synchronous score callback), optional
dedicated routes, and a typed lazy `GameDefinition` in `web/src/games/registry.ts`.
No migration is needed. Routes, hub and generic boards pick up client entries; weekly
aggregation picks up server entries. Use `useGameAccess`, `GameLocked`, and
`GameDayBoard`; invalidate games queries after writes. Dive is registered as higher
with no generic scorer; dedicated Dive routes handle sequential answers and immutable scoring.

Registered daily games (all `higher`, scoring in `worker/src/games/more.ts`, public rules in
`shared/games/` and private answer banks in `worker/src/games/`). Daily puzzles derive from the team date via a seeded
`mulberry32(fnv1a(id:date))` or a day-number answer index, so every teammate gets the same
puzzle. The server recomputes every score from raw input; client scores are ignored, and
malformed or implausible payloads return 400.

- `wordguess` accepts one `{guess}` at a time via its dedicated endpoint above, never a
  client-supplied board. The server validates against the answer and accepted-guess lists,
  persists each guess, and finishes on today's answer or six misses. Score is `7 − tries`
  when solved, else 0. Stored result payload `{guesses,solved,tries,answer,marks}`.
- `perception` takes each round's answer through the dedicated endpoints above (hold 0–30000 ms, hue
  0–359, dot 0–1000 per axis, seven legacy or nine v2 distinct cells of a 5×5 grid, reaction 0–3000 ms or −1
  for early). Five rounds score 0–100 each against the daily puzzle; reactions under
  100 ms score 0. V2 adds seven types as detailed above. Score 0–500; stored `{answer,scores,rounds}`.
- `connections` takes one `{guess}` at a time; the Worker owns the ordered log of up to eight four-word guesses. Puzzles
  (≥90 original, hard-day difficulty: four groups of four, easiest to hardest, the hardest
  group always wordplay, at least three red herrings each across two or more groups, unique
  category names, and exactly one valid partition even with every herring allowed in its
  decoy group) live only in
  `worker/src/games/connectionsPuzzles.ts`; a fixed shuffle is cycled by day number, so a
  puzzle returns only after every other one (no repeat within 60 days). The client gets
  words from `GET /api/games/connections/today` (`ConnectionsDay`, empty while locked) and
  appends each guess with `POST /api/games/connections/guess` `{guess}` (gated,
  persisted server-side), which returns `ConnectionsDay`: last outcome
  (`correct`/`one_away`/`wrong`), mistakes, solved groups only, and all groups once finished.
  Logs with unknown, repeated or solved words, repeated guesses, or guesses after the board
  ended return 400 (finished boards reject further guesses with 409). The finishing guess
  writes the result server-side (four solves or four mistakes).
  Score: solved boards `8 − mistakes` (8–5), unsolved boards the solved group
  count (0–3), so every win outranks every loss. Stored `{guesses,solved,mistakes,won,grid,groups}`.

### Tests, recaps, and challenges

- GET /api/users/:id/tests: authenticated team-visible history, newest date/created_at first.
  PR means strictly faster than all earlier tests of that kind; first is a PR.
- POST /api/me/tests, PATCH /api/me/tests/:id, DELETE /api/me/tests/:id:
  owner-only (404 otherwise), at most 200 tests. Input kind 2k/6k, date (2000-01-01
  through team-local today), exactly one time_s/split_s on create or pace edits.
  Times and splits round to tenths, split bounds 60–300. A kind-only edit preserves time.
  Best splits are transactionally derived MIN(split_s), NULL when none remain.
  PATCH /api/me non-null best split records a new test today; null is an accepted no-op.
- GET /api/stats/recap?week=YYYY-MM-DD: own completed-week recap; defaults to last week.
  Any date selects its Monday; current/future weeks return 400. Includes own totals,
  target, percent, hit_target, modalities, entry_count, consecutive hit weeks ending
  at that week, highest-equivalent entry (earliest creation breaks ties), and cached
  leaderboard team totals/counts and percent rank (null off leaderboard).
  Also `race`: that week's final `RaceWeek` (same rules as /api/stats/race; null with zero rowers);
  `plan` (`RecapPlanWeek`): the recap week inside the owner's My Fortnight plan covering its Monday,
  with week 1|2, planned/logged E-meters and complete (`logged_m >= planned_m`), null without a plan
  or with no planned meters; `games` (`RecapGames`): own `game_results` rows that week (`played`,
  distinct `days`, `best_dive` score or null, `word_guess_solves` where payload `solved` is true) and
  `streak`, consecutive days with any result ending on that Sunday (0 when Sunday has none). The
  games week is one indexed read; the streak read runs only when Sunday was played. No schema change.
  The client shows it on Home Monday–Wednesday of the next team-local week until dismissed
  (per user and week in localStorage) for users who joined before that week ended, always at
  `/recap` (linked from Me, with earlier weeks), and shares it as a 1080×1920 PNG rendered on a
  canvas (`navigator.share` with files, download otherwise).
- GET /api/stats/race?week=YYYY-MM-DD: authenticated `TeamRace` (Stanford vs Berkeley) for the selected
  week (default this week; same week-date bounds as stats) and the week before. Population = active users with
  role `rower` (same as compliance; staff never count). `stanford_m` = their summed stored `equiv_m` for the week;
  `target_m` = their summed effective weekly targets; `berkeley_total_m` = round(target_m × ratio), ratio =
  `berkeley_pace_percent` / 100 (`BERKELEY_PACE_RATIO` 0.9 by default, shared/race.ts). Berkeley advances linearly
  from Monday 00:00 to the next Monday 00:00 America/Los_Angeles (`starts_at`/`ends_at`; 167/169 h on DST weeks):
  `berkeley_m` = round(berkeley_total_m × elapsed fraction) at `as_of`, 0 before the week and the full total after.
  `status` is upcoming/live/final from those instants. Zero rowers → all zeros. Five SQL reads, no N+1.
- GET /api/challenges: authenticated active/upcoming challenges ordered by end_date.
- GET /api/admin/challenges: staff all challenges newest first.
- POST /api/admin/challenges, PATCH /api/admin/challenges/:id,
  POST /api/admin/challenges/:id/end, DELETE /api/admin/challenges/:id: staff only,
  audited challenge.create/update/end/delete. End is idempotent; editing ended challenges
  returns 409. Title trims to 1–60 chars, goal_m integer 1–1,000,000,000 meters,
  nullable modality, ordered valid dates spanning at most 366 days.
  emeters sums equiv_m; km sums raw distance_m; inclusive entry dates, all users.
  Status ended on ended_at or past end_date, upcoming before start_date, active otherwise.
  Percent rounds to 0.1 without capping; no points. DO progress memo keys include
  challenge data/updated_at, stats_counters.any_version and team-local today; hits scan no entries.

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
`MyPlan` adds `updated_at`, per-week `planned_m: [number, number]` and
`logged_m: [number, number]`, and per-session `equiv_m` (null for unknown distance).
Planned equivalents are computed on read with current settings factors, never snapshotted;
unknown distances contribute zero. Logged totals sum stored `equiv_m` from all the owner's
non-deleted workouts, regardless of modality, zone or visibility, by workout `date`:
week 1 is start_date through +6 days, week 2 is +7 through +13, inclusive.
A week is complete when `planned_m[w] > 0` and `logged_m[w] >= planned_m[w]`.
There is no per-session completion or entry matching. GET keeps a constant SQL query count,
computing logged totals from its existing entry query. Account export uses one range query
for entries and buckets them per plan. Workout creation, editing and deletion invalidate plan
queries. Unsaved edits retain logged totals only for an unchanged start date; a changed start
waits for the saved response before showing logged totals.

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
Passkeys (§4): public `POST /api/auth/passkey/options` (bodyless; → `PasskeyLoginOptions`
`{ challenge, rp_id, timeout_ms, expires_at }`, discoverable credentials, empty allow list) and
`POST /api/auth/passkey/login` (`PasskeyAssertion` → `User`, sets the session cookie; 401 PASSKEY_UNKNOWN,
PASSKEY_CLONED, 400 PASSKEY_INVALID, PASSKEY_CHALLENGE_EXPIRED, 403 ACCOUNT_INACTIVE, 429). Authenticated
`GET /api/me/passkeys` → `Passkey[]` (`id, name, created_at, last_used_at, backed_up`; never key material),
`POST /api/me/passkeys/options` (`{ reauth_token? }` → `PasskeyRegistrationOptions`, adding `rp_name`,
`user {id,name,display_name}` and `exclude_credentials`), `POST /api/me/passkeys` (`PasskeyAttestation` →
201 `Passkey`, name inferred from the AAGUID or User-Agent; 409 PASSKEY_EXISTS / PASSKEY_LIMIT) and
`DELETE /api/me/passkeys/:id` (204; another user's or unknown id = 404). All values are base64url without padding.
Config: `GET /api/config` (factors, group targets, season start, presets, zones list, server-computed
`today` and `current_week_start` as YYYY-MM-DD in America/Los_Angeles) — public to logged-in users.
`GET /api/me/target` returns the effective current-week target:
`{ week_start, target_m, source: 'personal' | 'group' }`.
Entries: `GET /api/entries?scope=feed|mine|user:<id>&cursor=` (feed = team-visible, newest first, paginated 20),
`POST /api/entries`, `GET/PATCH/DELETE /api/entries/:id` (owner or staff), `POST/DELETE /api/entries/:id/kudos`,
`GET/POST /api/entries/:id/comments` (both return comments with `author: PublicUser`),
`DELETE /api/comments/:id` (author or staff).
`PATCH /api/comments/:id` is author-only (including staff); details are above.
`POST /api/entries` accepts optional `Idempotency-Key`: 8–128 characters from `[A-Za-z0-9_-]`;
invalid keys return 400 `VALIDATION_ERROR`. Without it, every request creates an entry as before.
After body validation, a key identifies the workout per authenticated user: first create returns 201,
replays return the original entry's current `EntryDetail` with 200, ignoring body differences and
without creating entries, notifications or audit records. A deleted original returns 404 `NOT_FOUND`.
Entry creation and key insertion are atomic, including concurrent requests. The same key is independent
across users. Mappings older than seven days may be removed on insert, after which keys can be reused.
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
`GET /api/announcements/:id` returns that announcement to any signed-in user, or 404 if removed.
Notification responses include optional `announcement_id`; opening an identified announcement fetches it
by id even when the announcements list is stale. Announcement push URLs are
`/announcements?announcement=<id>` and open that item; legacy notifications without an id keep the fallback.
Opening an identified announcement always revalidates, showing cached content while fetching. On 404,
cached content is evicted from the by-id and list queries and identified notification caches; links show
“Announcement removed” instead of an unrelated announcement. Other failures retain the generic error state.
Deleting an announcement deletes its identified notifications and queued pushes transactionally; legacy
notifications with no reference are unaffected. Delivery drops unresolved announcement targets (including
legacy rows whose author/time match no longer exists). Notification refetches update unread counts and badges.
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
Web push (per device, opt-in): `GET /api/me/push` → `PushConfig { public_key: string | null }` (null = push not
configured; UI hides the toggle), `PUT /api/me/push` with `PushSubscriptionInput { endpoint, keys: { p256dh, auth } }`
→ 204 (upsert by endpoint, reassigned to the current user; at most 10 devices per user, oldest evicted; endpoint must
be https on FCM, Mozilla, Apple or WNS push hosts; p256dh 65-byte uncompressed P-256, auth 16 bytes; 503
`PUSH_UNAVAILABLE` when unconfigured), `DELETE /api/me/push` with `{ endpoint }` → 204 (own devices only).
Every kudos, comment, tag, mention and announcement notification inserts one `push_outbox` row per recipient device
inside the same transaction; the request only schedules the Durable Object alarm and never waits on push. `alarm()`
sends at most 10 pushes per invocation (RFC 8291 aes128gcm encryption + RFC 8292 VAPID ES256 JWT via WebCrypto,
TTL 1 day), then reschedules for the remainder. Payload `{ title: actor name, body, url (same-origin deep link), tag,
badge (unread count, max 99) }`; kudos on one entry share a tag. Already-read notifications are skipped. 404/410
deletes the subscription; 429/5xx/network errors retry with 30 s × 2ⁿ backoff (or Retry-After, max 1 h) up to 5
attempts; other errors drop the row. Without VAPID config the outbox is discarded.
Evening reminders: `User.evening_reminder: boolean`, writable via `ProfilePatch` on `PATCH /api/me`,
defaults ON because delivery already requires explicit per-device push permission in Settings.
It is omitted from PublicUser. Rowers with push enabled see an independent Evening Reminder toggle;
staff never receive reminders. Cron triggers at 02:30 and 03:30 UTC dispatch only during the 19:00
America/Los_Angeles hour, covering 7:30 pm in both daylight and standard time. Active opted-in rowers
with a subscription are selected; the canonical `oyoGameAccess` excludes today's logs and My Fortnight
rest days. A transactional daily claim prevents duplicate enqueueing. Reminders are not inbox items:
outbox rows use a reserved `reminder:<user_id>` notification id and `reminder_date`, with payload title `OYO`, body
`Log today's OYO to unlock the Daily Games.`, url `/log`, tag `oyo-reminder`. The existing alarm sends
at most 10 pushes per invocation; it rechecks eligibility and date before sending and discards stale
reminders. Normal push retries apply. Free plan limits are 10 ms CPU per Worker request/Cron and
5 Cron triggers per account (Cloudflare Workers platform limits); Cron makes one DO call and performs
no cryptography. Sixty users are selected cheaply in the DO and device delivery is batched, not one
60-user network/crypto request. Production CPU and real-device push require operational verification.
Locked Home Daily Games and Games hub states say `Log today's OYO to unlock` with a primary
`Log Workout` link to `/log`. Entry writes invalidate game queries immediately. Returning to the Home
card after unlocking gives a brief scale/fade on its icon; reduced-motion users get an instant swap.
Secrets (never committed; generate with `npm run vapid:keys`): `VAPID_PUBLIC_KEY` (base64url uncompressed P-256
point), `VAPID_PRIVATE_KEY` (base64url 32-byte private scalar), `VAPID_SUBJECT` (`mailto:` or `https:` contact). Set
with `wrangler secret put <NAME>`; locally put them in `.dev.vars`. Rotating keys invalidates existing subscriptions;
clients resubscribe automatically when the server key differs.
Staff (`/api/admin/*`): users list/edit (role, group, on_leaderboard, active), reset password, roster CRUD + bulk import
(CSV paste: name,email,role,group,side,class_year), settings (team code, factors, group targets, season start,
Berkeley pace whole percent 50–150),
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

### Account data (export and removal)

`GET /api/me/export` (any signed-in user, own data only) returns `AccountDataExport` JSON with
`format_version: 1`, `exported_at`, `profile` (User), `roster` (own claimed RosterRow or null),
`weekly_targets`, `workouts` (own entries with `images` metadata, `tagged` `{id,name}`, `kudos_count`,
`comment_count`), `images` (metadata of every image the user owns: workout photos, avatar, unattached
uploads; bytes stay at `GET /api/images/:id`), `comments` (authored, with `mentions` `{id,name}`),
`erg_tests` (the owner's stored erg test history, without the derived `is_pr` flag),
`kudos_given`, `plans` (every My Fortnight window, computed like `GET /api/me/plan`), `tagged_in`
(`{entry_id, entry_owner_id, tagged_at}`) and `mentioned_in` (`{comment_id, entry_id, author_id,
created_at}`, never the other person's comment body). `GET /api/me/export/workouts` returns the same
workouts as CSV (formula-guarded cells). Both responses are `Cache-Control: private, no-store`
attachments. Exports never contain credentials, sessions, re-auth grants, other users' emails,
private plans, comment text or notes. A constant number of SQL queries is used.

`POST /api/admin/users/:id/remove` ({ confirmation_email } → 204) is the staff account-removal
process. Policy: only an admin may remove; only `rower` accounts (active, inactive or unlinked) are
removable, never your own account or staff (demote first); `confirmation_email` must equal the
target's email (trimmed, case-insensitive), else 400 CONFIRMATION_MISMATCH. Order: 403 → 404 →
409 CONFLICT (self/staff) → 400. The body is parsed first, then the actor is reloaded and authorized
and everything is deleted in one transaction (a failure rolls all of it back). Removal is permanent:

- deletes the user row, sessions (signs them out), re-auth grants, the email's login rate-limit
  bucket, `user_intro`, weekly targets, personal plans and sessions, and every image they own;
- deletes their erg test history and team challenges they authored (including former staff
  who have been demoted to rower); the audit counts include these records;
- deletes their workouts with each workout's photos, tags, kudos, comments (including other
  people's comments on those workouts), mentions and notifications;
- deletes their comments and kudos on other workouts, tags and mentions of them on other people's
  content, and notifications they received or caused; other people's free text that typed their
  name (e.g. "@Name" in a comment body) is left unchanged;
- deletes the roster row they currently claim, so the removed name cannot be claimed by accident
  (staff may add it again), and clears `roster.added_by` references;
- leaderboards and stats drop them through the existing `stats_versions`/`stats_counters` triggers.
  Earlier audit rows whose target, actor or snapshot references the user id, claimed roster id,
  email or `"name"` keep action, actor, target and time but their `detail_json` becomes
  `{"before":null,"after":null,"redacted":"account_removed"}`. A new `user.remove` audit row stores
  only role, active flag and removed-row counts. Removal cannot reach copies outside the database:
  earlier admin CSV exports, the rower's own downloads, browser/PWA caches of images and pages, and
  Cloudflare backups/point-in-time recovery until they expire. Ask the rower to export first.

Validation: distance 1..200,000 m; date not more than 1 day in the future and not before 2020; zone in list; modality in list.
All entries are always team-visible. POST/PATCH accept the legacy `visibility` field but ignore it and store
`team`. Profiles, feed, week/season/year stats and leaderboard totals include every workout, for all team members.
Schema version 6 idempotently converts existing private entries to team visibility. Entry mutation remains owner/staff-only;
images retain their independent authenticated ownership/avatar/entry-reference authorization rules above.

## 7. Frontend

### First-run intro and privacy

Schema v12 adds `user_intro(user_id, completed_at)`. Existing accounts are backfilled as complete;
new accounts have no completion row. Authenticated `GET /api/me/intro` returns
`IntroStatus { completed_at: string | null }`. `POST /api/me/intro` (no body) marks the intro complete
or skipped, returning the same shape. Completion is idempotent and server-persisted across devices.
Until completion, the app opens `/intro` after signup/login; Settings can reopen it without resetting
completion. The three short steps cover E-meters, zones and the current weekly target, using live team
factors and targets. Skip and Back are available. API access is not gated on intro completion.
`/privacy` is public and linked from signup and Settings. It explains team-visible training and social
content, staff access, owner-only My Fortnight plans, authenticated photo storage, exports and removal.

- Vite + React 18 + TypeScript + Tailwind + React Router + TanStack Query, lucide-react icons. Built assets served by the
  Worker (Workers static assets, SPA fallback). PWA: manifest, icons (192/512/maskable/apple-touch), theme color,
  `apple-mobile-web-app-capable`, safe-area insets, a small service worker for app-shell caching (never cache /api).
  The service worker also shows push notifications, sets the app badge from the payload, focuses/navigates an open
  window on click (else opens one), and resubscribes on `pushsubscriptionchange`. While signed in the app refetches
  notifications every 60 s only while visible (paused when hidden, refetched on return) and mirrors the unread count
  to the Badging API (`setAppBadge`/`clearAppBadge`) where supported. Settings › Notifications has a per-device Push
  Notifications toggle (permission is requested only from that tap); on iPhone outside the Home Screen it is disabled
  with "Add OYO to your Home Screen first." and an Add to Home Screen row; denied/unsupported states are disabled
  with a one-line footer. Logging out removes this device's subscription and clears the badge. Install: Home shows a
  dismissible Install OYO card when `beforeinstallprompt` fired (Android/Chrome) or on iPhone/iPad Safari (opens a
  three-step Add to Home Screen sheet); never shown when running standalone; dismissal persists in localStorage;
  Settings › App › Install App remains when the prompt is available.
- Layout: mobile = bottom tab bar (Home, Feed, + Log (center, prominent), Leaderboard, Me); desktop ≥1024px = left
  sidebar with the same destinations + content column (max ~720px) and a right rail (week ring, announcements).
- Screens: Login/Signup, Home (week progress ring vs target, remaining meters, days left, quick-log presets, this week's
  sessions, pinned announcements, "suggested to hit target" using the distance menu, Stanford vs Berkeley race card
  with last week's result), Log (modality segmented control,
  zone picker, distance or preset, optional time/split/rate/HR, live E-meter preview, notes, photos),
  Feed (cards: avatar, name, time, title, stats, E-meters, photos carousel, kudos, comments), Entry detail,
  Leaderboard (This Week % / This Week Meters / Season; week switcher; Stanford vs Berkeley race card for the selected
  week, hidden on Season; podium for top 3; highlight me; ≥100% check),
  Me/Profile (season & year totals, weekly bar chart with target line, modality/zone breakdown, streak, best week, my
  entries, edit profile, set weekly target, splits), Rower profiles, Plan (sample fortnight for my group w/ zone colors,
  fortnight guidance table, Workout Menu, Pace & Distance Calculator), Notifications, Settings (theme, password, logout),
  Admin (roster, compliance, settings & factors, presets, plan editor, announcements, export, audit log).
- Visual (Strava-inspired system, Stanford identity): clean white surfaces, near-black text `#242428`, secondary text
  `#6D6D78`, page/grouped background `#F7F7FA`, dividers `#DFDFE8`. **Cardinal `#8C1515` is the single main accent**
  (pressed `#6F1010`; on dark use `#C0352B`): primary buttons, Log button, progress rings, active tab, links.
  **Strava orange `#FC5200` (pressed `#CC4200`) only for highlights: PRs, streaks, "target hit" celebrations, best week.**
  Podium-only medal tokens (`--medal-{gold,silver,bronze}-{ink,fill}`) tint rank badges, top borders, and subtle
  card fills. Shared ranks share a medal; the cardinal "You" selection stays distinct. These semantic medal
  colors do not replace cardinal controls or orange achievement highlights.
  Dark mode: background `#121214`, surface `#1C1C1F`, dividers `#2C2C31`, text `#F2F2F5`. Zone colors as in the sheet:
  E light green `#CFE6C4`, D green `#8DBE84`, C yellow `#FBE08F` (others interpolate) — used as small tags/chips only.
  Light + dark mode (system default, user toggle). Self-hosted Inter Variable (Latin subset,
  precached), with a metric-adjusted local fallback and system sans-serif fallbacks. Native
  feel: 44px+ touch targets, segmented controls, sheets, no tiny tracked uppercase labels, no monospace micro labels,
  text ≥ 12px, Title Case buttons. Skeleton loaders, empty states, optimistic kudos, toast feedback, press states.
- Passkeys UI: Login shows "Log In with Face ID/Touch ID/Fingerprint/Windows Hello/Passkey" (label from the
  platform) when `PublicKeyCredential` exists, and the email field uses `autocomplete="username webauthn"` with a
  conditional (autofill) request where `isConditionalMediationAvailable()`; the button aborts it. After a password
  login (not a forced change) a one-time sheet offers setup if a platform authenticator exists and the user has no
  passkeys; Not Now is remembered per user on the device. Settings lists passkeys (name, last used/added), removes
  with confirmation and sets up new ones, asking for the password when the login is older than 10 minutes. Options
  are fetched before the tap so iOS Safari keeps the user gesture; cancel/abort and browser-side autofill failures are silent. Works the same in an
  installed iOS PWA (iOS 16+) since the app keeps its own origin.
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
