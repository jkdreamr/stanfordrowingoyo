# Design v2: "Drive"

Rowing has two phases: the **catch**, a quick and precise entry, and the **drive**, a powerful release that settles.
Every interaction follows that rhythm: a firm, immediate response to touch, then a weighted spring settle.
The app should feel like a well-made instrument: clean, exact and confident, with motion only where it means
something. The visual system follows Robinhood's clean light and dark modes, adapted to our brand: pure white
or pure black, content directly on the background, big tabular figures, hairlines instead of boxes, and one
accent (cardinal).

This is implemented as a token layer in `web/src/design.css` (loaded after `styles.css`) plus a few reusable
components, so open feature branches and secondary screens pick it up without markup churn.

## Principles

1. **Catch, then drive.** Presses compress instantly; releases settle on a spring. Nothing linear or floaty.
2. **One hero per screen.** Each tab gets one rich focal surface (Week Hero, podium, profile hero). Everything else is quiet.
3. **Numbers are the reward.** Hero figures count up; progress fills from where it was. No decorative numbers.
4. **Cardinal is identity, orange is victory.** Cardinal for brand, controls and progress. Strava orange only for PRs, streaks and target hits.
5. **Clean and mostly cardless.** Sections sit on the background separated by 32px of air; lists are rows with inset hairlines and no row backgrounds. Elevation only for things that float or sit on a track, plus the one hero (see Elevation). The theme switch's knob is the only glass. No glows, zero-offset halos or idle pulsing; grain only as the week card's barely-there material.
6. **Quiet copy.** Title Case, short labels. No eyebrows, monospace micro labels, kbd chips or arrow glyphs.
7. **Motion is optional.** Every animation has a `prefers-reduced-motion` variant (none, or a 120 ms fade). Transform, opacity and clip-path only.

## Tokens

### Color

| Token              | Light                                           | Dark                      |
| ------------------ | ----------------------------------------------- | ------------------------- |
| `--bg`             | `#FFFFFF` (also the light `theme-color`)        | `#000000` (dark one)      |
| `--surface`        | `#FFFFFF` (sheets, the pinned row)              | `#111111`                 |
| `--surface-2`      | `#F2F2F2` (control and track fills)             | `#1A1A1A`                 |
| `--text`           | `#111111`                                       | `#F5F5F5`                 |
| `--muted`          | `#6B6B6B` (5.3:1 on white, 4.8:1 on fills)      | `#9B9B9B`                 |
| `--divider`        | `rgb(0 0 0 / 8%)` hairline                      | `rgb(255 255 255 / 10%)`  |
| Cardinal           | `#8C1515`                                       | `#C0352B` / ink `#F18B83` |
| `--cardinal-top`   | `#9C1C18` (hero tone, top)                      | `#8F1A16`                 |
| `--cardinal-deep`  | `#6B0F0F` (hero tone, floor)                    | `#4F0B0B`                 |
| Highlight (orange) | `#FC5200`, PR/streak only                       | `#FC5200`                 |
| Medal metals       | gold, silver, bronze on podium rank badges only |                           |

The hero is a single-hue tonal shift within cardinal, never a hue-to-hue gradient.

### Elevation

Flat by default. One light from above; shadows fall straight down (contact plus ambient), never zero-offset.

| Token             | Use                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------- |
| `--elev-0/1`      | `none`: content, lists, inputs and tracks are flat (inputs keep a 3:1 border)          |
| `--elev-2`        | Raised: the pinned You row, the glass knob; `--elev-2-sm` for the segment thumb        |
| `--elev-3`        | Floating: sheets, toasts, the update banner, the save card                             |
| `-press`          | The same object pushed one step toward the surface                                     |
| `--elev-cardinal` | The week card and the Log button only: a faint cardinal-tinted downward shadow (light) |

Dark mode: surface steps (`#000` → `#111` → `#1A1A1A`) and a 10% white hairline; only floating things add a
deep black ambient; nothing is tinted. Presses scale (90 ms in, spring release) and drop the shadow one step;
reduced motion keeps the shadow change instant and drops the scale.

