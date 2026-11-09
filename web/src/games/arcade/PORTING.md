# Porting A Triumph Game To Daily Arcade

Use Chicken Crossing as the working reference. Keep the original difficulty curve
or make it harder, never easier. Do not simplify hazards, timing, generation or
scoring just to fit the host or pass validation.

## 1. Inventory And Copy The Game

Start at `~/repos/josh/src/os/arcade/games/<source>/`. Create
`web/src/games/arcade/<id>/` with a stable kebab-case id shared by server and web.

| Source directory | Game files to port                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `coxbox`         | `logic.ts`, `draw.ts`, `passages.ts`, `coxbox.css`                                                           |
| `stack`          | `logic.ts`, `stack.css`; rewrite the renderer from `index.tsx` without Three.js, rather than copying `gl.ts` |
| `2048`           | `logic.ts`, `2048.css`; rendering lives in `index.tsx`                                                       |
| `minesweeper`    | `logic.ts`, `layout.ts`, `solver.ts`, `minesweeper.css`                                                      |
| `sudoku`         | `logic.ts`, `layout.ts`, `gen.worker.ts`, `sudoku.css`                                                       |

Adapt source `index.tsx` into `Play.tsx`; use `meta.ts` for instructions and original
settings/difficulty. Copy only assets actually referenced. Port corresponding
logic assertions from `~/repos/josh/tests/`; add tests for any necessary adaptation.
Preserve logic/rendering faithfully, aside from seeded randomness, shared timing
constants, stats accounting, formatting and strict TypeScript/lint requirements.
Stack needs a deliberate non-Three renderer; do not replace its mechanics with a
simpler game. Keep Sudoku generation worker seeds deterministic and terminate the
worker on unmount.

Strip Triumph `GameShell`, `GameProps`, `useShell`, online/room/party protocols,
music, Three.js, host leaderboards, local high scores and saved-run resume/restart
flows. The daily host owns attempts and best scores; a local restart must not
bypass starting a server run. Do not copy the entire Triumph kit. Reuse
`arcade/kit` and add only small, generic helpers when genuinely needed.

## 2. Implement The Play Contract

Implement `Play(props: ArcadePlayProps<Stats>)` from `kit/types.ts`:

```ts
interface ArcadePlayProps<S> {
  seed: number;
  paused: boolean;
  sound: boolean;
  reducedMotion: boolean;
  setScore(n: number): void;
  onGameOver(result: { score: number; stats: S; title: string; detail: string }): void;
  endRequested: boolean;
}
```

- Use only the server-provided `seed`. No `Math.random`, wall clock or browser
  entropy in logic/generation; the same seed and inputs must reproduce the game.
  Sound pitch jitter outside logic is fine. Keep private answer/generator data
  Worker-only if the game requires it; never eagerly import game modules.
- Pause simulation time and held input when `paused`; do not merely hide rendering.
  Use `useGameLoop(update, render, { running: !paused })` for real-time games,
  `useCanvas` for canvas sizing (DPR capped at 2), and `useKeys`/`useGestures` where
  appropriate. Puzzle controls may use accessible DOM elements instead.
- Call `setScore` as the score changes. Report exactly once on natural completion,
  after any death animation. On `endRequested`, immediately report current score
  and stats with the game's death/reason field set to `'quit'`, even while paused.
- Track simulation duration and whatever counters the validator needs. Reduced
  motion may suppress particles/camera effects, never change gameplay difficulty.
  Use kit `sfx`; sound is off by default and audio unlock is gesture-only.
- Clean up every listener, rAF, timer, observer, worker and owned resource. Scope
  CSS under a `.g-<id>` root and do not recreate stage chrome in the game.

## 3. Add The Shared Validator And Server Registration

1. Add `shared/games/<id>.ts` exporting the id, maximum score, a compact `Stats`
   type, any timing constants shared with simulation, and a pure
   `validateRun(score: number, stats: unknown, elapsedMs: number): Stats | null`.
2. Reject malformed stats, missing/extra keys, unknown death/reason values,
   non-finite/unsafe/negative counters, inconsistent score/counters and scores over
   the maximum. Bound duration against server elapsed time (reject negative elapsed)
   and bound actions/progress by the original game's rate. Choose explicit, tested
   timing tolerance; do not reuse Chicken's hop bound for unrelated mechanics.
   Validate normal, empty/zero/quit and impossible runs without side effects.
3. Add a flag in `worker/src/games/features.ts`. Behind that flag, **add** an entry
   to both `worker/src/games/arcade.ts` (`id`, `max`, `validate`) and
   `worker/src/games/registry.ts` (`id`, `direction`, no `score`). Preserve existing
   entries when extending the current Chicken registry expression. The generic
   results endpoint should remain 405 for arcade games.
