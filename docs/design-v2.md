# Design v2: "Drive"

Rowing has two phases: the **catch**, a quick and precise entry, and the **drive**, a powerful release that settles.
Every interaction follows that rhythm: a firm, immediate response to touch, then a weighted spring settle.
The app should feel like a well-made instrument: calm, warm and confident, with motion only where it means something.

This is the prototype direction. It is implemented as a token layer in `web/src/design.css` (loaded after
`styles.css`) plus a few reusable components, so open feature branches pick it up without markup churn.

## Principles

1. **Catch, then drive.** Presses compress instantly; releases settle on a spring. Nothing linear or floaty.
2. **One hero per screen.** Each tab gets one rich focal surface (Week Hero, podium, profile hero). Everything else is quiet.
3. **Numbers are the reward.** Hero figures count up; progress fills from where it was. No decorative numbers.
4. **Cardinal is identity, orange is victory.** Cardinal for brand, controls and progress. Strava orange only for PRs, streaks and target hits.
5. **Depth with restraint.** Frosted glass only on chrome (tab bar). Soft neutral shadows in light; hairlines and surface steps in dark. No grain, glows, colored shadows or idle pulsing.
6. **Quiet copy.** Title Case, short labels. No eyebrows, monospace micro labels, kbd chips or arrow glyphs.
7. **Motion is optional.** Every animation has a `prefers-reduced-motion` variant (none, or a 120 ms fade). Transform, opacity and clip-path only.

## Tokens

### Color

| Token              | Light                                                     | Dark                      |
| ------------------ | --------------------------------------------------------- | ------------------------- |
| `--bg`             | `#F5F3F0` warm paper                                      | `#0E0D0D`                 |
| `--surface`        | `#FFFFFF`                                                 | `#181616`                 |
| `--surface-2`      | `#EFECE8`                                                 | `#242120`                 |
| `--text`           | `#1C1A19`                                                 | `#F5F2EF`                 |
| `--muted`          | `#6B6662`                                                 | `#A8A19C`                 |
| `--divider`        | `#E6E1DC`                                                 | `#2C2827`                 |
| Cardinal           | `#8C1515`                                                 | `#8C1515` / ink `#F18B83` |
| `--cardinal-top`   | `#9C1C18` (hero tone, top)                                | `#8F1A16`                 |
| `--cardinal-deep`  | `#6B0F0F` (hero tone, floor)                              | `#4F0B0B`                 |
| Highlight (orange) | `#FC5200`, PR/streak only                                 | `#FC5200`                 |
| `--glass`          | `rgb(250 248 246 / 78%)`                                  | `rgb(20 18 18 / 76%)`     |
| Medal metals       | gold, silver, bronze gradients on podium rank badges only |

The hero is a single-hue tonal shift within cardinal, never a hue-to-hue gradient. Shadows are neutral only:
`--shadow-card` (2-layer), `--shadow-float` (sheets, overlays) and `--shadow-hero`. Dark mode swaps shadows
for a 1px white 5–7% hairline and surface steps.

### Shape and Space

Cards 20px, controls 14px, hero surfaces 24px, chips 14px. 4pt grid, 16px gutter, 20px card padding.

### Type

System stack (SF Pro, Roboto, Inter) everywhere: zero font bytes and native rendering on both platforms.
Hierarchy comes from size, weight and tight tracking on display figures, using the existing Tailwind scale.

| Role            | Size/Line | Weight  | Tracking |
| --------------- | --------- | ------- | -------- |
| Hero numeral    | 56/56     | 700     | -0.04em  |
| Large Title     | 34/41     | 700     | -0.02em  |
| Title 1         | 28/34     | 700     | -0.02em  |
| Title 2         | 22/28     | 700     | -0.01em  |
| Headline / Body | 17/22     | 600/400 | 0        |
| Subhead         | 15/20     | 500     | 0        |
| Footnote        | 13/18     | 400     | 0        |
| Caption         | 12/16     | 500     | 0        |

### Motion

CSS-first with zero runtime dependency. The spring is a CSS `linear()` curve (Safari 17.2+, Chrome 113+) with a
`cubic-bezier` fallback; the only JS animation is `Ticker`, a short `requestAnimationFrame` count-up.
An animation library (Motion/Framer ~30 kB gzip) was rejected: the platform covers every effect here.
Shared helpers live in `web/src/lib/motion.ts` (reduced-motion check, `afterLaunch`, once-per-session values).

