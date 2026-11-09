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
self-signed dev certificate. It enables `OYO_TEST_CLOCK=1` through Wrangler's E2E-only `--var` flag so
`X-OYO-Test-Now` works without local secret-file changes. Production config is
unchanged. An externally managed `E2E_BASE_URL` server must enable the clock
itself for clock-dependent scenarios. Managed Wrangler also passes
`--define __OYO_DIVE_TEST__:true` so every Dive test runs despite the production
switch being off. External test servers must use that define too; production
Wrangler config never defines it.
Browser/API contexts and the health check ignore
certificate errors locally. Existing servers are reused outside
CI, without resetting their state. `E2E_BASE_URL=https://localhost:8799` skips
server management entirely; only local servers are allowed. Use a disposable
database: tests create users, workouts and social data, and change a user role.

For two consecutive full browser matrices, use fresh managed state for each run
(leave `E2E_BASE_URL` unset and port 8799 free):

```sh
npm run e2e
npm run e2e
```

Do not keep an existing server running between these commands. The configured
projects have separate auth-IP buckets, but reusing the same database across full
runs can exhaust the production auth rate limit. Accumulated leaderboard entries
can also hide lower-ranked test rowers. If `E2E_BASE_URL` targets an external local
server, give each full run its own disposable persistence directory; do not reset
unrelated state. Fresh per-run state keeps coverage isolated without changing
production rate limits, workers, retries or skips.

`alignment.e2e.ts` sweeps every main, authentication and staff screen, plus
onboarding, celebrations, empty/error states and representative sheets/dialogs,
in light and dark. It checks equal tab widths/centers and label baselines within
1px, 44px tab targets, centered empty states/headings, header icons, sheet bounds,
text clipping and horizontal overflow. Deliberate ellipses/line clamps, accessible-only text
and horizontally scrollable content are excluded from clipping checks.
The iPhone project covers 375×667, 393×852 and 430×932 with WebKit; Pixel covers
360×800 and 412×915 with Chromium; desktop covers 1440×1000. Each case runs only
in its designated project, so other-project cases are intentionally skipped.
Screenshots and per-screen `geometry.json` go to the test output directory, or
`E2E_ALIGNMENT_DIR` when set to a persistent directory outside the repository.
These are browser viewport checks, not physical-device or installed-PWA tests.

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

Offline draft tests opt into isolated persistent WebKit rower profiles under
`test-results/`: WebKit's ephemeral contexts reject IndexedDB Blob/File writes,
while persistent contexts support them. Other tests keep the default contexts.
These scenarios block service workers so Playwright can intercept entry POSTs,
including the committed-create/lost-response case. They still use the real HTTPS
worker, synthetic roster claims and the actual WebKit engine.
Set `OYO_SCREENSHOT_DIR` to an existing directory outside the repo to capture
iPhone Log restoration and offline states in light and dark.

Passkey scenarios (`passkeys.e2e.ts`) use a Chrome DevTools Protocol virtual
platform authenticator (`WebAuthn.addVirtualAuthenticator`, CTAP2, internal
transport, resident keys, user verification) in desktop-chrome and pixel-7:
post-login setup prompt, Not Now, conditional (autofill) sign-in, explicit
button sign-in, Settings list/remove, and a removed passkey being rejected. The
real worker verifies every signature; mock mode skips the ceremony test.
WebKit limits: Playwright's WebKit has no virtual authenticator or CDP and does
not expose `navigator.credentials`, so iphone-15 only checks the login markup
(`autocomplete="username webauthn"`, button hidden without WebAuthn). Face ID,
iOS Safari, the installed iOS PWA and Android biometric prompts need manual
testing on real devices over HTTPS.

Each project sends its own `CF-Connecting-IP` (198.51.100.1–3) so the suite's signups and logins
stay under the 150-per-IP auth limit. Cloudflare overwrites this header in production.