**Grain.** Only the week card carries a static, barely-there grain (one committed 128px 4-bit noise tile,
`soft-light` at 4%, never animated) as a premium-card material. No grain on backgrounds or other surfaces; it
is off under `forced-colors` and `prefers-contrast: more`.

**Flat first, hairline panels for modules.** Leaderboard rows, Me stats and lists, Settings, the Log form and
generic list groups are fully flat. Home's modules (race, challenges, today's plan, sessions, announcements)
sit in hairline panels: 1px `rgb(0 0 0 / 9%)` (dark `rgb(255 255 255 / 11%)`), 12px radius, page-colored, no
shadow. Feed posts are flat and divided by full-width hairlines. Numbers are tabular everywhere; large figures
alone get tight tracking (−0.03em on the hero numeral), and the week card's figure is the largest on Home.

### Shape and Space

Small radii: controls 10px, panels 12px, the week card 16px, sheets 20px; pills only for chips and segmented
controls. 4pt grid, 20px side gutters
on phones, 32px between sections, rows overhang the text column by 12px so their press highlight has room.

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
static mark with a 120 ms fade (no handoff).

## Motion Thesis

- **Focal moment.** Launch into Home's Week Hero: the cardinal splash contracts into the hero card, and as
  the card is revealed its E-meter total counts up, the ring sweeps from empty and the day columns rise
  left to right. Elsewhere the splash lifts as a curtain and the first screen rises once.
- **Continuity.** Tab changes use View Transitions: the old screen fades out in 90 ms and the new one arrives
  from the direction of the chosen tab (16 px, 260 ms). Leaderboard rows glide to their new rank (FLIP) when
  the metric or week changes. Large titles
  fold away on scroll (scroll-driven animation) while the compact title fades into the header bar.
- **Feedback.** Every control compresses instantly on press and springs back on release; cards compress less
  than buttons. Kudos, double-tap and saves acknowledge with the puddle ripple.
- **Data.** Leaderboard bars and Me breakdown bars fill from their start; weekly columns rise from the
  baseline (most recent weeks last) and the selected week keeps full ink; the season line draws left to right
  and redraws when the range changes.
- **Budget.** Figures animate once per session and again only when the value changes, so revisiting a tab is
  calm. Nothing animates while the splash covers the screen.

## Signature Interactions

