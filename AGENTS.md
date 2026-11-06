# Working on Stanford Rowing OYO

## Run and Check

Use Node 24+ and npm (load scripts use native TypeScript stripping). Load Node with `source ~/.nvm/nvm.sh` first.

```sh
npm install
npm run dev          # Vite :5173; /api proxies to Wrangler :8787
npm run typecheck   # all workspaces
npm run lint
npm test
npm run build       # assets and Worker dry run; does not deploy
npm run format:check
npm run format      # apply formatting before committing
npm run load -- --base-url http://localhost:8787
npm run e2e:install # browser dependencies; once per machine
npm run e2e
```

Health, auth, me, and config API routes are implemented; the remaining backend areas are pending.
Worker tests use a nested Vitest 4 install with the official Workers pool; shared/web keep Vitest 5.
The pool's bundled runtime supports compatibility dates only through 2026-08-22, so the test config
overrides that date without changing production Wrangler configuration. If npm 10 fails installing
the mixed Vitest peer graph (`edgesOut`), use `npx npm@11 install`.
Deploy only when explicitly asked.
CI runs format:check, lint, typecheck, test, and build on every PR and push to main.

## Load Test

```sh
npm run load -- --base-url http://localhost:8787 [--users 60] [--scenario session|burst|both]
```

Node 24 required. Local-only by default; remote targets require `--allow-remote`,
and production-looking hosts also require `--i-know-this-is-production`.
Default pass criteria: every endpoint p95 ≤ 800 ms (`--p95-ms`), no 5xx or network
errors. Reported 4xx do not fail those checks; internal/setup failures also exit 1.
The scaffold's 501 responses fail as expected, except the expected roster probe.

Seeds `loadtest+N@example.com` users. Admin credentials (`LOAD_ADMIN_PASSWORD` /
`--admin-password`) are required once per run; `--team-code` optionally skips code
discovery. A roster probe selects legacy signup on 404/405/501, otherwise creates
or reuses only synthetic `Load Test NN` roster rows and claims them with random
groups. Never claims real seeded names. Every non-GET load/E2E API request sends
`X-OYO-CSRF: 1`. Fresh rowers sign up first, then log in on 409; known claims and
burst re-logins use login first. Auth has its own phase/table and still must meet
thresholds; setup/cleanup have independent wall times. Teardown with `--cleanup` and the same base URL/admin credentials:
unlink/delete synthetic roster rows on roster APIs, and deactivate matching seed
users in either flow; content remains. For a full local reset, stop Wrangler and delete
its persisted state directory (`.wrangler/state` or the explicit `--persist-to`
directory). Use disposable local state. See `scripts/load/README.md` for flags.

## E2E

Run `npm run e2e:install` once, then `npm run e2e`. Projects: desktop-chrome,
iphone-15 (WebKit), pixel-7 (Chromium). If WebKit cannot launch, use
`E2E_IPHONE_ENGINE=chromium` (iPhone descriptor, not Safari coverage).

Each managed server run wipes `.wrangler/e2e-state` for fresh DO state and serves
the built app at https://localhost:8799 using Wrangler's self-signed dev certificate
(`--local-protocol https`); browser/API contexts and health checks ignore local
certificate errors. Reusing an existing server outside CI does
not reset it. `E2E_BASE_URL` targets an already-running local server and skips
server management; HTTP and HTTPS local URLs are accepted. The backend-dependent smoke
test checks in-page signup and `/api/me` cookie authentication in all projects.
HTTPS is needed because WebKit drops Secure cookies on HTTP localhost while
Chromium allows them. Phone/Safari testing against plain-HTTP `npm run dev` hits
the same issue; use HTTPS there too. Production cookies remain unchanged.

Global setup signs up roster-seeded `joskoo@stanford.edu` without a team code,
or logs in once if it exists. Set `E2E_ADMIN_PASSWORD` for existing state; the
default is dev-only. Auth state is ignored under `e2e/.auth/`; 501 auth responses
skip backend-dependent tests. Roster APIs get unique synthetic `E2E <project> <random>`
rows created by admin and claimed per test, never real seeded names. When a screen lands, remove its test's top-level
`test.fixme`, align semantic locators with the implemented labels, and run all
three projects. See `e2e/README.md`; E2E is not yet in CI.

## Shared Contract

`docs/ARCHITECTURE.md` and `shared/types.ts` are the product and API contract.
Change both together whenever the contract changes. Never break the contract:
coordinate changes with the engineers consuming it and keep callers compatible.
The browser API client derives request and response types directly from the shared Api map.

## Required UI Design Skills

Before UI work, clone these repositories outside this repo and read and follow their skills:

- **unslop**: https://github.com/heydamir/unslop — `skills/unslop/SKILL.md`.
- **ui-ux-pro-max**: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill —
  `.claude/skills/ui-ux-pro-max/SKILL.md`.
- **impeccable**: https://github.com/pbakaus/impeccable — read its skill instructions and
  the relevant design skills for the surface being built.

Clone to read; do not vendor these repositories or skills into this repo.
Follow the palette, accessibility, and interaction requirements in architecture §7.
