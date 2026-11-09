# Adding A Daily Game

## Arcade

Daily Arcade uses generic `/api/games/:game/today`, `/runs/start` and `/runs/finish`
routes. Send the displayed date on writes; use only the server-provided seed and
active run token. Three attempts per day, best finished score wins; starting again
abandons an active attempt. Chicken Crossing is the first enabled arcade game.
Runs are client-simulated/scored and server plausibility-checked, not tamper-proof.

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

Arcade entries set `kind: 'arcade'` and lazy-load `ArcadeDailyFrame`. Pass `gameId`,
`title`, `howTo`, `formatScore`, `renderPlay(ArcadePlayProps<S>)`, and optionally
`summarizeStats(stats)`. The frame owns today/start/finish, retrying the same run on
save failures, Share and the day board; `ArcadeStage` owns the full-screen lifecycle.
Keep game logic, rendering and the kit behind the lazy entry, never in the eager registry.
