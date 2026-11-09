# Adding A Daily Game

Worldle's browser registry and UI use the shared contract and dedicated `today`/`guess` endpoints
and `serverComplete`; do not submit generic result payloads. Its opaque silhouette id
comes from the server, never a client-side date-to-answer lookup. Mock mode uses an
artificial Mock Island answer, not Worker coordinates or schedule data.

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
Word Guess, Perception, Connections and Worldle use `serverComplete`: their dedicated endpoints
own progress and write results, and the frame fetches the completed result rather than
submitting a payload. Their generic result endpoints return 405. Answer banks and future
stimulus generation stay Worker-only. Streaks and recap highlights read `game_results`.

Worldle uses the shared names/aliases for its country combobox and loads only the current
opaque silhouette from its server day response. Its completed result fetches the revealed
day for the locator coordinates. Mock mode renders an artificial silhouette from
`public/mock-worldle.svg`, never a real-country mapping. The hub and route gate Worldle
against the server game list, just like Dive; there is no Worker feature import in the client.
