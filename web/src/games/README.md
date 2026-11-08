# Adding A Daily Game

- Add a server entry to `worker/src/games/registry.ts`: id matching
  `/^[a-z][a-z0-9-]{1,31}$/`, score direction (`higher` or `lower`), and optionally
  synchronous `score(payload, ctx, date)` returning a safe integer score and JSON payload.
- Generic `POST /api/games/:game/results` is a server-dated, one-shot submission.
  Validate payloads on the server; never trust a client-provided score. Games without
  `score` use their own routes. Every write must refresh the user and call
  `requireGameAccess` inside its synchronous transaction after parsing the body.
- Add a typed `GameDefinition` here, with title, Lucide icon, semantic accent,
  direction matching the server, lazy component and score formatter. The `/games/:id`
  route, hub and day boards pick it up automatically; no migration is needed.
- Use `useGameAccess` and `GameLocked` in the component. Invalidate the `games`
  query root after writes. Scores, payloads, access and dates come from the server.
- Day boards use competition ranks and hide today's board until the caller plays
  (staff exempt). Past days are final. Weekly points sum `players - rank + 1`
  across registered games, with distinct played dates counted once.

Dive currently has only its start surface; its dedicated gameplay arrives separately.

`DailyGameFrame` wraps a generic-scorer game: access gate, own result, one-shot submit,
result card with Share, and the day board. Pass `play({date,onComplete})` and
`summarize(result)`. Word Guess, Perception and Connections use it; their pure rules live in
`shared/games/` and are reused by the Worker scorers.
