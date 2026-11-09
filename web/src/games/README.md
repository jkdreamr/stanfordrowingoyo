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
- Day boards use competition ranks and require completion of the requested day's game
  (only admins exempt). Dive requires all prompts, not its partial result. Past days are final. Weekly points sum `players - rank + 1`
  across registered games, with distinct played dates counted once.

Dive uses dedicated answer/reveal routes; non-admin staff may moderate only after completion.

`DailyGameFrame` wraps the access gate, own result, result card with spoiler-free Share,
and day board. Pass `play({date,onComplete})` and `summarize(result)`.
Word Guess, Perception and Connections use `serverComplete`: their dedicated endpoints
own progress and write results, and the frame fetches the completed result rather than
submitting a payload. Their generic result endpoints return 405. Answer banks and future
stimulus generation stay Worker-only. Streaks and recap highlights read `game_results`.

Pinpoint also uses `serverComplete`, dedicated today/guess endpoints and the shared
score/share helpers. It renders only server-revealed clues while playing; the stored
result supplies all five clues after completion. Like Dive, it relies on the server's
enabled-game list for route redirects and visibility in the hub and boards; no browser
copy of the Worker feature flag is needed.
