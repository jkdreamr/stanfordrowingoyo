# Contract-driven load runner

Requires Node 24 (native TypeScript stripping), no runtime dependencies. Backend
routes must implement the roster-claim contract in `shared/types.ts`; unsupported
routes fail the run without retrying obsolete signup payloads.

Before local Wrangler/E2E use, copy `.dev.vars.example` to the gitignored
`.dev.vars`. It binds a dummy `PASSWORD_PEPPER` (required for all password work)
and `TEAM_CODE`. Never use the example pepper in deployment or commit real secrets.

```sh
LOAD_ADMIN_PASSWORD='your-local-admin-password' npm run load -- --base-url http://localhost:8787 --users 60
LOAD_ADMIN_PASSWORD='your-local-admin-password' npm run load -- --base-url http://localhost:8787 --seed 42 --json load-report.json
npm run load -- --base-url http://localhost:8787 --skip-signup --json existing-accounts-report.json
npm run load -- --base-url http://localhost:8787 --cleanup
```

## Options

| Flag                          | Default / meaning                                                           |
| ----------------------------- | --------------------------------------------------------------------------- |
| `--base-url`                  | Required HTTP(S) origin, no implicit target                                 |
| `--users`                     | 60, positive integer                                                        |
| `--scenario`                  | `both`, or `session`, `burst`                                               |
| `--burst-window`              | 60 seconds; nonnegative integer                                             |
| `--auth-ramp`                 | 60 seconds; evenly spaced initial signup/login starts; 0 disables pacing    |
| `--skip-signup`               | Login-only mode using accounts created by a previous run; no admin required |
| `--concurrency`               | users; maximum concurrent auth/session rowers (not burst writes)            |
| `--p95-ms`                    | 800; per-endpoint nearest-rank p95 ceiling for every non-signup request     |
| `--team-code`                 | Otherwise authenticate admin and read settings                              |
| `--admin-email`               | joskoo@stanford.edu; must be roster-seeded for initial signup               |
| `--admin-password`            | Or `LOAD_ADMIN_PASSWORD`; required for bootstrap and cleanup                |
| `--password`                  | `loadtest-password-1`, used for synthetic rowers                            |
| `--seed`                      | 1; deterministic per-rower PRNG, independent of scheduling                  |
| `--json`                      | Optional file for raw samples and aggregate report (no credentials)         |
| `--cleanup`                   | Teardown only; no session or burst traffic                                  |
| `--allow-remote`              | Explicitly allow non-local origins                                          |
| `--i-know-this-is-production` | Additional acknowledgement for production-looking names                     |

Only localhost, 127.0.0.1, ::1, and subdomains of `.local` are local. Remote
targets always require `--allow-remote`. Names containing prod, stanford, or
rowingoyo additionally require the production acknowledgement. This heuristic
is not production detection: always verify the destination yourself. Redirects
are refused. Requests have a 30-second timeout. Passwords supplied as flags may
appear in shell history; prefer the environment for the admin password.

Each rower uses its own cookie jar, manually forwarding Secure `oyo_session`
cookies even on local HTTP. Fresh rowers try signup first, then login only on 409;
rows already claimed by the matching user try login first,
then signup only on 401/404. There are at most two auth attempts per rower, no retry
storms. Use a fresh local database or consistent passwords. Do not run concurrently
against the same seed emails.
Every non-GET request sends `X-OYO-CSRF: 1`, including bodyless kudos/unlink/delete.
After authentication, every simulated user GETs `/api/me/plan` exactly once in the
`personal-plan` phase, for session, burst and combined runs. Every fifth user (indices
5, 10, ...) PUTs a two-session plan starting this week's Monday from server config.
Both endpoints appear in the standard per-endpoint latency/error report and use the
shared API contract; personal-plan mutations send the same CSRF header as other writes.

Initial authentication has its own ramp, before any session or burst work. By
default 60 rowers start evenly from 0 through 60 seconds (`--auth-ramp 60`), with
the first user starting immediately; a single user starts immediately too.
`--concurrency` bounds in-flight authentication and session workflows; slow
requests can delay later starts. The same startup ramp paces `--skip-signup`
logins, but **login latency remains gated at 800 ms**. Neither session concurrency
nor the separate burst window is reduced by the authentication ramp.