1. **Launch: "First Stroke", then the painted handoff.** Full-bleed cardinal. The Gabriel mark springs in on
   the optical center (50% − 24 px) while its ring draws; three ripples spread from it like an oar's puddle;
   the OYO letters (weight 500) rise in sequence, a wake line draws under them and Stanford Rowing fades in.
   Pure inline CSS, painted before any JS. The splash holds at least 900 ms from first paint and until auth
   settles, then leaves one of three ways. Interactivity returns at the same moment on every path: `#root`
   loses `inert` and the splash ignores pointers from its first exit frame.
   - **Handoff (landing on Home).** If Home's Week Hero has rendered and sits wholly on screen, the sheet
     becomes the hero: its `clip-path` contracts from the viewport to the hero's box with the hero's 24 px
     radius (480 ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`), the mark and ripples drop back (scale 0.92, fade,
     ~200 ms), the hero's own tonal gradient settles in at exactly that box, and from 280 ms the cover fades
     (200 ms) to reveal the live card. `html.launch-handoff` holds the hero's ticker, ring and day columns
     until that reveal, so the numbers count up as the card appears; `html[data-handoff]` skips the hero's
     own rise, because it is the destination. Home's hero queries are warmed alongside the intro check so
     the hero is ready more often. `splash.ts` measures, `index.html` owns the CSS.
   - **Curtain (fallback).** Any other landing route, a hero not yet rendered or not fully visible, or a tap
     or key to skip: the sheet lifts away (380 ms) and the first screen rises in one staggered stroke.
   - **Reduced motion.** The static mark and a 120 ms fade, whatever the route.

   Transform, opacity and clip-path only. Browser chrome stays cardinal while the splash covers the page,
   then matches the page (`#FFFFFF` light, `#000000` dark).

2. **Home Week Hero.** The one bright element on Home: a tonal cardinal card with the E-meter total, a white
   progress ring and a Mon–Sun column strip (today outlined). The streak chip sits on top; the remaining E-meters (or Target Hit) chip and days left sit underneath.
3. **Number Tickers.** Hero figures (Home volume, Me season tiles, save celebration) count up on the first view
   in a session and when their value changes, inside a cell reserved for their widest value so nothing
   reflows; screen readers get the final value only.
4. **Tab Bar.** A clean solid bar (white or black) with a hairline top border; the active tab is the accent and
   its icon settles from a small catch; the centered cardinal Log disc compresses on press. Five equal columns
   keep Log pixel-centered.
5. **Directional Tab Changes.** Fade-through View Transition in the direction of travel; chrome stays put.
6. **Kudos Burst.** Thumb pops with an 8-spark ring and the count rolls up; double-tap shows the heart plus two
   water ripples at the touch point.
7. **Session Saved Moment.** After saving, a cardinal card springs in over Home with a drawn check, ripples, the
   E-meters ticking up and the weekly bar filling from the old to the new percent; auto-dismisses in ~1.9 s,
   tap or Escape closes it. It is a visual moment only (`aria-hidden`): the "Session saved" toast announces
   the save and the Home celebration card announces any achievement, so each is heard once. That card's
   five-second timer and its pop wait until the overlay lifts.
8. **Podium Rise.** Bronze, silver, then gold rise into place. Cards sit on their solid medal fill (or the
   cardinal "You" selection) with a medal hairline on top; rank badges are polished metal over a solid
   mid-tone. Every podium text holds at least 4.5:1 in light and dark, badges included at their darkest stop.
9. **Me Profile.** Ringed avatar, three stat tiles (Season Meters, Week Streak, Top Week) that tick up, weekly
   columns and the season line drawing in; the line ends in a 7 px accent dot with a 2 px page-color ring at
   today, fading in as the draw reaches it (static under reduced motion).
10. **Glass Theme Switch (Settings › Appearance).** A Match System toggle plus a Dark Mode switch. The switch is
    a native `role="switch"` button (76 × 44 target): a recessed 76 × 40 track (radius 13) with the sun and moon
    printed on its floor at 35%, and a 32 px glass knob (radius 9, `backdrop-filter: blur(3px) saturate(140%)`,
    top highlight, neutral drop shadows) that rides over them like a lens. Light on the left, dark on the right.
    Press scales the knob to 0.96 (100 ms); it travels 36 px in 260 ms on `cubic-bezier(.32,.72,0,1)` with no
    overshoot; the outgoing icon leaves in 120 ms and the incoming one arrives from 100 to 240 ms; a 12 × 2 px
    indicator moves from the knob's top edge (light, cardinal) to its bottom edge (dark, `#F08A93`) from 40 to
    300 ms. The page crossfades colors for 200 ms under `html.theme-anim`. Drag uses pointer capture, a 0.22
    rubber band past the ends, and projects 150 ms of velocity on release; under 4 px is a tap. ArrowLeft is
    light, ArrowRight is dark. With Match System on, the switch mirrors the device and is disabled. Reduced
    motion: instant knob and a 120 ms fade; reduced transparency: a solid knob; forced colors: system colors.
    Original code, with proportions and timing informed by Zsolt Kacso's Glass Light Toggle (measurements only;
    none of its WebGL, bloom, grain or spring).
11. **Rank Reorder (Leaderboard).** On a metric or week switch, rows that stay on the board slide from their
    old place to their new one (FLIP, transform only, 420 ms drive curve); reduced motion places them instantly.
12. **Pinned You Row (Leaderboard).** Shown only while your real row is off screen and the podium is out of its
    strip; rises 8 px and fades in over 200 ms, leaves in 140 ms.

## Rollout After Approval

- Fold `design.css` tokens into `styles.css` and the Tailwind config; delete overrides superseded by tokens.
- Apply hero, tile and stagger patterns to the remaining screens (Plan, Entry detail, Settings, games).
- E2E coverage for splash skip and save celebration on all three Playwright projects.
