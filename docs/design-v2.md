# Design v2 — "Drive"

Rowing has two phases: the **catch** (a quick, precise entry) and the **drive** (a powerful, smooth release).
Every interaction follows that rhythm: a fast, firm response to the touch, then a springy, weighted settle.
The app should feel like a well-made instrument: calm and confident, with motion only where it means something.

## Principles

1. **Catch, then drive.** Presses respond within 90 ms (scale 0.97, darken). Releases settle on a spring. Nothing is linear or floaty.
2. **One hero per screen.** Each tab gets one rich, tactile focal surface (cardinal ember card, podium, profile hero). Everything else is quiet neutral cards.
3. **Numbers are the reward.** Big tabular figures count up (ticker); progress fills; no decorative numbers.
4. **Cardinal is identity, orange is victory.** Cardinal for brand/controls/progress. Strava orange only appears when you earned it: PR, streak, target hit.
5. **Depth with restraint.** Frosted glass only on the chrome (tab bar, compact header). Soft neutral layered shadows in light, hairline + surface steps in dark. No grain, no colored glows, no idle pulsing.
6. **Quiet copy.** Title Case, short labels, no eyebrows, no monospace micro labels, no arrow glyphs in buttons.
7. **Motion is optional.** Every animation has a prefers-reduced-motion variant (instant or a 120 ms opacity fade). No layout properties animated: transform/opacity only.

## Tokens

### Color (light / dark)

