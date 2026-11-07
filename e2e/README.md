# Playwright E2E

Copy `.dev.vars.example` to the gitignored `.dev.vars` before starting the local
server. Its dummy `PASSWORD_PEPPER` enables password operations and its dummy
`TEAM_CODE` seeds fresh state. Never use these values in deployment.

Run `npm run e2e:install`, then `npm run e2e` on Node 24. No E2E CI job is
enabled yet. Desktop Chrome and Pixel 7 use Chromium; iPhone 15 defaults to
WebKit. If WebKit cannot launch locally, use `E2E_IPHONE_ENGINE=chromium` to
retain the iPhone descriptor with a Chromium engine (not Safari coverage).

The managed server builds web assets, wipes only `.wrangler/e2e-state`, and
starts Wrangler on https://localhost:8799 with `--local-protocol https` and its
self-signed dev certificate. Browser/API contexts and the health check ignore
certificate errors locally. Existing servers are reused outside
CI, without resetting their state. `E2E_BASE_URL=https://localhost:8799` skips
server management entirely; only local servers are allowed. Use a disposable
database: tests create users, workouts and social data, and change a user role.

For the full browser matrix, run each project with fresh managed state:

```sh
npm run e2e -- --project=desktop-chrome
npm run e2e -- --project=iphone-15
npm run e2e -- --project=pixel-7
```

Do not keep an existing server running between these commands. The combined
matrix shares one database and localhost auth bucket; its synthetic signups can
exceed the production signup rate limit, and accumulated leaderboard entries can
hide lower-ranked test rowers. Per-project state keeps coverage isolated without
changing production rate limits.

Global setup signs up the roster-seeded admin without a join code, logging in
only if signup reports 409. Set `E2E_ADMIN_PASSWORD` for an existing database;
the default is `e2e-dev-admin-password-1`. Admin auth runs once for all projects,
not per worker. State and join code stay in ignored `e2e/.auth/`. A 501 auth
response produces `backendReady:false`; backend fixture consumers then skip.
Other bootstrap errors fail instead of masquerading as an unavailable backend.
Admin signup sends only email/password using the email-bound bootstrap row.
The admin creates a unique `E2E <project> <random>` row per test user, verifies it
appears in code-gated `POST /api/auth/roster`, and claims its `roster_id` with
the test email/password and group. Discovery errors fail the run; there is no legacy name/signup fallback. Real seeded
names are never claimed. Every API mutation sends `X-OYO-CSRF: 1`.

Login, roster Signup, Home, Log, Weekly Target and Settings scenarios are enabled.
Run `E2E_MOCK=1 npm run e2e` to use the development mock on port 8798 instead of
the real HTTPS worker. Each browser context gets fresh
mock state; tests use SPA links after mutations because a full reload resets the
mock database. Mock requests execute through in-page fetch, not Playwright's
server-side request context. No mock run claims real cookie/backend coverage.

Password scenarios cover Settings' verify-then-change requests, inline incorrect
current-password errors with preserved values, login with the new password, and
temporary-password login followed by forced replacement without a verify call or
reauth token. Both mock and real runs assert the request bodies; the real forced
flow uses the admin reset-password endpoint on an isolated test rower.

Without E2E_MOCK, the suite uses the real backend now merged into main, including
roster signup, password reauthentication and forced password replacement.
Legacy name-based signup is deliberately not exercised because it conflicts
with the owner flow. Bootstrap still skips backend fixtures on a 501 auth response
when testing an older scaffold.
Secure/HttpOnly cookie smoke is skipped in mock mode. Leaderboard, Me and Plan
scenarios are enabled, as are Feed, discussion, kudos-givers,
notifications, public profiles, team search and staff post deletion.
Comment edits cover author-only access, persisted edited state and new-mention
notifications. Reports cover rower privacy, optional reasons, deduplication,
staff notifications, dismissal, audited deletion and deleted-report history.
Admin and Roster scenarios are enabled, including staff post deletion through More
and comment moderation through the confirmation sheet. Unique rowers
isolate real-backend tests across projects. CI runs the five gates, not E2E.

Use HTTPS for the Secure `oyo_session` cookie in all engines.
The backend-dependent smoke test signs up through an in-page fetch, checks the
Secure/HttpOnly cookie, then verifies in-page `/api/me` authentication in all
three engines. It needs no implemented UI screen and skips only when backend
bootstrap reports 501. Rower contexts preserve each project's device options.
WebKit drops Secure cookies on HTTP localhost; Chromium allows them. Local HTTPS
avoids that difference without weakening production cookies or the smoke test.
Testing on a phone/Safari against plain-HTTP `npm run dev` hits the same issue;
use HTTPS for authenticated browser testing there too.

Reports are in ignored `playwright-report/`; failure screenshots and retry traces
are in ignored `test-results/`. Vitest's defaults exclude `*.e2e.ts`.