| Token            | Value                                   | Use                                             |
| ---------------- | --------------------------------------- | ----------------------------------------------- |
| `--ease-out`     | `cubic-bezier(0.16, 1, 0.3, 1)`         | arrivals, fills, reveals, tickers               |
| `--ease-in`      | `cubic-bezier(0.5, 0, 0.75, 0)`         | exits (always shorter than the arrival)         |
| `--spring`       | `linear()` spring, damping 0.78, 2% max | anything that travels: tab pill, thumbs, podium |
| `--dur-press`    | 90 ms                                   | press down (the catch)                          |
| `--dur-feedback` | 160 ms                                  | color and opacity feedback                      |
| `--dur-state`    | 240 ms                                  | overlays, state changes                         |
| `--dur-enter`    | 440 ms                                  | first-screen entrance                           |
| `--dur-travel`   | 520 ms                                  | spring release, tab pill, segment thumb         |
| `--dur-focal`    | 760 ms                                  | hero fills, podium, chart columns, bars         |
| `--stagger`      | 40 ms per item, capped at 5             | entrance and day bars                           |
| Ticker           | 900 ms quartic out                      | hero figures                                    |

Rules: transform, opacity and clip-path only (no layout properties); no bounce or elastic curves; no looping
or idle motion; exits are faster than arrivals; one entrance per session.

Reduced motion: no travel, scale or drawing; tickers and rings jump to final values; bursts and ripples are not
rendered; overlays and tab changes keep a 120 ms opacity fade so cause and effect stay legible; the splash is a
static mark with a 120 ms fade.

## Motion Thesis

- **Focal moment.** Home's Week Hero on the first view of a session: the E-meter total counts up, the ring
  sweeps from empty and the day columns rise left to right, all starting as the splash curtain lifts.
- **Continuity.** Tab changes use View Transitions: the old screen fades out in 90 ms and the new one arrives
  from the direction of the chosen tab (16 px, 260 ms). The selection pill springs between tabs. Large titles
  fold away on scroll (scroll-driven animation) while the compact title fades into the frosted bar.
- **Feedback.** Every control compresses instantly on press and springs back on release; cards compress less
  than buttons. Kudos, double-tap and saves acknowledge with the puddle ripple.
- **Data.** Leaderboard bars and Me breakdown bars fill from their start; weekly columns rise from the
  baseline (most recent weeks last) and the selected week keeps full ink; the season line draws left to right
  and redraws when the range changes.
- **Budget.** Figures animate once per session and again only when the value changes, so revisiting a tab is
  calm. Nothing animates while the splash covers the screen.

## Signature Interactions

1. **Launch: "First Stroke".** Full-bleed cardinal. The Gabriel mark springs in while its ring draws; three
   ripples spread from it like an oar's puddle; the OYO letters rise in sequence, a wake line draws under them
   and Stanford Rowing fades in; then the sheet lifts away like a curtain to reveal Home. ~1.3 s total, tap or
   any key skips, pure inline CSS (0 kB JS). Entrance motion waits for the curtain.
2. **Home Week Hero.** The one bright element on Home: a tonal cardinal card with the E-meter total, a white
   progress ring and a Mon–Sun column strip (today outlined). Streak and To Go chips sit underneath.
3. **Number Tickers.** Hero figures (Home volume, Me season tiles, save celebration) count up on the first view
   in a session and when their value changes; screen readers get the final value only.
4. **Glass Tab Bar.** Frosted bar with one selection pill that travels between tabs on the spring; the selected
   icon settles from a small catch; the centered cardinal Log disc compresses on press. Five equal columns keep
   Log pixel-centered.
5. **Directional Tab Changes.** Fade-through View Transition in the direction of travel; chrome stays put.
6. **Kudos Burst.** Thumb pops with an 8-spark ring and the count rolls up; double-tap shows the heart plus two
   water ripples at the touch point.
7. **Session Saved Moment.** After saving, a cardinal card springs in over Home with a drawn check, ripples, the
   E-meters ticking up and the weekly bar filling from the old to the new percent; auto-dismisses in ~1.9 s,
   tap or Escape closes it.
8. **Podium Rise.** Bronze, silver, then gold rise into place, with metal rank badges and medal-tinted cards.
9. **Me Profile.** Ringed avatar, three stat tiles (Season Meters, Week Streak, Top Week) that tick up, weekly
   columns and the season line drawing in.

## Rollout After Approval

- Fold `design.css` tokens into `styles.css` and the Tailwind config; delete overrides superseded by tokens.
- Apply hero, tile and stagger patterns to the remaining screens (Plan, Entry detail, Settings, games).
- E2E coverage for splash skip and save celebration on all three Playwright projects.