| Token                                                                                                                                                                                                             | Light                                                             | Dark                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------- |
| --bg (page)                                                                                                                                                                                                       | #F6F5F3 (warm paper)                                              | #0E0D0E                    |
| --surface (card)                                                                                                                                                                                                  | #FFFFFF                                                           | #18171A                    |
| --surface-2 (inset/controls)                                                                                                                                                                                      | #EFEDEA                                                           | #232126                    |
| --surface-3 (raised in dark)                                                                                                                                                                                      | #FFFFFF                                                           | #2B2930                    |
| --text                                                                                                                                                                                                            | #1D1B1A                                                           | #F4F2F1                    |
| --muted / secondary                                                                                                                                                                                               | #6E6A67                                                           | #A29E9B                    |
| --divider (hairline)                                                                                                                                                                                              | #E7E3DF                                                           | rgba(255,255,255,0.07)     |
| --accent (cardinal)                                                                                                                                                                                               | #8C1515                                                           | #C0352B                    |
| --accent-pressed                                                                                                                                                                                                  | #6F1010                                                           | #8C1515                    |
| --accent-ink (text on surface)                                                                                                                                                                                    | #8C1515                                                           | #F18B83                    |
| --accent-tint (soft card bg)                                                                                                                                                                                      | #F7ECEA                                                           | rgba(192,53,43,0.14)       |
| --ember (hero gradient)                                                                                                                                                                                           | radial(120% 90% at 20% 0%, #B3261E 0%, #8C1515 45%, #5A0C0C 100%) | same, darker floor #3E0808 |
| --highlight (orange, PR/streak only)                                                                                                                                                                              | #FC5200                                                           | #FC5200 (ink #FF7A3D)      |
| --highlight-tint                                                                                                                                                                                                  | #FFF0E8                                                           | rgba(252,82,0,0.14)        |
| zones                                                                                                                                                                                                             | unchanged sheet colors, chips only                                | unchanged                  |
| Shadows (light): `--shadow-card: 0 1px 2px rgb(29 27 26 / 4%), 0 8px 24px -12px rgb(29 27 26 / 14%)`; `--shadow-raised: 0 2px 6px rgb(29 27 26 / 6%), 0 18px 40px -16px rgb(29 27 26 / 22%)`; no colored shadows. |
| Dark: cards have no shadow, a 1px `--divider` hairline and an inner top highlight `inset 0 1px 0 rgb(255 255 255 / 4%)`.                                                                                          |

### Shape

Cards 20px, list groups 20px, controls/buttons 14px (pill for primary CTAs on hero), sheets 28px top, chips 999px. Spacing 4-pt grid; screen gutter 16px (20px >= 390px wide); card padding 20px; section gap 16px.

### Type

System sans (SF Pro / Roboto / Inter) for all UI and data. Display serif **Source Serif 4** (OFL, self-hosted Latin subset, weight 600, `font-display: swap`) only for page large titles, the splash wordmark and hero headlines — editorial, Stanford-aligned (Stanford identity uses Source Serif).

| Role                | Size/Line | Weight            | Tracking              |
| ------------------- | --------- | ----------------- | --------------------- |
| Display numeral     | 56/56     | 600 sans, tabular | -0.035em              |
| Large title (serif) | 34/40     | 600               | -0.01em               |
| Title 1             | 28/34     | 600               | -0.02em               |
| Title 2             | 22/28     | 600               | -0.015em              |
| Title 3             | 20/25     | 600               | -0.01em               |
| Headline            | 17/22     | 600               | -0.005em              |
| Body                | 17/22     | 400               | 0                     |
| Callout             | 16/21     | 400               | 0                     |
| Subhead             | 15/20     | 500               | 0                     |
| Footnote            | 13/18     | 400               | 0                     |
| Caption             | 12/16     | 500               | 0 (min 11px anywhere) |

### Motion

CSS-first, zero runtime dependency: springs are encoded with CSS `linear()` easing (Chrome 113+, Safari 17.2+, Firefox 112+) with a cubic-bezier fallback; screen changes use the View Transitions API where supported; one-shot bursts use the Web Animations API. No animation library added (framer-motion/motion would cost ~15–35 kB gzip for effects we can get from the platform).

| Token                                                                                                                                                            | Value                                                             | Use                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------- |
| --ease-catch                                                                                                                                                     | cubic-bezier(0.3, 0, 0.8, 0.15) / 90 ms                           | press-in                                          |
| --spring-snappy                                                                                                                                                  | linear() spring, stiffness 420 damping 30, ~380 ms, ~3% overshoot | press release, toggles, tab indicator, chips      |
| --spring-smooth                                                                                                                                                  | linear() critically damped, ~520 ms                               | sheets, cards entering, header collapse           |
| --spring-bouncy                                                                                                                                                  | linear() stiffness 260 damping 14, ~760 ms, ~10% overshoot        | celebrations, kudos icon, podium rise, check draw |
| --ease-out-expo                                                                                                                                                  | cubic-bezier(0.16, 1, 0.3, 1)                                     | number tickers (700 ms), ring fill (900 ms)       |
| --ease-exit                                                                                                                                                      | cubic-bezier(0.4, 0, 1, 1) / 180 ms                               | exits, dismissals                                 |
| --stagger                                                                                                                                                        | 45 ms per item, capped at 8 items                                 | list/card entrance                                |
| Reduced motion: all keyframes `animation: none`, transitions <= 120 ms opacity only, tickers jump to final value, View Transitions skipped, bursts not rendered. |

## Signature interactions

1. **Launch: "First Stroke" splash** — Full-bleed cardinal ember. A minimal eight (shell silhouette + 8 oars) glides in; the oars take two synchronized strokes (catch → drive) while a wake of fine white lines draws behind it; the serif "OYO" wordmark rises out of the wake; the cardinal sheet lifts away on a spring revealing the app, whose cards stagger in. <= 1.3 s, tap anywhere to skip, reduced-motion = static mark + 120 ms fade. Pure CSS/SVG inline in index.html (0 kB JS). _Refs: the inspiration video's vivid full-bleed hero with drifting objects; Apple Fitness+ launch; Opal and Ladder onboarding heroes; Strava's quick logo-to-feed handoff._
2. **Home Week Hero** — Cardinal ember card with a large progress ring (gradient stroke, glowing tip dot), the percent counting up, and a Mon–Sun day strip that fills days you logged (today has a static outline). Hitting target turns the ring orange with a one-time shimmer. _Refs: inspiration "Current Streak" card + week-day strip; Apple Fitness rings; Whoop strain dial; Gentler Streak week view._
3. **Number tickers** — Every hero figure (week %, E-meters, season totals, leaderboard main figure) counts up with expo-out on first view and on change. _Refs: Robinhood portfolio value; Revolut balance; Cash App amount._
4. **Glass tab bar with sliding pill** — Frosted bar (blur 20, saturate 180%) with a soft pill indicator that springs between tabs; the selected icon does a small catch-bounce; centered cardinal Log disc that compresses on press. Pixel-centered (5 equal columns). _Refs: iOS 26 Liquid Glass tab bars; Arc Search; Airbnb tab bar._
5. **Staggered entrance + tactile press** — Cards and rows rise 12 px and fade in with --spring-smooth, 45 ms stagger; all tappable cards/buttons scale to 0.97 on press and spring back. _Refs: Linear mobile lists; Airbnb Explore; Things 3._
6. **Kudos burst** — Tapping Kudos pops the thumb on --spring-bouncy, emits 8 cardinal particles in a ring and the count rolls to the next digit (vertical slide). Double-tap on a card shows the large heart plus the same particle ring. _Refs: X/Twitter like burst; Instagram double-tap; Strava kudos._
7. **Log "Session Logged" moment** — On save the Save button compresses into a circle and a check draws; a centered moment card shows the E-meters ticker and the week ring advancing from old to new value, auto-dismissing in ~1.6 s (tap to dismiss) as Home settles behind it. Orange confetti only for PR/target hit/streak. _Refs: Cash App / Apple Pay success check; Duolingo lesson complete; Strava upload complete._
8. **Podium rise** — Pedestals rise bronze → silver → gold on --spring-bouncy (80 ms apart), avatars drop in, gold gets a single light sheen sweep; rows below stagger in and their progress bars fill. Metric switches crossfade. _Refs: Duolingo leagues; Ladder leaderboard; Apple Game Center._
9. **Me profile hero** — Large avatar over a soft cardinal gradient band, name in serif, three stat tiles that tick up, season chart line draws on. Scroll-linked header: the serif large title collapses into a compact glass bar. _Refs: Oura and Whoop profile; Strava athlete profile; iOS large-title collapse._
10. **Directional tab transitions** — Switching tabs slides content 16 px in the travel direction with a crossfade (View Transitions). _Refs: iOS tab push; Linear mobile._

## Progress

- [x] Foundation: tokens, springs, fonts, press/entrance utilities, glass tab bar (`web/src/design/`)
- [x] Launch splash (index.html)
- [x] Home
- [x] Feed + kudos
- [ ] Log + Session Logged moment
- [ ] Leaderboard podium
- [ ] Me
- [ ] Screenshots, recordings, bundle + perf check