### Pre-created accounts (`--skip-signup`)

First run the default command on disposable state. It creates deterministic
`loadtest+1@example.com` through `loadtest+N@example.com` accounts with the
synthetic `--password` value (default `loadtest-password-1`, not a real credential).
Then run with `--skip-signup`, the same base URL, user count and password. The
mode requires no admin password, team code or credential file; it does not
bootstrap an admin, discover/create roster rows, or fall back to signup. Missing,
inactive or incorrectly credentialed accounts fail the run instead of being
silently provisioned. Do not clean up or reset the state between these two runs.

Admin bootstrap is shared by all rowers: one login attempt, signup only if missing.
Admin signup sends only email/password through its email-bound bootstrap row.
The admin session is reused for all roster operations. A supplied `--team-code`
skips settings discovery, not admin authentication.

After bootstrap, `POST /api/auth/roster` validates the team code. Discovery errors stop the run. Each user gets one
synthetic roster row per rower, `Load Test 01`, `Load Test 02`, etc., with null
email/group and role rower. Reuse unclaimed matching names or rows already linked
to the corresponding `loadtest+N@example.com` user; refuse another user's claim.
Signup claims that row with a seeded random group. Real seeded names are never
claimed. Unclaimed synthetic rows are checked against discovery before signup sends `roster_id`, never a name.
`contract.ts` aliases the shared API rather than duplicating it. Sequential rower seeds are mixed before the PRNG to avoid clustered
burst offsets; scheduling does not affect random choices.

Session rowers create 1–3 workouts, occasionally upload a generated ~300 KiB
16x16 baseline JPEG, paginate the feed up to three pages, interact, and query
stats. Burst rowers share successful sessions and have uniform random start
offsets within the window; failed session rowers are skipped to avoid repeating
auth failures. All rower authentication finishes before steady-state traffic;
successful sessions are reused for the burst. `makeJpeg` in `jpeg.ts` is exported
for E2E reuse.

Reports include each request's status, full-body latency, endpoint percentiles,
error counts (including 4xx), wall time and throughput overall and by scenario.
Signup has its own table: p95 is reported, **not subject to the 800 ms gate**.
All signup samples, including optional admin bootstrap, are kept in that table.
The gated table contains every non-signup endpoint, including login (even a
fallback during signup), reads, logging, feed, images, social, stats and burst
traffic. JSON reports retain overall `endpoints` and add `signupEndpoints` and
`gatedEndpoints` for these independent tables. `timings.signup` / `timings.login`
measure the initial rower ramp according to mode.
Setup (admin bootstrap/roster preparation) and cleanup each measure their own wall
time, including failed phases. Admin auth remains in the setup table.
Exit 2 means invalid CLI arguments; exit 1 means p95 exceeded, 5xx, network errors,
or an internal/setup/authentication failure. Expected auth 4xx are counted but do
not alone fail the latency/status checks; a rower left unauthenticated does fail
the workflow. A failed rower stops its workflow to avoid cascading errors.
All 5xx and network errors, including signup and roster discovery failures, fail
the run regardless of latency exemption.

## Cleanup and local reset

Cleanup authenticates as admin, lists users, and deactivates **only** emails
matching `/^loadtest\+\d+@example\.com$/`, also clearing `on_leaderboard`. It does
not delete workouts, images, or comments, or reactivate accounts on the next run.
It first unlinks claimed rows named `/^Load Test \d+$/`, then
deletes matching synthetic rows (including unclaimed ones). Other roster rows
are untouched. Unlinked inactive accounts can subsequently claim a new roster row with the same email,
preserving their content. Use fresh state when measuring a clean run.
For local Wrangler development the simplest full reset is stopping Wrangler and
deleting its persisted state directory (default `.wrangler/state`, or the directory
you explicitly supplied with `--persist-to`, e.g. `~/oyo-load-state`). Never delete
shared/production state. Each run adds content; use isolated disposable state.

`npm test` discovers `scripts/load/*.test.ts` through Vitest defaults. Future
`e2e/**/*.e2e.ts` files do not match its `.test`/`.spec` patterns.
