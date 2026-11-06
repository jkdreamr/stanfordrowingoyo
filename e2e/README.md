# Playwright E2E

Run `npm run e2e:install`, then `npm run e2e` on Node 24. No E2E CI job is
enabled yet. Desktop Chrome and Pixel 7 use Chromium; iPhone 15 defaults to
WebKit. If WebKit cannot launch locally, use `E2E_IPHONE_ENGINE=chromium` to
retain the iPhone descriptor with a Chromium engine (not Safari coverage).

The managed server builds web assets, wipes only `.wrangler/e2e-state`, and
starts Wrangler on http://localhost:8799. Existing servers are reused outside
CI, without resetting their state. `E2E_BASE_URL=http://localhost:8799` skips
server management entirely; only local servers are allowed. Use a disposable
database: tests create users, workouts and social data, and change a user role.

Global setup signs up the roster-seeded admin without a join code, logging in
only if signup reports 409. Set `E2E_ADMIN_PASSWORD` for an existing database;
the default is `e2e-dev-admin-password-1`. Admin auth runs once for all projects,
not per worker. State and join code stay in ignored `e2e/.auth/`. A 501 auth
response produces `backendReady:false`; backend fixture consumers then skip.
Other bootstrap errors fail instead of masquerading as an unavailable backend.
Admin signup first sends email/password, with a named-signup fallback on legacy
validation 400. The roster probe selects legacy flow only on 404/405/501. For
roster APIs the admin creates a unique `E2E <project> <random>` row per test user;
that row is then claimed with the test email/password and group. Real seeded
names are never claimed. Every API mutation sends `X-OYO-CSRF: 1`.

All current product screens are stubs. Scenario bodies use semantic locators
based on architecture §§4/6/7, with explicit `test.fixme` notes naming the stub.
Remove each fixme as its screens land and align the accessible labels with the
implemented UI. Smoke shell/manifest/health tests run now; the Login expectation
is separately fixme because there is no auth guard yet. Unique rowers isolate
tests across projects, and leaderboard assertions compare only their own users.

Use localhost, not 127.0.0.1, for the Secure `oyo_session` cookie on HTTP.
The backend-dependent smoke test signs up through an in-page fetch, checks the
Secure/HttpOnly cookie, then verifies in-page `/api/me` authentication in all
three engines. It needs no implemented UI screen and skips only when backend
bootstrap reports 501. Rower contexts preserve each project's device options.
Current local WebKit rejects Secure cookies over HTTP localhost, unlike Chromium:
the test exposes this as a 401 from `/api/me`. Do not weaken the cookie or skip
the test to mask it; authenticated WebKit coverage needs a local HTTPS strategy.

Reports are in ignored `playwright-report/`; failure screenshots and retry traces
are in ignored `test-results/`. Vitest's defaults exclude `*.e2e.ts`.
