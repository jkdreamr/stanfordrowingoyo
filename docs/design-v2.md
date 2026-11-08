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
5. **Depth with restraint.** Cards on a white or black page, defined by a hairline and soft neutral depth. Controls share one glass material (below); the tab bar is frosted. Hairlines and surface steps in dark. No glows or idle pulsing; the only tinted shadows sit under solid cardinal objects in light mode, and the only grain is the week card's barely-there material.
6. **Quiet copy.** Title Case, short labels. No eyebrows, monospace micro labels, kbd chips or arrow glyphs.
7. **Motion is optional.** Every animation has a `prefers-reduced-motion` variant (none, or a 120 ms fade). Transform, opacity and clip-path only.

## Tokens

### Color

| Token              | Light                                                     | Dark                         |
| ------------------ | --------------------------------------------------------- | ---------------------------- |
| `--bg`             | `#FFFFFF` (also the light `theme-color`)                  | `#000000` (dark one)         |
| `--surface`        | `#FFFFFF` cards, with an 8% black hairline and soft depth | `#121214`, 8% white hairline |
| `--surface-2`      | `#F2F2F4` recessed fills (tracks, inputs)                 | `#1D1D20`                    |
| `--text`           | `#1C1C1F`                                                 | `#F4F4F6`                    |
| `--muted`          | `#66666E` (5.7:1 on white, 5.1:1 on fills)                | `#A1A1AA`                    |
| `--divider`        | `#E6E6EA`                                                 | `#26262A`                    |
| Cardinal           | `#8C1515`                                                 | `#C0352B` / ink `#F18B83`    |
| `--cardinal-top`   | `#9C1C18` (hero tone, top)                                | `#8F1A16`                    |
| `--cardinal-deep`  | `#6B0F0F` (hero tone, floor)                              | `#4F0B0B`                    |
| Highlight (orange) | `#FC5200`, PR/streak only                                 | `#FC5200`                    |
| Medal metals       | gold, silver, bronze gradients on podium rank badges only |                              |

The hero is a single-hue tonal shift within cardinal, never a hue-to-hue gradient. Shadows are neutral
(`rgb(20 20 28 / x)`): `--shadow-card` (2-layer), `--shadow-float` (sheets, overlays) and `--shadow-hero`.
In light mode, solid cardinal objects (the week card, the Log disc, primary buttons, the save card) cast a
cardinal-tinted ambient with a deep-cardinal contact instead (`--shadow-cardinal*`). Dark mode swaps shadows
for hairlines, surface steps and a faint top highlight. The week card alone carries a static, barely-there
grain (one committed 128px tile, `soft-light` at 4%, off under forced colors and increased contrast).

### Glass Controls

One material for every control, defined once in `design.css`: `--glass-fill` (a translucent white, or white
16–7% in dark), `--glass-rim` (top-left lit 1px inset), `--glass-shade` (bottom inner shade), `--glass-edge`
(a 0.5px inset hairline) and `--glass-drop` (soft neutral drop), composed as `--glass-shadow` and
`--glass-shadow-press`. Blur (`--glass-blur`, 6px, saturate 140%) runs only where something passes beneath:
switch knobs and the frosted tab bar; everything else uses the static look.