4. Reuse existing today/start/finish routes. No game-specific route or migration is
   normally needed. Seeds derive server-side from `hashSeed('arcade:' + id + ':' + date)`.
   The server date is Los Angeles today. Locked today responses have a null seed.

The host allows three attempts per day, abandons an active attempt when another
starts, and stores the strictly best finished score. Starting and finishing require
access and the displayed date. Tokens belong only to the active run.

**Arcade runs are client-simulated and client-scored; the server only plausibility-checks
them (consistency, elapsed-time and action-rate bounds, maximum). They are not tamper-proof.**

## 4. Add The Lazy Web Entry

Create `<id>/index.tsx` with a default component wrapping `ArcadeDailyFrame<Stats>`.
Pass `gameId`, `title`, short `howTo: string[]`, `formatScore`,
`renderPlay={(props) => <Play {...props} />}` and optional `summarizeStats`.
The frame owns access, start/finish, retrying the same token/payload, day-change
recovery, Share and the day board; `ArcadeStage` owns full-screen pause/scroll/audio.
Do not duplicate those API calls in `Play`.

Add a tidy entry to `web/src/games/registry.ts` with `kind: 'arcade'`, matching id and
direction, a Lucide icon, `accent: 'var(--accent-ink)'`, score formatter and
`lazy(() => import('./arcade/<id>'))`. The hub groups enabled arcade entries
automatically. Also update `web/src/mock/handlers.ts` if supporting mock mode,
registry parity tests and enabled-game expectations (including launch E2E).

## 5. Test And Measure

- Shared validator tests: valid/zero/quit cases, malformed/extra keys, inconsistent
  score, maximum and elapsed/action-rate boundaries.
- Port original logic assertions. Add same-seed generation and scripted-step
  determinism, plus a simulated run accepted by the shared validator using
  simulated elapsed time. Keep original difficulty assertions intact.
- Component tests: game reports natural completion and quit once; pause stops
  simulation. Retain generic frame coverage for locked/intro/start/finish, zero
  attempts, conflicts, save retry, Share and boards; extend it for new behavior.
- Worker tests: flag/registry visibility, deterministic seed, access/date guards,
  attempts/abandonment/replay, best-score updates, rejected stats without mutation,
  generic results 405 and board/streak inclusion.
- Add real-worker E2E using `e2e/fixtures.ts` and `csrfHeaders`, unique rowers per
  project, and a date/clock that covers simulated duration. Exercise unlock,
  play/quit/save, all attempts, board, hub, scroll lock and navigation cleanup on
  desktop Chrome, iPhone WebKit and Pixel Chromium. Review light/dark screenshots
  outside the repo; do not claim synthetic touch events prove native iOS swipes.

Load Node first: `source ~/.nvm/nvm.sh`. Run:

```sh
npm run format && npm run lint && npm run typecheck && npm test
npm run build
npx playwright test e2e/<id>.e2e.ts
```

Before edits, record `npm run build` main-entry raw/gzip and Worker `Total Upload`
lines. Compare after edits: game/kit code must remain in lazy chunks, not the main
entry. Inspect emitted imports as well as sizes; keep private-content check-web
PASS lines. The original pre-arcade main baseline was 448.68 kB / 136.37 kB gzip;
Chicken's wired main is about 448.80 kB / 136.39 kB gzip. The original Worker gzip
baseline was 2939.08 KiB; Chicken is 2940.50 KiB. Keep the original foundation
delta within 10 KiB gzip; for each additional port, agree a new incremental budget
before adding bulky validation/dependencies. Do not silently spend the budget on
Three.js or client game code in the Worker. Builds are dry runs, not deployments.

## 6. Mobile And UX Checklist

- Follow architecture §7 and the required design skills. Reuse `Button`,
  `IconButton`, Lucide and app surface/text/focus tokens; orange is for a new best.
- Keep text at least 11px, controls at least 44px, labels Title Case, instructions
  short and buttons clear above the tab bar on short screens. No tracked-uppercase
  eyebrows, monospace micro-labels, keyboard chips or arrow-glyph buttons.
- Verify safe areas, unclipped HUD/dialog/buttons, contrast in light/dark, actual
  play after several actions, visible focus and reduced motion. Touch inputs must
  not scroll/zoom or trigger tab swipe. Keyboard handlers must ignore editable
  fields and modifier shortcuts; typing games need native text-entry controls.
- Check visibility/blur pause, End Run while paused, body/html overflow and focus
  restoration after leaving. Keep original gameplay difficulty unchanged or harder.
