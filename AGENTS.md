# Working on Stanford Rowing OYO

## Run and Check

Use Node 22+ and npm. Load Node with `source ~/.nvm/nvm.sh` first.

```sh
npm install
npm run dev          # Vite :5173; /api proxies to Wrangler :8787
npm run typecheck   # all workspaces
npm run lint
npm test
npm run build       # assets and Worker dry run; does not deploy
npm run format:check
npm run format      # apply formatting before committing
```

Health, auth, me, config, entries, images, social, notifications, stats, leaderboard, and team
API routes are implemented; admin, plan, and announcements remain pending.
All tests use Vitest 5; Worker tests use the official `@cloudflare/vitest-plugin` runtime.
Deploy only when explicitly asked.

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
