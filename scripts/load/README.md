# Contract-driven load runner

Requires Node 24 (native TypeScript stripping), no runtime dependencies. Backend
routes must implement the roster-claim contract in `shared/types.ts`; unsupported
routes fail the run without retrying obsolete signup payloads.

```sh
LOAD_ADMIN_PASSWORD='your-local-admin-password' npm run load -- --base-url http://localhost:8787 --users 60
LOAD_ADMIN_PASSWORD='your-local-admin-password' npm run load -- --base-url http://localhost:8787 --seed 42 --json load-report.json
npm run load -- --base-url http://localhost:8787 --cleanup
```

## Options

| Flag                          | Default / meaning                                                   |
| ----------------------------- | ------------------------------------------------------------------- |
| `--base-url`                  | Required HTTP(S) origin, no implicit target                         |
| `--users`                     | 60, positive integer                                                |
| `--scenario`                  | `both`, or `session`, `burst`                                       |
| `--burst-window`              | 60 seconds; nonnegative integer                                     |
| `--concurrency`               | users; maximum concurrent auth/session rowers (not burst writes)    |
| `--p95-ms`                    | 800; per-endpoint nearest-rank p95 ceiling                          |
| `--team-code`                 | Otherwise authenticate admin and read settings                      |
| `--admin-email`               | joskoo@stanford.edu; must be roster-seeded for initial signup       |
| `--admin-password`            | Or `LOAD_ADMIN_PASSWORD`; required for bootstrap and cleanup        |
| `--password`                  | `loadtest-password-1`, used for synthetic rowers                    |
| `--seed`                      | 1; deterministic per-rower PRNG, independent of scheduling          |
| `--json`                      | Optional file for raw samples and aggregate report (no credentials) |
| `--cleanup`                   | Teardown only; no session or burst traffic                          |
| `--allow-remote`              | Explicitly allow non-local origins                                  |
| `--i-know-this-is-production` | Additional acknowledgement for production-looking names             |

Only localhost, 127.0.0.1, ::1, and subdomains of `.local` are local. Remote
targets always require `--allow-remote`. Names containing prod, stanford, or
rowingoyo additionally require the production acknowledgement. This heuristic
is not production detection: always verify the destination yourself. Redirects
are refused. Requests have a 30-second timeout. Passwords supplied as flags may
appear in shell history; prefer the environment for the admin password.

Each rower uses its own cookie jar, manually forwarding Secure `oyo_session`
cookies even on local HTTP. Fresh rowers try signup first, then login only on 409;
rows already claimed by the matching user and burst-only re-logins try login first,
then signup only on 401/404. There are at most two auth attempts per rower, no retry
storms. Use a fresh local database or consistent passwords. Do not run concurrently
against the same seed emails.
Every non-GET request sends `X-OYO-CSRF: 1`, including bodyless kudos/unlink/delete.

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
auth failures. All rower authentication runs in a separate bounded phase before
steady-state traffic; burst-only runs re-login in that phase, then spread entry
starts across the burst window. `makeJpeg` in `jpeg.ts` is exported for E2E reuse.

Reports include each request's status, full-body latency, endpoint percentiles,
error counts (including 4xx), wall time and throughput overall and by scenario.
An `Auth phase (rowers)` line and auth table separate rower signup/login cost from
steady-state session/burst latency, without exempting auth from endpoint thresholds.
Setup (admin bootstrap/roster preparation) and cleanup each measure their own wall
time, including failed phases. Admin auth remains in the setup table.
Exit 2 means invalid CLI arguments; exit 1 means p95 exceeded, 5xx, network errors,
or an internal/setup failure. Expected auth 4xx are counted but do not fail the
latency/status checks. A failed rower stops its workflow to avoid cascading errors.
All 5xx, including roster discovery failures, fail the run.

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
