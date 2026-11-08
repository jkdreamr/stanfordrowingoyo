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
5. **Depth with restraint.** Frosted glass only on chrome (tab bar). Soft warm shadows in light; hairlines and surface steps in dark. No idle pulsing.
6. **Quiet copy.** Title Case, short labels. No eyebrows, monospace micro labels, kbd chips or arrow glyphs.
7. **Motion is optional.** Every animation has a `prefers-reduced-motion` variant (none, or a 120 ms fade). Transform and opacity only.

## Tokens

### Color

| Token              | Light                                                     | Dark                      |
| ------------------ | --------------------------------------------------------- | ------------------------- |
| `--bg`             | `#F5F3F0` warm paper                                      | `#0D0C0C`                 |
| `--surface`        | `#FFFFFF`                                                 | `#171515`                 |
| `--surface-2`      | `#EFECE8`                                                 | `#242120`                 |
| `--text`           | `#1C1A19`                                                 | `#F5F2EF`                 |
| `--muted`          | `#6B6662`                                                 | `#A8A19C`                 |
| `--divider`        | `#E6E1DC`                                                 | `#2C2827`                 |
| Cardinal           | `#8C1515`                                                 | `#8C1515` / ink `#F18B83` |
| `--cardinal-deep`  | `#5C0A0A` (hero floor)                                    | same                      |
| `--cardinal-glow`  | `#C0392B` (hero light)                                    | same                      |
| Highlight (orange) | `#FC5200`, PR/streak only                                 | `#FC5200`                 |
| `--glass`          | `rgb(250 248 246 / 76%)`                                  | `rgb(20 18 18 / 74%)`     |
| Medal metals       | gold, silver, bronze gradients on podium rank badges only |

Shadows: `--shadow-card` (2-layer warm neutral), `--shadow-float` (sheets, overlays), `--shadow-cardinal`
(hero and Log button only). Dark mode swaps shadows for a 1px white 5–7% hairline.

### Shape and Space

Cards 20px, controls 14px, hero surfaces 28px, chips full pill. 4pt grid, 16px gutter, 20px card padding.

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

CSS-first with zero runtime dependency. Springs are CSS `linear()` curves (Safari 17.2+, Chrome 113+) with
`cubic-bezier` fallbacks; the only JS animation is `Ticker`, a ~40-line `requestAnimationFrame` count-up.
An animation library (Motion/Framer ~30 kB gzip) was rejected: the platform covers every effect here.

| Token              | Value                             | Use                                   |
| ------------------ | --------------------------------- | ------------------------------------- |
| `--ease-drive`     | `cubic-bezier(0.22, 1, 0.36, 1)`  | rises, fills, tickers (expo-out feel) |
| `--ease-recover`   | `cubic-bezier(0.65, 0, 0.35, 1)`  | splash curtain lift, exits            |
| `--spring-drive`   | `linear()` spring, ~4% overshoot  | tab icon, press release, podium       |
| `--spring-pop`     | `linear()` spring, ~12% overshoot | kudos, save check, celebrations       |
| `--motion-rise`    | 520 ms                            | card entrance                         |
| `--motion-drive`   | 570 ms                            | hero and podium                       |
| `--motion-pop`     | 600 ms                            | bursts                                |
| `--motion-stagger` | 45 ms per item, capped            | list and card entrance                |
| Ticker             | 900 ms quartic out                | hero figures                          |

Reduced motion: keyframes off, tickers jump to final values, bursts and ripples not rendered, splash is a
static mark with a 120 ms fade.

## Signature Interactions

1. **Launch: "First Stroke".** Full-bleed cardinal with depth gradients. The Gabriel mark springs in while its
   ring draws; three ripples spread from it like an oar's puddle; the OYO letters rise in sequence, a wake line
   draws under them and Stanford Rowing fades in; then the sheet lifts away like a curtain to reveal Home.
   ~1.3 s total, tap or any key skips, pure inline CSS (0 kB JS).
   _Refs: inspiration video's full-bleed hero; Opal and Ladder onboarding; Strava's fast logo-to-feed handoff._
2. **Home Week Hero.** Cardinal hero with the E-meter total ticking up, a glossy progress ring, ripple motif
   and a Mon–Sun bar strip that fills logged days (today outlined). Streak and To Go chips sit underneath.
   _Refs: inspiration "Current Streak" card and week strip; Apple Fitness rings; Gentler Streak week view; Whoop strain card._
3. **Number Tickers.** Hero figures (Home volume, Me season tiles, save celebration) count up on view.
   _Refs: Robinhood portfolio value; Revolut balance; Cash App amount._
4. **Glass Tab Bar.** Frosted, saturated bar; selected icon pops on a spring; centered cardinal Log disc with
   glow that compresses on press. Five equal columns keep Log pixel-centered (measured 0 px offset).
   _Refs: iOS Liquid Glass tab bars; Arc Search; Airbnb._
5. **Staggered Rise.** Screen sections rise 12 px and fade in, 45 ms apart, on every tab change.
   _Refs: Airbnb Explore; Apple Fitness summary; Linear mobile._
6. **Kudos Burst.** Thumb pops on a spring with an 8-spark ring and the count rolls up; double-tap shows the
   heart plus two water ripples at the touch point.
   _Refs: X like burst; Instagram double-tap; Strava kudos._
7. **Session Saved Moment.** After saving, a cardinal card springs in over Home with a check, ripples, the
   E-meters ticking up and the weekly bar filling from the old to the new percent; auto-dismisses in ~1.9 s,
   tap or Escape closes it.
   _Refs: Cash App and Apple Pay success; Duolingo lesson complete; Strava upload complete._
8. **Podium Rise.** Pedestals rise in rank order on a spring, with metal rank badges and medal-tinted cards.
   _Refs: Duolingo leagues; Ladder leaderboard; Apple Game Center._
9. **Me Profile Hero.** Soft cardinal wash behind a ringed avatar, then three stat tiles (Season Meters,
   Week Streak, Top Week) that tick up.
   _Refs: Oura and Whoop profile; Strava athlete profile._

## Rollout After Approval

- Fold `design.css` tokens into `styles.css` and the Tailwind config; delete overrides superseded by tokens.
- Apply hero, tile and stagger patterns to the remaining screens (Plan, Entry detail, Settings, games).
- View Transitions for directional tab changes; scroll-linked large-title collapse.
- E2E coverage for splash skip and save celebration on all three Playwright projects.