- **Switches:** every switch is `GlassSwitch` (the Dark Mode switch's component): a recessed track, a glass
  knob, overshoot-free travel, drag with a rubber band, arrow keys. Toggles fill the track with cardinal when on.
- **Segmented controls:** a glass thumb sliding over a recessed track.
- **Clear glass:** secondary buttons, header and sheet icon buttons, the hero chips.
- **Tinted glass:** primary buttons, destructive buttons and the Log disc keep a solid base (white labels hold
  4.5:1; dark destructive steps to `#C62828`) under the rim and shade.
- **Tab pill:** glass over the frosted bar.
- Presses scale and drop the shadow a step; disabled controls fade to 45% with no shine. Reduced transparency
  gives solid surfaces, forced colors system colors, reduced motion instant changes.

### Layout

Cards everywhere except where flat reads better: on the Leaderboard the Stanford vs Berkeley race sits on the
page; on Me the profile, the season figures (a typographic row divided by hairlines), the edge-to-edge chart
and the lists are flat, with only Erg Tests and Weekly Volume in panels. Numbers use tabular figures app-wide.

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
static mark with a 120 ms fade (no handoff).

## Motion Thesis

- **Focal moment.** Launch into Home's Week Hero: the cardinal splash contracts into the hero card, and as
  the card is revealed its E-meter total counts up, the ring sweeps from empty and the day columns rise
  left to right. Elsewhere the splash lifts as a curtain and the first screen rises once.
- **Continuity.** Tab changes use View Transitions: the old screen fades out in 90 ms and the new one arrives
  from the direction of the chosen tab (16 px, 260 ms). The selection pill springs between tabs. Large titles
  fold away on scroll (scroll-driven animation) while the compact title fades into the frosted bar.
- **Feedback.** Every control compresses instantly on press and springs back on release; cards compress less
  than buttons. Kudos, double-tap and saves acknowledge with the puddle ripple.
- **Data.** Leaderboard bars and Me breakdown bars fill from their start; weekly columns rise from the
  baseline (most recent weeks last) and the selected week keeps full ink; the season line draws left to right
  once and morphs between shapes when the range changes.
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
4. **Glass Tab Bar.** Frosted bar with one selection pill that travels between tabs on the spring; the selected
   icon settles from a small catch; the centered cardinal Log disc compresses on press. Five equal columns keep
   Log pixel-centered.
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
   columns and the season chart. The season chart sits edge to edge on the page (no card): one large tabular
   figure (today's total), an accent delta line (`+12.4k this week`) and a muted pace line (`Behind pace by
3.1k`) above a monotone-cubic accent line (2.25 px, round caps) that never dips, with a single-hue fill
   fading from 22% (28% dark, a touch deeper when ahead of pace) to 0 at the baseline. Text and controls keep
   the page gutter; the plot bleeds to the left edge and ends at the right gutter in an 8 px accent dot with a
   2 px page-color ring. Entrance, once per mount: the line draws left to right (900 ms), the fill fades up
   behind it and the dot pops (opacity, scale 0.6 to 1, `--ease-out`) as the draw arrives. Hold-and-drag (or
   Left/Right) scrubs: a hairline and ringed dot follow the finger along the curve with no lag (rAF, `translate`
   only, no React render per move), the line after the cursor steps back to 35% through a clip on a duplicate
   path, the figure and delta show that day and the date rides above the cursor; Android gets a 5 ms buzz per
   week boundary (not under reduced motion). On release the figure counts back to today in 420 ms. The range
   pills sit below the chart with one selection pill that travels on `--spring`; changing range morphs the line,
   fill, pace line and dot from the old shape to the new one (both resampled to 160 points, 420 ms,
   `--ease-out`). Reduced motion: no draw, pop or morph; ranges swap instantly behind a 120 ms fade.
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
11. **Pinned You Row (Leaderboard).** Shown only while your real row is off screen and the podium is out of its
    strip; rises 8 px and fades in over 200 ms, leaves in 140 ms.

## Rollout After Approval

- Fold `design.css` tokens into `styles.css` and the Tailwind config; delete overrides superseded by tokens.
- Apply hero, tile and stagger patterns to the remaining screens (Plan, Entry detail, Settings, games).
- E2E coverage for splash skip and save celebration on all three Playwright projects.

## Ambient Water

The one sanctioned ambient loop is a low-resolution procedural canvas: 128 pixels wide, with
height derived from the viewport aspect ratio, independent of devicePixelRatio. Normal CSS
stretching supplies the softness without blur filters. A procedurally seeded, periodic 8×8
cell field forms soft sunlight rims, irregular cells, and brighter three-way junctions. The
256×256 field caches palette values in memory, not downloaded textures. A 4096-entry sine
lookup drives two evolving wave shears and a slower rolling swell. One reused ImageData pass
copies packed colors and scales alpha; there are no per-frame image-buffer allocations.
Rims span roughly four canvas pixels before upscaling. At 393px viewport width, base drift is
30.7px/s horizontally and 12.3px/s vertically (33.1px/s diagonally). Wave shears morph the
network on 7.4–9.7 second periods, rather than moving an unchanged pattern. No raster
downloads, WebGL, SVG filters, blending, or oar layer remain.
The fixed negative stacking layer paints above the body background but below content. The
route wrappers are transparent; page navigation, cards, and the Home gradient hero remain
opaque. The layer fades in after `afterLaunch`, preserving the launch sheet and hero handoff.

Tune or disable `ambientWaterConfig` in `AmbientWater.tsx`: `enabled: false` renders nothing;
nonfinite intensity becomes zero and finite intensity is clamped to 0–1. Light mode shades
cells with pale cool aqua (`rgb(115,175,201)`), leaving sunlight rims nearly transparent.
Dark cells are transparent; rims glow cardinal/rose (`#8C1515`–`#C0352B`), with dawn amber
restricted to junctions. A MutationObserver follows the root `.dark` class. Alpha is clamped
to 70/255 (27.45%) in light. Dark rim alpha is at most 128/255 (50.20%), falling towards
90/255 at amber knots so the warm color never becomes a brown fill. Swell and configured
intensity only decrease alpha.

Contrast is bounded independently of wave position using source-over
`C = alpha * source + (1 - alpha) * background` and WCAG sRGB linearization.
Light's minimum channels are `rgb(216.57,233.04,240.18)`; conservatively rounding down to
`rgb(216,233,240)` gives luminance 0.791680. In dark, the palette correlates source color
with alpha, so evaluate all 65,536 quantized palette entries, not independent channel maxima.
The maximum luminance after composition is 0.035908. Adding one sRGB level per channel for
display rounding gives a conservative maximum of 0.037135 (at approximately
`rgb(84.08,43.32,25.85)`). Bilinear interpolation cannot exceed this maximum: the sRGB
linearization function is convex, so luminance of interpolated colors is no greater than
their weighted luminances. Swell, intensity, and entrance fade only move dark pixels towards
black and light pixels towards white. Using `(Llighter + .05)/(Ldarker + .05)`:
light `--text: #1c1c1f` / `--muted: #66666e` retain **13.63:1 / 4.56:1**;
dark `--text: #f4f4f6` / `--muted: #a1a1aa` retain **10.97:1 / 4.70:1**.
Opaque cards are unchanged. Recalculate before changing palettes or alpha caps; text must
retain at least 7:1 and muted text at least 4.5:1.

requestAnimationFrame is throttled to approximately 30 fps. Each frame exposes `data-frame`
and `data-render-ms` on the canvas for lifecycle tests and throttled performance sampling;
the timing wraps the pixel pass, putImageData, and frame counter update. Unlike the former
compositor-only textures, canvas intentionally updates pixels on the main thread. Measure
both renderer cost and whole-page paint/layout rather than claiming compositor-only work.
Hidden documents cancel RAF and stop the simulation clock; visibility restoration resumes it.
Reduced motion renders a static frame without scheduling RAF or an entrance transition.
Forced colors, increased contrast, and reduced transparency stop rendering and hide the layer;
all four media queries are observed for changes. Unmount cancels launch/RAF callbacks and
removes visibility/resize/media listeners and the theme observer.
