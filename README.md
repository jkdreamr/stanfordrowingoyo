# Scaffold Development

Requires Node 22+ and npm. Load nvm first: `source ~/.nvm/nvm.sh`.

```sh
npm install
npm run dev       # Vite on :5173 proxies /api to Wrangler on :8787
npm run typecheck
npm run lint
npm test
npm run build     # web assets + Worker dry run (no deployment)
npm run deploy   # explicit Cloudflare deployment; not needed locally
```

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
