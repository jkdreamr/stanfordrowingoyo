# Scaffold Development

Requires Node 22+ and npm. Load nvm first: `source ~/.nvm/nvm.sh`.

```sh
npm install
cp .dev.vars.example .dev.vars # local-only dummy secrets for Wrangler/load/E2E
npm run dev       # Vite on :5173 proxies /api to Wrangler on :8787
npm run typecheck
npm run lint
npm test
npm run build     # web assets + Worker dry run (no deployment)
npx wrangler secret put TEAM_CODE # optional: seeds team code on first boot only
npx wrangler secret put PASSWORD_PEPPER # required: high-entropy server-only secret
npm run deploy   # explicit Cloudflare deployment; not needed locally
```

`TEAM_CODE` is optional and only seeds a fresh Durable Object. Codes are trimmed,
4–64 characters, and contain only letters, numbers or hyphens. An absent secret
uses a generated UUID; an invalid secret (including blank/short values) logs a
warning without its value and falls back to a generated UUID rather than crashing.
Discovery/signup compare trimmed codes case-insensitively (`koo26` and `KOO26 ` both work).
It never replaces an existing code. Change it later in Admin → Team settings.

`PASSWORD_PEPPER` is mandatory for signup, login and password changes/resets;
missing/blank values fail closed with 500 and an explicit server log. Other routes
remain available. Use a high-entropy secret in deployment, never the example value.
Passwords use HMAC-SHA256 with the pepper, then 20,000-iteration PBKDF2-SHA256
(`PASSWORD_ITERATIONS` in `worker/src/auth/crypto.ts`) to fit the Free plan CPU budget.
Hashes store their algorithm, iterations, pepper version, salt and digest. Legacy
100k unpeppered hashes upgrade atomically after successful login. Legacy verification
still costs 100k iterations once and may exceed Free CPU limits; staff password
reset avoids that cost. Rotating the pepper requires bumping
`PASSWORD_PEPPER_VERSION`; the single-secret configuration does not retain old
keys, so retire a key only with a password-reset/migration plan for existing users.

Only `GET /api/health` is implemented; the remaining backend modules return 501.
The first API request initializes SQLite and seeds the team. Local Wrangler data
persists under `.wrangler`. The shared `Api` map is the canonical contract; call
`api('GET /api/entries', { query: { scope: 'feed' } })` from the browser.
Staff endpoint paths/payloads, which the spec describes by capability rather than
exact path, are defined explicitly in that map. `GET /api/plan` exposes the plan
to authenticated rowers when the backend is implemented. No auth is implemented yet.
Bike math uses exact 1/3 so the required 60k → 20,000 check holds (not truncated 0.3333).
Run preset math is authoritative rather than rounded sheet labels.

See [the architecture spec](docs/ARCHITECTURE.md) before implementing modules.

# Stanford Rowing OYO

On-your-own training app for Stanford Rowing: log OYO sessions, track equivalent E-meters against weekly targets, see season totals, and share workouts with the team.
