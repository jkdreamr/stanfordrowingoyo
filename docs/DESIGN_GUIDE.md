# Stanford Rowing OYO: Design Guide

Implementation guidance for the phone PWA and desktop app. This is a pattern specification, not a set of finished screens. [ARCHITECTURE.md](ARCHITECTURE.md), especially §§2, 4, 6 and 7, remains the product/API authority. No product contract, app source, dependency or theme token is changed by this document.

Research and captures: November 6, 2026. Reference images are in [design-refs](design-refs/); [view the contact sheet](design-refs/contact-sheet.webp). The source review and image credits at the end distinguish observed references from OYO design decisions.

## 1. Direction and Non-Negotiables

**Product:** help a Stanford rower log a session quickly, understand its E-meters, and see the team's week. **Character:** athletic, exact, companionable. **World:** everyday training, not a sports marketing campaign. **Rich moments:** real teammate photographs and the weekly progress ring. **Signature:** one quiet finish-line tick when a confirmed workout takes the athlete across their weekly target.

The screen should be understandable before its animation is noticed. Familiar controls are a feature. Prefer one useful number and one clear next action to a dashboard of decorative metrics.

- Cardinal `#8C1515` is the main accent; pressed `#6F1010`. Dark fill `#C0352B`. Use for actions, selection and progress, not every heading.
- Orange `#FC5200` is reserved for PRs, streaks, best week and target-hit moments. It is **not** the default kudos, navigation, chart-series or success-toast color.
- No gradients, glows, floating-card hover lifts, emoji labels, monospace micro labels, tracked-uppercase eyebrows, arrow glyphs in buttons, or autoplay carousels.
- System sans stack already in the repo; do not download a display font. Title Case controls, sentence case descriptive copy, normal letter spacing. Text never below 12px; inputs 16px to avoid iOS focus zoom.
- Every action has a minimum **44 × 44 CSS px** hit area. Prefer 48px for primary form buttons. Visible icon may be 20–24px. Do not shrink targets on desktop.
- Use native HTML before new dependencies. Use established accessible primitives for modal focus, menus and complex gestures. Do not build a focus trap from scratch.
- Keep actual distance and E-meters distinct. `60,000 m Bike · Zone E` converts to `20,000 E-meters`; it is not a 20km bike ride. Use shared math and the entry's saved factors, never UI-specific multipliers.
- Every workout is team-visible; profiles, feed and leaderboard totals include the same workouts.

### Foundations

| Role                 | Recipe                                                                                                                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page                 | `bg-bg text-text`; light `#F7F7FA`, dark `#121214`                                                                                                                                                                               |
| Surface              | `bg-surface`; light white, dark `#1C1C1F`                                                                                                                                                                                        |
| Secondary text       | `text-muted`; light `#6D6D78`, dark `#A3A3AF`                                                                                                                                                                                    |
| Decorative separator | `border-divider`; light `#DFDFE8`, dark `#2C2C31`                                                                                                                                                                                |
| Type                 | Large title `text-[32px] leading-[38px] font-bold`; page `text-2xl leading-8 font-semibold`; section `text-xl leading-7 font-semibold`; body `text-base leading-6`; supporting `text-sm leading-5`; metadata `text-xs leading-4` |
| Numbers              | `tabular-nums`; localized whole meters (`20,000 m`) or consistently rounded summary (`20.0k`). Accessible text expands abbreviations. No rolling odometer.                                                                       |
| Spacing              | 4, 8, 12, 16, 20, 24, 32px. Page gutter 16px on phone, 24px on tablet/desktop. Section gap 24–32px.                                                                                                                              |
| Shape                | 8px buttons/fields; 12px cards; 20px top corners on sheets. Full pills only for segmented tracks, short tags and circular controls.                                                                                              |
| Elevation            | Ordinary cards: border, no shadow. Dialog/menu only: `shadow-[0_8px_24px_rgb(0_0_0/0.12)]`; scrim `bg-black/40`. No frosted-glass dependency.                                                                                    |
| Layout               | Phone single column; ≥1024px sidebar; content max 720px; right rail only at ≥1280px when both columns fit. Main column must not shrink below 560px just to fit the rail.                                                         |

### Contrast and Integration Notes

These are proposed **additive semantic aliases**, not changes silently made to the existing theme. Add centrally when implementing components:

```css
:root {
  --oyo-accent-ink: #8c1515;
  --oyo-focus: #8c1515;
  --oyo-hover: #eeeef2;
  --oyo-selected: #f6e8e8;
  --oyo-control-border: #898994;
  --oyo-highlight-ink: #a83400;
  --oyo-skeleton: #e6e6ec;
}
.dark {
  --oyo-accent-ink: #ed948d;
  --oyo-focus: #ed948d;
  --oyo-hover: #26262b;
  --oyo-selected: #392123;
  --oyo-control-border: #777782;
  --oyo-highlight-ink: #fc5200;
  --oyo-skeleton: #303036;
}
```

`#C0352B` on the dark surface is approximately 3.06:1: suitable for substantial non-text state indicators, **not** small link text. Use `--oyo-accent-ink` for links/active labels; the lighter tint is still cardinal, not another accent. White on `#C0352B` is approximately 5.58:1. Orange on white is only 3.31:1: use the darker orange ink for small achievement text, or use normal text beside an orange mark. Zone chips always use near-black text, even in dark mode; their pastel colors cannot carry white text.

Existing divider colors are intentionally subtle and are not enough to identify a standalone input boundary. Use `--oyo-control-border` for fields, unfilled sliders and unchecked controls. Existing Tailwind colors are hex-valued CSS variables: **do not assume `bg-accent/10` works**. Use an explicit semantic token, e.g. `[background:var(--oyo-selected)]`, or deliberately migrate color definitions to an alpha-compatible format in a separate implementation change.

The current stylesheet adds safe-area padding to `body` and broad unlayered `a`/`button` styles. Component recipes below assume the eventual shell owns safe areas once and buttons explicitly override text color. Coordinate that shell migration rather than stacking another full set of insets onto `body`. In particular, use an **unlayered, higher-specificity** `.oyo-button-primary, .oyo-button-primary:active { color: white; }` for filled buttons/links so the global anchor/pressed rules do not make their text dark red. Another coordinated solution is moving the broad element rules into Tailwind's base layer; a component-layer rule alone will not beat an existing unlayered rule. Check these recipes against actual compiled styles rather than assuming utility order wins.

## 2. Motion System

CSS first. Do not add a physics engine for button presses. Animate only the state that changed; never delay an input or network request until an animation completes. These are **OYO defaults**, not claims that one timing fits every platform.

### Tokens

```css
:root {
  --oyo-motion-instant: 0ms;
  --oyo-motion-press: 80ms;
  --oyo-motion-fast: 120ms;
  --oyo-motion-control: 160ms;
  --oyo-motion-panel: 240ms;
  --oyo-motion-sheet: 300ms;
  --oyo-motion-progress: 600ms;
  --oyo-ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --oyo-ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --oyo-ease-in: cubic-bezier(0.4, 0, 1, 1);
  --oyo-ease-linear: cubic-bezier(0, 0, 1, 1);
}
```

| Situation                      | Duration / Curve               | Contract                                                                                       |
| ------------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------- |
| Pointer-down press             | 80ms / standard                | Acknowledge immediately; button scale 0.98 only on suitable controls.                          |
| Release, hover, selection tint | 120–160ms / out                | Return promptly; no spring on repeated typing or stepper taps.                                 |
| Menu/popover                   | 160ms in / out; 120ms out / in | Opacity + maximum 4px translate; origin at trigger edge.                                       |
| Route content                  | 160ms / standard               | Crossfade only; no app-shell movement.                                                         |
| Sheet/dialog                   | 300ms in / out; 200ms out / in | Sheet translates from its edge; desktop dialog fades with scale 0.99 to 1.                     |
| Ring after save                | 600ms / out                    | One interpolation from previous actual value to new actual value. No reset to zero on remount. |
| Target finish tick             | 160ms / out                    | One small tick reveal; whole moment ≤800ms including ring completion.                          |
| Skeleton                       | 1200ms / standard              | At most two opacity cycles, then static; no shimmer or gradient.                               |
| Refresh spinner                | 800ms / linear                 | Only while an explicit refresh is pending; static glyph with text for reduced motion.          |

Optional Motion spring presets, only if Motion is already justified:

```ts
const springs = {
  selection: { type: 'spring', stiffness: 500, damping: 40, mass: 1 },
  sheetReturn: { type: 'spring', stiffness: 400, damping: 40, mass: 1 },
  kudos: { type: 'spring', stiffness: 650, damping: 32, mass: 0.7 },
} as const;
```

`selection` is near-critically damped for a sliding segmented indicator. `sheetReturn` returns an incomplete drag without bounce. `kudos` is the only lightly lively preset; scale at most 1.08, once. These are physics values, **not millisecond durations**. Do not supply `duration` alongside them or override a gesture library's internal spring blindly. Prefer the library's default drag physics if its public API does not expose these settings. Stop previous animations and continue from the current visual state when interrupted.

### Reduced Motion and Performance

- Read `matchMedia('(prefers-reduced-motion: reduce)')` for JS motion and listen for changes. With Motion, use `MotionConfig reducedMotion="user"` **and** explicitly skip ring, SVG stroke and celebratory sequences; automatic transform handling is not a complete policy.
- Reduced motion: no scale/slide/spring, count-up, ring sweep, smooth scroll, carousel momentum effects or View Transition snapshots. Render final values immediately. A ≤80ms opacity/color acknowledgement is acceptable; toast, validation text and checkmark remain visible.
- A sheet can still follow a deliberate finger drag 1:1; release/dismiss resolves instantly rather than springing. A close button is always available. Native scrolling remains native.
- Bound animations to the specific component; do not install a global `* { animation-duration: 0.01ms }` rule that may break library completion events. Example: `.oyo-motion` may transition, but `.oyo-motion` under reduced motion gets `transition: none; animation: none` and no transform.
- Prefer opacity and transform. SVG ring stroke animation is one small isolated vector; profile it on a phone. Never transition `all`, every list row, large shadows, blur or layout height on scroll. Do not leave `will-change` on idle components.
- Pause/finish nonessential motion when the document is hidden or component is offscreen. Loading progress remains truthful; it must not imply a completed upload before the server confirms it.

## 3. Pattern Recipes

All recipes assume the foundation and motion tokens above. Each interactive component needs default, hover (fine pointer), focus-visible, pressed, disabled, pending and error states. A library reference supplies behavior, **not** permission to copy its colors, 36px controls, arrow buttons or stock copy.

### 3.1 Bottom Tab Bar and Center Log Action

**Choose:** a stable, flat five-item bar: Home, Feed, Log, Leaderboard, Me. The center is an action opening `/log`, not a fake selected tab on every page. Native-feeling consistency beats a floating dock/notched FAB that competes with workout content.

**Recipe:** `<nav aria-label="Main">` with `fixed inset-x-0 bottom-0 z-30 border-t border-divider bg-surface lg:hidden`, inner `grid grid-cols-[1fr_1fr_0.8fr_1.4fr_1fr] items-center px-1`, `height:64px`, plus `padding-bottom:env(safe-area-inset-bottom)`. At 320px the wider Leaderboard slot keeps its full 12px label visible. Each link: `flex min-h-14 min-w-0 flex-col justify-center gap-1 rounded-lg text-xs leading-4 font-medium`. 22px Lucide icon, label always shown, `aria-current="page"` on route links. Active label uses accent ink; others text-muted. Log uses a 44px cardinal rounded-square plus control and a separate visible `Log` label; accessible link name `Log Workout`.

**Do:** reserve `calc(80px + env(safe-area-inset-bottom))` of content space; test 320px, landscape, 200% text and installed PWA mode. Preserve drafts when switching tabs. Hide the bar on login/signup, and while the dedicated Log form owns the keyboard/submit footer; preserve form fields as the keyboard resizes the viewport.

**Don't:** animate the bar on scroll, hide labels, add badge noise to every tab, use a hollow Log icon too small to tap, or navigate horizontal tabs by swiping the entire page. No orange active tab.

### 3.2 Desktop Sidebar

**Choose:** quiet 232px left navigation, visible from `lg` (1024px), with the same five destinations and text. Secondary Plan, Notifications, Settings and staff-only Admin links sit below a divider; staff role does not change primary navigation.

**Recipe:** `hidden lg:flex fixed inset-y-0 left-0 z-30 w-[232px] flex-col border-r border-divider bg-surface px-3 py-6`; links `min-h-11 gap-3 rounded-lg px-3 text-sm font-medium`; active `[background:var(--oyo-selected)] [color:var(--oyo-accent-ink)]`. Main `lg:pl-[232px]`; inner `mx-auto w-full max-w-[1160px] px-6`, grid at `xl` with `minmax(0,720px) 280px` and 24px gap. Right rail `sticky top-6 self-start`. Sidebar has native `overflow-y-auto` for short windows.

**Do:** use an ordinary cardinal Log button, show current destination with text and background, and keep page heading out of the sidebar. **Don't:** introduce collapsible icon-only navigation for five links, hover-expanding rails, unrelated admin chrome, or full-height decorative branding.

### 3.3 Large-Title Header Collapse

**Choose:** the title scrolls naturally out of view while a compact title appears in a solid sticky toolbar. This has iOS continuity without scroll-jacking or React renders for every pixel.

**Recipe:** toolbar `sticky top-0 z-20 h-14 border-b border-transparent bg-bg px-4`; compact title `text-base font-semibold transition-opacity duration-[120ms]`; large h1 `px-4 pt-3 pb-6 text-[32px] leading-[38px] font-bold`. Place a 1px sentinel **after** the h1; `IntersectionObserver` with `rootMargin: '-56px 0px 0px 0px'` sets compact visibility when sentinel has crossed above toolbar (`!entry.isIntersecting && entry.boundingClientRect.top < 56`). Set border-divider simultaneously. Both titles occupy reserved space; the duplicate compact visual title is `aria-hidden`, and the actual h1 stays in the accessibility tree. Keep toolbar actions visible in both states.

**Do:** use the actual scroll root, adjust 56px if top safe area belongs to this header, and render solid header under reduced motion without fading. **Don't:** animate font size/height, stretch the h1 when overscrolling, duplicate accessible headings, pin a hero section, or hide Back when collapsing.

### 3.4 Segmented Control

**Choose:** native radio-group semantics for Erg / Bike / Run and leaderboard metric selection. Use actual tabs only when there are labelled tab panels, such as Season / Year stats. [02](design-refs/02-tabs.webp), [03](design-refs/03-segmented-control.webp).

**Recipe:** fieldset with visible legend; track `grid grid-cols-3 gap-1 rounded-xl bg-bg p-1`; each segment wraps a native `input type="radio" className="peer sr-only"` followed by its sibling `<label htmlFor={id}>`. Label classes: `flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium peer-checked:bg-surface peer-checked:text-text peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:[outline-color:var(--oyo-focus)]`. Give the radios the same `name` and unique IDs. The input must precede the label as a sibling: `peer-*` cannot style an ancestor label. Use CSS tint crossfade 120ms by default; an optional shared indicator translates between **measured equal-width** segments in 160ms. Radix Tabs can supply arrow-key behavior for real tab panels.

**Do:** preserve distance when changing modality, recalculate the E-meter preview with shared math, and show a changed preset if it no longer applies. For tab panels, focus stays on the tab and arrows navigate the tablist. **Don't:** use on/off toggles for mutually exclusive choices, force a selected value back to none, or animate text sliding independently of its selected background.

### 3.5 Buttons and Press States

**Choose:** one primary action per form; neutral secondary; text/ghost for low emphasis. [01](design-refs/01-buttons.webp).

**Recipe:** base `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50`; primary `bg-accent text-white active:bg-accent-pressed`; neutral `border [border-color:var(--oyo-control-border)] bg-surface text-text`; ghost `bg-transparent text-text`. Primary form submit `min-h-12 w-full text-base`. Transition only `background-color,color,transform`, 120ms out; press transform `scale(.98)` with 80ms standard, no translate. Preserve text color on press as described in contrast notes. Use focus recipe §3.25.

**Do:** disabled native `button`, `aria-busy` during submission, keep the label (`Saving…`) and width stable, include a restrained 16px pending indicator. A link changes location; a button changes state. **Don't:** use motion to simulate submission progress, disable a failed form without a recovery action, shrink entire cards on press, or add arrow glyphs after `Continue`/`Save Workout`.

### 3.6 Distance Entry: Input, Presets, Stepper, Slider

**Choose:** exact numeric text entry first, common presets second; a slider is optional for target planning, never the only way to log 6,240m. Broad workout ranges make a slider too imprecise. [04](design-refs/04-distance-slider.webp).

**Recipe:** labelled input `w-full min-h-12 rounded-lg border [border-color:var(--oyo-control-border)] bg-surface px-3 text-base tabular-nums`, `type="text" inputMode="decimal"`; visible unit suffix (`m` or `km`), no placeholder-only label. Keep an editing string so empty/decimal values are possible; normalize on blur/submit into integer meters. Validate 1–200,000m. Presets `flex flex-wrap gap-2` with ordinary 44px neutral buttons. Optional minus/plus buttons `size-11 shrink-0 rounded-lg border`, icon names `Decrease Distance` / `Increase Distance`, step 500m (or 0.5km), clamped to allowed bounds; expose step in helper copy. Keyboard entry remains exact.

Optional native `<input type="range">`: `w-full min-h-11 accent-[var(--accent)]`, step 500m, `aria-label="Planned Distance"`, `aria-valuetext="12,000 meters"`, companion exact text input. Native range gives platform keyboard behavior. If styling a primitive, use a 4px track and 24px visible thumb inside a 44px interaction zone; keep an unfilled 3:1 track boundary.

**Do:** disable decrement at the minimum, compute preview while typing only when valid, show `60,000 m × Bike ⅓ × Zone E 1.0 = 20,000 E-meters` in expandable help using server config, and never silently replace the saved distance with E-meters. **Don't:** use a rotary wheel, drag-only ruler, overshooting spring, or a 0–200km slider requiring single-meter precision. Do not add a raw `+`/`−` control without an accessible name.

### 3.7 Zone Picker

**Choose:** compact selected zone button (`Zone E · Easy`) opens a sheet containing **all ten** choices from config. E, D and C may be convenient suggestions but are not the entire zone list. Exclusive native radios beat a rainbow strip with unlabelled intensity colors. [19](design-refs/19-zone-radio.webp).

**Recipe:** selected control `flex min-h-12 w-full items-center justify-between rounded-lg border px-3 text-base`; sheet options `grid grid-cols-[auto_1fr_auto] items-center gap-3 min-h-14 px-4`. Small zone badge `rounded-md px-2 py-1 text-xs font-semibold text-[#242428]` with exact `bg-zone-*` tokens from Tailwind. Slashed keys such as `R/E` need a static literal class or style lookup, not runtime class-name concatenation. Label contains zone name and, where available, personal target pace. Radio/check confirms selection; only the small badge uses zone color.

**Do:** read factors from config, label 6k vs 2k pace bases correctly, and show a neutral `Add Best Split in Profile` helper when pace cannot be computed. Keep radio changes local while the sheet is open; a 44px `Done` action commits the selection, closes and returns focus. Arrow-key selection must not dismiss the sheet mid-navigation. **Don't:** label A as easy, invent HR thresholds, color whole rows, use orange for Zone C selection, or rely on color to communicate the value.

### 3.8 Bottom Sheets, Dialogs and Drag-to-Dismiss

**Choose:** a short bottom sheet for zone selection, target adjustment or entry actions; the full Log form is a route, not a huge nested sheet. On desktop use a centered dialog with the same content. [05](design-refs/05-bottom-sheet.webp), [12](design-refs/12-edit-dialog.webp), [18](design-refs/18-drag-sheet.webp).

**Recipe:** Vaul/Radix portal, overlay `fixed inset-0 z-40 bg-black/40`; content `fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] max-w-[720px] flex-col rounded-t-[20px] border border-divider bg-surface pb-[env(safe-area-inset-bottom)]`; header `shrink-0 px-4 pt-3 pb-4`, title `text-xl font-semibold`, body `min-h-0 overflow-y-auto overscroll-contain px-4 pb-4`. Handle `mx-auto mb-3 h-1 w-9 rounded-full [background:var(--oyo-control-border)]`. Footer `shrink-0 border-t border-divider p-4`. Desktop dialog `max-w-[440px] rounded-xl p-6`, centered with portal positioning. Enter 300ms, exit 200ms.

With Vaul, compose `Drawer.Root`, `Drawer.Trigger asChild`, `Drawer.Portal`, `Drawer.Overlay`, `Drawer.Content`, `Drawer.Title`, `Drawer.Description` and `Drawer.Close asChild`. Vaul 1.1.2 supports `Drawer.Handle` and `handleOnly`: drag only the handle rather than hijacking body scrolling. Let the library arbitrate dismissal velocity/threshold and focus locking. Do not layer a second Motion drag controller over it. Its default motion is not the token system above and does not automatically implement OYO reduced motion: scope overrides to the drawer/overlay, e.g. `@media (prefers-reduced-motion: reduce) { [data-vaul-drawer], [data-vaul-overlay] { animation: none !important; transition: none !important; } }`. Verify the specific release's data attributes before applying. Keep final open/closed positioning intact. See dependency caveat: upstream now explicitly labels Vaul **unmaintained**.

**Do:** explicit 44px Close button, Escape/outside-click for safe short sheets, focus trap, return focus to opener, inert background and scroll lock with scrollbar compensation. If dirty, reject dismissal and show inline `Discard Changes` / `Keep Editing` confirmation; do not silently lose input or open multiple stacked dialogs. Respect Visual Viewport/keyboard and `dvh` fallback (`max-height:85vh` before `85dvh`). Keep submit reachable above the keyboard.

**Don't:** drag from text fields, dismiss during an upload without confirmation, scale/blur the entire application behind the sheet, use the handle as the only exit, or lock document scrolling permanently after navigation. No custom drag implementation without touch, keyboard and screen-reader validation.

### 3.9 Toasts

**Choose:** Sonner or an equivalent existing accessible toast stack; neutral confirmations with a small check. Form errors remain inline. [06](design-refs/06-toast.webp).

**Recipe:** one root `<Toaster position="bottom-center" visibleToasts={2} closeButton />`; mobile offset `calc(80px + env(safe-area-inset-bottom))`, desktop 24px bottom/right. Card `rounded-xl border border-divider bg-surface px-4 py-3 text-sm text-text shadow-[0_8px_24px_rgb(0_0_0/0.12)]`, max width `min(420px, calc(100vw - 32px))`. Use `toast('Workout Saved', { id: 'save-entry', duration: 4000 })`. Errors with actionable recovery: 8 seconds or persistent until dismissed; deduplicate by action id. No rich rainbow colors.

**Do:** polite live-region announcements, 44px close/action targets, pause expiry on hover/focus, keep success accessible after motion ends, and avoid a redundant toast for every kudos tap. Reserve assertive announcements for urgent blocking errors. **Don't:** make a four-second toast the only place a user can undo a destructive action, announce loading ticks repeatedly, cover the Log action, or trigger target-hit animation based on a toast mount.

### 3.10 Skeletons and Loading

**Choose:** structural placeholders that reserve final layout; keep prior data during background refresh. [07](design-refs/07-skeleton.webp).

**Recipe:** `.oyo-skeleton { background:var(--oyo-skeleton); border-radius:8px; }`; avatar `size-10 rounded-full`, name `h-4 w-32`, stats `h-6 w-24`, photo `aspect-[4/3] w-full`. Container `aria-busy="true"`, all shapes `aria-hidden="true"`; one visually hidden polite `Loading Workouts` status. Delay skeleton appearance 150ms to avoid a flash. After that, optional 1200ms opacity cycle from 1 to 0.65 and back, twice maximum, then static. Reduced motion is static from the beginning.

**Do:** match actual card dimensions, avoid fake statistics, reserve image width/height, show retry copy after failure and `Still Loading…` with a visible Refresh option after a long wait. Existing content remains interactive unless the specific mutation requires locking. **Don't:** replace a loaded feed with skeletons on every query invalidation, run endless shimmer, or show an empty state while data is still loading.

### 3.11 Pull-to-Refresh

**Choose:** native page scroll plus an explicit labelled Refresh action. Add a custom pull gesture only if real installed iOS/Android testing demonstrates it is needed and doesn't double-trigger browser refresh. This is progressive enhancement, not an MVP dependency.

**Recipe:** Refresh icon button `size-11 rounded-lg`, accessible name `Refresh Feed`; call the scoped Query invalidation once, disable duplicate requests while pending. On capable tested standalone shells, start pull only at `scrollTop === 0`, one touch, downward vertical intent, no active sheet/carousel/input. After 10px intent, map distance `displayY = min(72, dragY * 0.4)`; arm at 56px displayed travel, reset on reversal/cancel. Indicator sits in a reserved 48px slot above content; content movement is transform-only. Release triggers exactly one request; 120ms return. Use pointer cancellation handling and a platform-specific touch strategy only after validating that native panning isn't stolen. Do not paste a global non-passive `touchmove` listener.

**Do:** announce `Feed Updated` after completion, keep scroll position on failure, and leave Refresh available to keyboard/screen-reader users. Use `overscroll-behavior-y: contain` only on a deliberate custom scroll root, not globally as an untested browser-refresh hack. **Don't:** hijack Safari's edge-back gesture, attach a document-wide `preventDefault`, start while dragging a photo sideways, or require pulling as the only way to retry.

### 3.12 Feed Card and Photo Carousel

**Choose:** chronological, readable training cards; photographs carry the visual energy. No mini marketing headers. [08](design-refs/08-photo-carousel.webp).

**Recipe:** `<article>` `border-b border-divider bg-surface py-4 sm:rounded-xl sm:border sm:p-4`; author row `flex items-center gap-3`, 40px avatar and 44px profile link target; title `mt-3 text-base font-semibold`; metadata `text-xs text-muted`; stats `mt-3 grid grid-cols-2 gap-x-4 gap-y-2` with E-meters primary and actual distance/modality/zone clearly labelled. Image region `mt-4 aspect-[4/3] overflow-hidden bg-bg`, images `h-full w-full object-cover`, explicit width/height, lazy-load offscreen. At most four images, per API. Text and optional notes must work without photos.

CSS carousel baseline: viewport `flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain`, slides `w-full shrink-0 snap-center`. Native pan stays native. If Embla is used: `useEmblaCarousel({ loop:false, align:'start', watchDrag:true })`, viewport `overflow-hidden`, track `flex touch-pan-y pinch-zoom`, slide `min-w-0 flex-[0_0_100%]`. Provide 44px named Previous Photo / Next Photo controls on desktop and an accessible `Photo 2 of 4` indicator; small visible dots are decoration inside larger buttons. Disable smooth behavior under reduced motion. No autoplay plugin.

**Do:** meaningful photo alt text without invented content, preserve image aspect and slide index when query data refreshes, let image actions be separate from entry/detail links, and offer `Load More` alongside an intersection-based page fetch. Preserve feed cache when opening detail. **Don't:** wrap an entire card containing buttons in a link, steal horizontal swipes outside the carousel, download full-resolution photos for thumbnails, lazy-load the first above-fold image, or treat a broken image as a blank empty post.

### 3.13 Kudos

**Choose:** one optimistic, reversible state change. Ordinary kudos is cardinal, not an orange achievement. No floating hearts or particle burst.

**Recipe:** button `inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm tabular-nums`; `aria-pressed={hasKudos}`, stable accessible name `Kudos` (the pressed state communicates selection). Outline Lucide icon becomes filled/stronger cardinal on selection; count updates instantly. On a new tap only, keyframes `scale(1) → scale(1.08) → scale(1)` over 240ms. No animation on mount/refetch or removing kudos. Reduced motion changes color/count only.

**Do:** cancel stale queries, snapshot cache, apply optimistic state and restore it on failure; serialize/debounce the mutation for that entry so rapid taps can't leave count and server state disagreeing. Announce failure once (`Kudos Not Saved. Try Again.`) without shifting the whole card. **Don't:** fabricate extra kudos, replay when a card scrolls into view, trigger device vibration/sound, or use an unlabelled heart alone as the action.

### 3.14 Progress Ring Fill

**Choose:** a single cardinal ring and readable actual/target numbers, not multiple Apple-style activity rings. [09](design-refs/09-progress.webp) is the linear primitive baseline; the circular geometry is an OYO decision.

**Recipe:** 160px SVG with `viewBox="0 0 160 160"`; circle center 80, radius 68, stroke width 10, `fill="none"`, `stroke-linecap="round"`, rotation -90° around center. Track uses divider; fill uses accent. Circumference `C=2*Math.PI*68`; `p=target>0 ? Math.min(total/target,1) : 0`; dash array `C`, dash offset `C*(1-p)`. Animate from prior offset to new offset in 600ms out only on meaningful in-session data change. SVG is `aria-hidden`; surrounding labelled `role="progressbar"` uses min 0, max target, now `min(total,target)`, `aria-valuetext="80,000 of 80,000 E-meters. Target Hit."`. Visible total may exceed target and remains accurate (`96,000 / 80,000 m · 120%`).

**Do:** show `20,000 m Remaining` or `Target Hit`, final numbers immediately even while the arc moves, render the actual value on initial load, handle zero/missing target with `Set Weekly Target` instead of division, and show effective group/personal target source. **Don't:** spin from zero on every tab switch, show negative remaining meters, add a second revolution for >100%, announce every animation frame, or pretend progress is known while loading.

### 3.15 Target-Hit Celebration

**Choose:** the ring meets its finish point, a 16px check appears beside `Target Hit`, and a small orange achievement tag remains. This is earned feedback, not a confetti screen.

**Recipe:** after a **confirmed** save, detect `previousTotal < target && nextTotal >= target && target > 0` for the current LA week. Fill stays cardinal; tick `stroke:var(--oyo-highlight-ink)` or orange non-text stroke, 160ms reveal (`stroke-dashoffset` or opacity). Label `rounded-md px-2 py-1 text-xs font-semibold [color:var(--oyo-highlight-ink)]`. The 600ms ring + 160ms tick complete within 800ms. Store a per-user + `week_start` acknowledgement locally so revisiting/refetching/reconnecting doesn't replay it. Do not store sensitive training data in the acknowledgement key.

**Do:** leave readable status after the sequence, announce `Weekly Target Hit` once, show static status for reduced motion, and let users immediately continue. If deleting a workout drops below target, update truth without a punitive animation; do not replay celebration on restoring the same already-acknowledged week. **Don't:** trigger it for a lowered target, an admin recalculation or optimistic totals that may roll back. No fireworks, haptics assumption, sound, full-screen modal or reward hierarchy shaming lower-volume athletes.

### 3.16 Leaderboard Rows and Podium

**Choose:** three compact podium summaries followed by a readable ranked list. Podium is secondary to accurate comparison; no giant gold/silver/bronze cards. [15](design-refs/15-ranking-table.webp).

**Recipe:** podium `grid grid-cols-3 gap-2`, cards `min-w-0 rounded-xl border border-divider bg-surface p-3`; rank 1 gets a cardinal top rule (`border-t-2 border-t-accent`), not orange. Keep visual and DOM order **1, 2, 3**; no rearranged 2/1/3 reading order. On very narrow screens use one compact horizontal summary row or omit podium in favor of the complete list. List `<ol>` with each row `grid grid-cols-[28px_36px_minmax(0,1fr)_auto] min-h-16 items-center gap-3 border-b border-divider px-4 py-3`; rank, avatar, wrapping name, metric `text-right tabular-nums`. Own row `[background:var(--oyo-selected)]` and visible `You`; ≥100% adds a labelled check. Entire row can be a profile link only if it contains no other interactive control.

**Do:** use server ranking and metric, show week dates in America/Los_Angeles, explain that Percent compares each rower's effective target, and keep tied ranks as returned. Season metric ignores the weekly switcher; label its actual season scope. Show coxswains only when leaderboard eligibility permits. Background updates preserve scroll and don't animate rows racing around; `Updated Just Now` is enough.

**Don't:** invent podium placeholders when fewer than three eligible athletes exist, infer rank from visual order alone, display raw percentages with long decimals, or use a green/orange gradient for effort.

### 3.17 Charts

**Choose:** weekly bars with a clear target line; simple labelled horizontal bars for modality/zone breakdowns. SVG is enough for 7 days or ~52 weeks; avoid a chart dependency unless requirements genuinely grow. [10](design-refs/10-weekly-chart.webp).

**Recipe:** chart wrapper `min-h-[200px] w-full rounded-xl border border-divider bg-surface p-4`; `viewBox` with 24px left/bottom label allowance and at least 12px rendered axis labels. Weekly bars cardinal (subdued neutral for unselected comparison bars), target line `stroke:var(--text); stroke-dasharray:4 4; stroke-width:1.5`, labelled `Weekly Target`. Domain starts at zero and includes max(total,target), with 10% headroom. If historical targets vary, draw the matching per-week target segment rather than one current target across every week. No gradient fill. Selected week shows date range, E-meters and target in a stable detail region below; keyboard and tap reveal the same detail as hover.

**Do:** SVG title/description and a `View Data` disclosure with accessible table, one focusable selector per week or roving keyboard selection for 52 points, a clear zero-data baseline, and neutral/full-text legends for Erg/Bike/Run (cardinal + neutral shades, not three new brand colors). Only best-week markers use orange. Chart text cannot depend on hover. At small widths, group weeks by a clearly labelled range or allow a chart-local horizontal scroller without making the entire page wide.

**Don't:** add a radar chart, donut for every metric, truncate axes to exaggerate effort, animate bars on scroll, use tooltips as the only exact values, or carry sensitive data in an offscreen table for unauthorized profiles.

### 3.18 Sign-Up, Login and First Use

**Choose:** direct forms, not a slideshow or social-login menu unsupported by the API. Sign-up asks only name, email, password and join code where required; profile details are optional afterward. [13](design-refs/13-signup-form.webp).

**Recipe:** page `min-h-[100dvh] bg-bg px-4 py-8`; form `mx-auto w-full max-w-[400px] space-y-5 rounded-xl bg-surface p-6`; heading `text-2xl font-semibold`; labelled fields use distance input recipe; helper/error `text-sm leading-5`. Login email `type="email" autoComplete="username"`, sign-up email `autoComplete="email"`, current password `autoComplete="current-password"`, new password `autoComplete="new-password"`, name `autoComplete="name"`. Visible 44px `Show Password` toggle with `aria-pressed`. No nav shell before authentication. Keep `Create Account` and `Log In` as clear alternate links.

**Do:** explain minimum 8-character password before submission; allow paste/password managers. Explain `Already on the roster? You don't need a join code.` without exposing roster membership before authentication. Show server errors verbatim only when safe; invalid credentials/rate limit need useful but non-enumerating copy. Focus error summary then first invalid field, use `aria-invalid` and `aria-describedby`, retain non-password values on failure. After success show Home with `Your weekly target is 80,000 E-meters · Group Default` and one `Log Workout` action; optionally invite profile/split setup later. Use config/me data, not a hard-coded group target.

Password recovery is **staff-assisted** in the contract: `Ask a Coxswain or Coach to Reset Your Password`. Do not invent email reset links or OAuth. `must_change_password` routes to a dedicated change-password form before normal app use. Staff temporary passwords are shown once, not stored in localStorage or exposed in a toast.

**Don't:** force photo permissions, a tutorial carousel, role selection or best splits to finish signup; imply the app verifies Stanford email via an unimplemented flow; strip the user's join code while correcting another field; or send a draft workout automatically after session expiry. Reauthenticate, restore the draft, ask the user to submit.

### 3.19 Settings List, Menus and Staff Operations

**Choose:** grouped native-feeling lists, not a grid of settings cards. Use switches only for binary preferences; Theme is a System / Light / Dark selection. [11](design-refs/11-overflow-menu.webp), [14](design-refs/14-settings-switch.webp), [20](design-refs/20-scroll-area.webp).

**Recipe:** labelled `<section>` with `space-y-2`; list `divide-y divide-divider overflow-hidden rounded-xl border border-divider bg-surface`; rows `flex min-h-14 w-full items-center justify-between gap-4 px-4 py-3 text-base`; secondary value `text-sm text-muted`. Whole-row link for navigation; not a link wrapping a switch. Select/fieldset for Theme, explicit Save for password. Optional menu portal `z-50 min-w-[180px] rounded-xl border border-divider bg-surface p-1 shadow-[0_8px_24px_rgb(0_0_0/0.12)]`; items `min-h-11 rounded-lg px-3 text-sm`, keyboard arrows/Home/End/Escape via a primitive. `aria-haspopup="menu"`/`aria-expanded` on overflow trigger. Plain native select is better than a custom menu for most choices.

**Do:** apply theme before paint when possible to avoid white flash, persist a non-sensitive preference, follow OS changes only in System mode, and keep selected value textual. Put Log Out in its own group. Make destructive staff actions explicit, with scope, affected count and confirmation (`Recalculate Entries`, not `Run`). Use actual permissions, not only hidden links; audit export/recalculation remain staff tasks.

**Don't:** group logout with data deletion, create an account-deletion API that does not exist, use menu semantics for a list of page links, show hover-only tooltips instead of labels, or copy custom gradient scrollbars from the Radix reference. Native scrollbars are the OYO choice.

### 3.20 Profile Header

**Choose:** compact identity, training context and useful season totals; no giant cover photo. [16](design-refs/16-profile-card.webp) is a grouping reference, not a profile screen to copy.

**Recipe:** `flex items-start gap-4 px-4 pt-6`; avatar `size-16 shrink-0 rounded-full object-cover`, fallback initials `bg-bg text-xl font-semibold text-text`; name `text-2xl leading-8 font-semibold break-words`, group/side/class year `mt-1 text-sm text-muted`, bio `mt-3 text-base leading-6`. Own profile Edit Profile link min44px; public profiles omit private edit controls. Stats `mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3` with `text-2xl font-semibold tabular-nums` and visible unit labels. Theme-independent avatar treatment; no mandatory completion ring.

**Do:** distinguish Season and Calendar Year using real tabs, link to best-split entry when values are absent on one's own profile, hide missing optional public fields gracefully, and use server-authorized public summaries. **Don't:** display email/join code publicly, infer a training side from group, force every metric into a tiny chip, or make missing photos look like errors.

### 3.21 Empty States

**Choose:** specific next-step copy in the same content region, not a mascot or giant illustration. [17](design-refs/17-inline-empty.webp) supplies the quiet inline message treatment; the copy below is OYO-specific.

**Recipe:** `rounded-xl border border-divider bg-surface px-6 py-8 text-center`; optional 24px neutral Lucide icon (decorative); heading `text-base font-semibold`, body `mx-auto mt-2 max-w-[32ch] text-sm leading-5 text-muted`, action `mt-4 min-h-11`. No border-dash box unless it is an actual upload drop zone.

| State                        | Copy / Action                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| No own workouts              | `Your Week Starts Here` / `Log an erg, bike or run to start tracking E-meters.` / `Log Workout`      |
| Team feed empty              | `No Team Workouts Yet` / `Workouts shared with the team will appear here.` / `Log Workout`           |
| Filtered result empty        | `No Workouts This Week` / `Try another week.` / `This Week`                                          |
| No eligible leaderboard rows | `No Rankings Yet` / `Rankings appear after eligible teammates log workouts.` No fake podium.         |
| Notifications empty          | `You're All Caught Up` / `New kudos, comments and announcements appear here.` No CTA needed.         |
| Load failed                  | `Couldn't Load Workouts` / `Your saved workouts haven't been changed.` / `Try Again`                 |
| Offline                      | `You're Offline` / `Reconnect to load or save workouts.` Keep existing data. No false `Saved` state. |

**Do:** distinguish no data, filtered out, unavailable and not authorized; keep a draft after a failed save. **Don't:** suggest logging a workout to fix a network failure, show fabricated motivational streaks, or advertise offline workout saving before it is implemented. The service worker caches the app shell, never API responses by default.

### 3.22 Hover States on Desktop

**Choose:** subtle tint only on interactive surfaces, gated to real hovering pointers. No lift on feed cards.

**Recipe:**

```css
@media (hover: hover) and (pointer: fine) {
  .oyo-row-link:hover,
  .oyo-button-quiet:hover {
    background: var(--oyo-hover);
  }
  .oyo-text-link:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .oyo-button-primary:hover {
    background: var(--accent-pressed);
  }
}
```

**Do:** cursor pointer on click targets, visible labels for critical actions and focus equivalent to hover information. **Don't:** depend on hover for menu access, use sticky `:hover` tint as selected state on touch, change card geometry/shadow, or animate idle icons.

### 3.23 Route Transitions

**Choose:** small content crossfade for navigation; no slide between peer tabs. Entry-detail continuity may earn a shared photo transition later, but not until scroll restoration and image sizing are stable.

**Recipe:** React Router v7.18.5 is already installed. Its React18-compatible `viewTransition` link prop (or `navigate(path, { viewTransition:true })`) still works. Current Router docs label this API **legacy/deprecated**, in favor of React's `<ViewTransition>` requiring React/ReactDOM 19.3+. For this React18 app, keep transitions a small optional enhancement using the existing compatible API, or omit them. Do not upgrade React/Router as part of visual polish. Do not also wrap the router call in a second `document.startViewTransition`. Only assign a name to the route content, **not** the persistent nav/sidebar:

```css
.oyo-route-content {
  view-transition-name: oyo-route;
}
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
}
::view-transition-old(oyo-route) {
  animation: oyo-route-out 120ms var(--oyo-ease-standard) both;
}
::view-transition-new(oyo-route) {
  animation: oyo-route-in 160ms var(--oyo-ease-standard) both;
}
@keyframes oyo-route-out {
  to {
    opacity: 0;
  }
}
@keyframes oyo-route-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .oyo-route-content {
    view-transition-name: none;
  }
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

Browser support changes; feature-detect `'startViewTransition' in document`. Disable the `viewTransition` prop under reduced motion too. The scaffold already uses `createBrowserRouter` with `RouterProvider`, so router-managed transitions and `<ScrollRestoration>` can be adopted in that existing data-router setup. Do not introduce a second router or manual transition wrapper. Keep ordinary links and the fallback below usable when browser support is absent.

Fallback: native route swap, optionally a **single** `opacity:0 → 1` 120ms animation on newly mounted route content, with content visible by default and no animation under reduced motion. Never unmount the persistent shell or replay all feed children. If transitions are unavailable, nothing should wait, disappear or break.

**Do:** update document title, focus the new page's h1 (`tabIndex={-1}`, no visible outline on programmatic focus) for forward navigation and announce meaningful page changes. Allow clicks/back during animation; don't queue navigation. **Don't:** clone the whole DOM, give multiple feed photos the same `view-transition-name`, animate passwords/private profile content into snapshots unnecessarily, or delay a route until unrelated images finish loading.

### 3.24 Scroll Restoration

**Choose:** native document scrolling for pages, independent sheet body scroll, and exact return-to-feed behavior.

**Recipe:** add one `<ScrollRestoration />` in the root route shell rendered under the existing RouterProvider; it uses location keys by default. Do not render it beside RouterProvider or add another restoration hook. If a future router change requires a custom fallback instead, a single shell hook stores `{x,y}` in a `Map` keyed by `location.key` before navigation, uses `useNavigationType()` to distinguish POP from PUSH, restores POP after cached content/layout is available, and uses `scrollTo({ top:0, behavior:'instant' })` (or `auto` where instant typing is unavailable) for new screens. Preserve feed query pages in Query cache and reserve image dimensions, so the old scroll height exists before restoring. An explicit `Load More` remains usable.

Own the browser interaction: use native `history.scrollRestoration='auto'` if no manual manager; if implementing a manager set `'manual'` and clean it up, rather than letting two systems fight. If async content isn't ready, restore after its layout settles with bounded retries and cancel when the user scrolls; never snap back seconds later over a deliberate user gesture.

**Do:** opening an entry then Back returns to the same card and carousel index; query-only changes such as leaderboard metric can preserve position via `preventScrollReset` where supported. Switching week should keep the filter/header in view. Anchor/hash navigation scrolls to its labelled target and respects `scroll-margin-top:72px`. New tab destination goes to top; tapping the active tab may expose a deliberate `Scroll to Top` action, not discard data.

**Don't:** smooth-scroll on every route change, restore using pathname alone (multiple feed histories can differ), scroll the body while a sheet is open, or focus an offscreen h1 on POP and thereby undo restored position. Restore the originating entry link on Back with `preventScroll:true` if available.

### 3.25 Focus Rings and Keyboard Behavior

**Choose:** visible cardinal-tint outline outside the control; no glow. This applies to every pattern above.

**Recipe:**

```css
.oyo-focus:focus-visible {
  outline: 2px solid var(--oyo-focus);
  outline-offset: 3px;
}
@media (forced-colors: active) {
  .oyo-focus:focus-visible {
    outline-color: Highlight;
  }
}
```

Tailwind equivalent: `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:[outline-color:var(--oyo-focus)]`. Do not add `outline-none` without this replacement. Native controls retain native focus if no custom component style is supplied. Scroll containers need enough padding that outlines are not clipped.

**Do:** a visible-on-focus `Skip to Main Content` link, logical DOM order, labelled icon buttons, Escape to close overlays, focus return after overlays, and native Enter/Space behavior. Switches use `checked`, toggle buttons `aria-pressed`, navigation `aria-current`, tabs `aria-selected`: do not use these interchangeably. Use `role="status"` for polite outcomes and inline errors associated with their fields. **Don't:** make every chart bar/card a keyboard stop without a navigation model, remove outlines for aesthetics, trap focus in nonmodal regions, or communicate selected/error/target-hit solely by color.

## 4. Signature Details

Keep these four; do not add a new flourish to every component:

1. **The Finish Tick:** the week ring meets its twelve-o'clock endpoint, then one small check appears after the server-confirmed crossing. Cardinal owns progress; orange briefly marks achievement.
2. **The E-Meter Receipt:** beneath the live Log preview, one expandable line explains exactly how this workout converts. Human units, correct factors, instant updates, no animated counters. It makes this rowing app more trustworthy than a generic fitness tracker.
3. **Your Place in the Team:** a quiet tinted own-row with `You`, identical rank/metric alignment to teammates. Identity is obvious without a competing badge system.
4. **Return to the Same Workout:** photo index, loaded feed pages and scroll position survive entry-detail navigation. This small continuity matters more than an elaborate page transition.

## 5. Dependency Budget and Ranked Recommendations

No package is installed in the app by this PR. Use existing React, Router, TanStack Query and Lucide. Avoid a whole UI kit, a second icon set, GSAP/Lottie for UI feedback, or multiple overlay/motion systems.

Sizes below are **measured standalone production import probes**, not npm unpacked size or guaranteed app deltas. Method: esbuild 0.25.12, browser ES2020 ESM, minify + tree shaking, gzip level 9, React/ReactDOM/JSX runtime external; entry logs the named public APIs to retain them. No app CSS/assets. Dependencies shared between packages will be deduplicated, so don't sum the rows as an app prediction. Versions are measurement pins, **not** a request to install the newest registry release. Re-measure actual route chunks before adoption.

| Rank | Package / Probe                                                                                               | Minified / Gzip   | Recommendation                                                                                                                                                                                                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `sonner@2.0.7`: Toaster + toast                                                                               | 32.5 / 9.3 KiB    | Worth adding if no toast system exists. One instance, neutral styling, small API, accessible announcements. Style its buttons up to OYO hit areas.                                                                                                                                                                                |
| 2    | `embla-carousel-react@8.6.0`: hook                                                                            | 19.0 / 7.9 KiB    | Add only if CSS scroll snap cannot meet photo-state/controls requirements. Stable v8, no autoplay. Do not select the v9 release candidate merely because current docs default to it.                                                                                                                                              |
| 3    | `@radix-ui/react-dialog@1.1.15`: namespace                                                                    | 32.5 / 11.4 KiB   | Reliable focus/portal baseline if not supplied transitively by the chosen drawer. Native select/radios need no primitive package.                                                                                                                                                                                                 |
| 4    | `vaul@1.1.2`: Drawer namespace                                                                                | 60.8 / 19.4 KiB   | Conditional: proven drag behavior, but [upstream explicitly says unmaintained](https://github.com/emilkowalski/vaul). Use only after accepting a frozen-dependency maintenance burden, pin exactly and test; otherwise Radix dialog styled as a bottom sheet with explicit Close. Do not promise drag in a plain dialog fallback. |
| 5    | `motion@12.23.24`: LazyMotion + m + domAnimation                                                              | 75.1 / 26.7 KiB   | Defer. CSS covers this guide's baseline. If several interruption-aware shared-element/gesture needs emerge, load only on those routes. Full motion + AnimatePresence probe: 125.3 / 41.7 KiB. Don't install both `motion` and `framer-motion`.                                                                                    |
| 6    | `@radix-ui/react-dropdown-menu@2.1.16`: namespace                                                             | 75.6 / 26.1 KiB   | Use for a true keyboard menu if already needed. A native select, ordinary links or a short sheet often avoids this dependency. This includes positioning/focus helpers; actual marginal cost may be lower with Dialog shared.                                                                                                     |
| 7    | `recharts@3.10.1`: BarChart/Bar/XAxis/YAxis/Tooltip/ResponsiveContainer/ReferenceLine, with `react-is@18.3.1` | 378.2 / 110.9 KiB | Established, actively maintained chart option, but defer for this app: a simple SVG is enough. If needed later, lazy-load the Profile route, verify matching React18 peer setup, and disable animation under reduced motion. Do not use inactive Recharts v2 examples as the installation recipe.                                 |

All listed package families have established use and permissive licenses, but that does not override current maintenance/security checks. Check official stable release notes, React18 peer support, advisories and keyboard/touch behavior before adding anything. Sonner/Embla are the small optional additions with the clearest payoff; chart/motion libraries are not necessary for first delivery. Vaul's maintenance caveat is important: design requirements should not silently create an unsupported critical dependency.

Reproduce a probe outside the repo or in a disposable tooling folder (not in app dependencies):

```js
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';

const result = await build({
  stdin: {
    contents: 'import { Toaster, toast } from "sonner"; console.log(Toaster, toast)',
    resolveDir: process.cwd(),
  },
  bundle: true,
  minify: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
});
console.log(result.outputFiles[0].contents.length);
console.log(gzipSync(result.outputFiles[0].contents, { level: 9 }).length);
```

## 6. Implementation Acceptance Checklist

This is the handoff checklist for screen engineers, **not a claim these screens were implemented or tested in this documentation PR**.

- [ ] Phone widths 320/390/430px, tablet 768px, desktop 1024/1440px; short landscape window; 200% text; no page-wide horizontal scrolling.
- [ ] System/light/dark before paint; color contrast checked including pressed, disabled and chart/zone labels. Orange never carries ordinary small white text.
- [ ] iOS Safari and Android Chrome, both browser and installed PWA: safe areas once, keyboard submit reachable, no tab-bar overlap, native Back works.
- [ ] Keyboard only: skip link, all actions, radio/segmented selection, dialog/menu focus/escape/return, chart details, carousel controls and refresh.
- [ ] VoiceOver/TalkBack: no duplicated titles, meaningful current-page state, readable E-meter units, polite save/kudos/refresh outcomes.
- [ ] Reduced motion and forced colors: static final states, visible focus, no essential information lost.
- [ ] Slow network/offline/expired session/server validation/failed image: preserve draft and old content, no false empty/saved/target-hit state, retry available.
- [ ] Feed → detail → Back: same entry, photo and scroll; loading more doesn't remount prior cards. Sheet scrolling never drags the page.
- [ ] Repeated taps/back/route changes during motion: no queued transitions, count mismatch, trapped scroll or stale modal.
- [ ] Training truth: exact bike third, 6,240m campus loop, saved-factor conversions, all ten zones, LA Monday week, historical targets and current-week-only celebration. Feed/profile/leaderboard totals include every team-visible workout.
- [ ] Staff: visible permissions match server authorization; reset passwords shown only once, export/recalculation require clear scope and confirmation.
- [ ] Profile on real phones before adding motion or a gesture package. Transform-only is a useful baseline, not proof of 60fps.

## 7. Research Ledger and Reference Credits

### How to Read the Evidence

Requested galleries were opened in a real Chrome browser, with deeper review split across parallel research agents. This is reference research, not an end-to-end app test. A public catalog preview establishes visual treatment, **not** verified touch physics, accessibility, production performance or permission to redistribute its artwork. No login/paywall/bot protection was bypassed. Exact observations and limitations are recorded below.

The archive intentionally uses licensed open-source documentation/demo captures rather than screenshots of proprietary fitness apps or paid gallery assets. This keeps implementation references inspectable without importing third-party photographs, logos, premium source or branded assets into the product. Colors, scale and copy in the captures are **not** the OYO design system; the recipes above are authoritative for this app.

### Requested Galleries: Adopt, Adapt, Reject

All fourteen roots were reachable in Chrome during this review. Access to a root does not imply access to every demo or its source. “Adopt” below means the **interaction principle**, reimplemented with OYO tokens and semantics, not copying the gallery's code or assets.

| Source / Reviewed Surface                                                                                                                  | Observed Reference and OYO Decision                                                                                                                                                                                                                      | Limit / Asset Handling                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [CollectUI](https://collectui.com/), settings, buttons, profile and range-input categories                                                 | Grouped settings rows, values adjacent to labels, bounded ranges and numeric readouts are useful. Adapt to exact distance input + presets and a calm settings list (§§3.6, 3.19). Reject glossy novelty buttons, decorative particles and custom chrome. | A catalog of third-party work is not a blanket asset license. No images retained. Static examples do not establish keyboard behavior.                                                       |
| [Libraries.dev](https://libraries.dev/), component catalog / accessibility guidance                                                        | Native semantics and keyboard support are the useful filter for primitives. Prefer ordinary controls and established focus management. Reject liquid, magnetic and gooey visual effects for repeated training tasks.                                     | Catalog inclusion does not prove a package accessible or maintained. No captures retained.                                                                                                  |
| [beUI Pro](https://pro.beui.dev/), settings/mobile page previews                                                                           | Visible current values, System/Light/Dark choice and explicit Save/Discard for dirty forms translate well to OYO. Use grouped settings, not an admin-card wall.                                                                                          | Pro/template licensing is not permission to redistribute. React Native mobile examples are conceptual references, not React DOM drop-ins. No captures retained.                             |
| [Arc UI](https://uiarc.dev/), buttons, segmented controls, slider and number inputs                                                        | Bounded numeric inputs and compact selection affordances are useful; use our 44px+ targets, not the reference's smaller controls. Exact number entry stays available.                                                                                    | Installation guidance targets React19; do not introduce the kit into this React18 app. No captures retained.                                                                                |
| [Bencho](https://bencho.dev/), segmented selection, chart details, refresh and number transitions                                          | Keep the active selection clear and show chart detail in a stable region. Refresh needs explicit state feedback. Reject rolling digits for E-meter entry, motion blur, sounds and keyboard-chip clutter.                                                 | A slick preview does not verify touch/keyboard physics. No captures retained.                                                                                                               |
| [Board UI](https://boardui.com/), sidebar, week/date switcher and metric rows                                                              | Active row treatment, aligned numbers and bounded period navigation are useful for the sidebar/leaderboard. Keep desktop labels visible.                                                                                                                 | Do not adopt Pro dashboard source, gradients, multi-ring fitness cards or collapsible icon rails. No captures retained.                                                                     |
| [Affect UI](https://affectui.com/), reaction/chart interactions                                                                            | A reaction should expose pressed state and give one small acknowledgement. Adapt to cardinal kudos and a restrained scale peak, with error rollback. Gate hover to fine pointers.                                                                        | Reject blue/green branding and gradient area fills. Catalog examples are not accessibility certification. No captures retained.                                                             |
| [Kobra](https://kobra.systems/), component/system documentation                                                                            | Useful as an anti-reference for elaborate bespoke chrome: OYO needs less complexity, not a second design language.                                                                                                                                       | Proprietary license was found. No source/assets or screenshots retained.                                                                                                                    |
| [Watermelon UI](https://ui.watermelon.sh/), tabs and animated controls                                                                     | Shared selected-state continuity can help segmented controls. A simple 160ms indicator is enough; labels remain still.                                                                                                                                   | Source identifies MIT licensing, but no frame is needed in this archive. Reject gradients, shimmer and loose underdamped springs.                                                           |
| [Inspora](https://inspora.design/), gallery                                                                                                | Primarily marketing/illustration work in this review. It does not supply a defensible app feed, settings or navigation pattern.                                                                                                                          | No relevant interaction evidence or retained image; do not turn a marketing composition into an app screen.                                                                                 |
| [Cosmos](https://www.cosmos.so/), public profile/collection surfaces                                                                       | Quiet identity hierarchy and clear content ownership are transferable to the profile header. A save/follow pattern is not a reason to add those features to OYO.                                                                                         | Proprietary editorial/user images excluded. No logged-in gesture or follow-state claim.                                                                                                     |
| [Navbar Gallery](https://www.navbar.gallery/), navigation gallery                                                                          | Helpful for seeing how active destinations differ from surrounding chrome, but mostly website headers. OYO uses a stable labelled phone tab bar and expanded desktop sidebar.                                                                            | Not an authority for native app navigation; no capture retained.                                                                                                                            |
| [SupaHero](https://www.supahero.io/), hero library                                                                                         | Marketing heroes are an intentional rejection: no oversized introductory panel between an athlete and Log Workout.                                                                                                                                       | No useful app interaction claimed; no proprietary artwork retained.                                                                                                                         |
| [60fps](https://60fps.design/), fitness motion catalog and [Runmo goal stepper](https://60fps.design/shots/runmo-days-counter-interaction) | Goal steppers, immediate value feedback and bounded selection are useful; blur/ticker effects are not. Use the exact value update, not the rolling counter. A rare target-hit moment earns more motion than routine input.                               | Shot descriptions/previews informed decisions; full playback/touch physics were not verified. Some Strava shots were PRO-gated or black-rendering. No third-party recording/frame retained. |

### Fitness and Mobile Product References

The fitness review used public official pages, search results and available app listings, not authenticated app sessions. These establish information hierarchy and feature context; they do **not** verify an app's current interaction implementation. No proprietary fitness-app screenshots are shipped.

| Source                                                       | What Informed OYO                                                                                                                                                                                                                           | Access / Boundary                                                                                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Strava features](https://www.strava.com/features)           | Clear training units, progress comparison and team competition support the metric-first feed and leaderboard. OYO keeps actual distance distinct from equivalent E-meters, and does not copy segment/maps/AI features outside its contract. | Public page loaded. Some catalog app shots were PRO-gated/black. No authenticated feed or gestures tested.                                             |
| [Nike Run Club](https://www.nike.com/nrc-app)                | Large readable activity metrics, encouraging plain-language next steps and group motivation. Empty states should help start the next workout, not add a tutorial.                                                                           | Public official page loaded. No run-tracking session or onboarding persistence tested. No photos retained.                                             |
| [WHOOP](https://www.whoop.com/us/en/thelocker/)              | Progressive disclosure is the relevant lesson: one primary training summary before detailed metrics. Reject recovery-color dashboards and unsupported sensor/health claims.                                                                 | An initial feature request returned 403; a later article URL redirected to the public Locker index. Do not treat that index as a verified in-app flow. |
| [Apple Fitness+](https://www.apple.com/apple-fitness-plus/)  | Readable training context and a clear start action. OYO uses **one** weekly ring; do not reproduce Apple's branded Activity-ring system.                                                                                                    | Initial Fitness URL was 404; current Fitness+ page loaded. Its catalog/marketing flow is not the Fitness app itself.                                   |
| [Oura app reference](https://ouraring.com/blog/oura-app/)    | The useful conceptual direction is calm hierarchy with detailed context behind a disclosure; this is an OYO decision, not a verified Oura control specification.                                                                            | Attempted app-information URLs returned 404. No authenticated app claim or retained screenshot.                                                        |
| [Ladder](https://www.joinladder.com/)                        | A legible week strip, explicit workout schedule and visible training notes reinforce Plan/Log clarity. Do not import coach-subscription onboarding or add strength/nutrition features.                                                      | Public site loaded, not a logged-in training session. Team planning remains staff-controlled by the OYO contract.                                      |
| [Linear Mobile](https://linear.app/mobile)                   | Compact, purpose-built mobile workflows and fast composition support keeping Log direct and secondary controls quiet. Brand precision is spacing/state quality, not extra decoration.                                                       | Public page loaded. Linear is native Swift/Kotlin, not evidence that a PWA gets native gestures automatically.                                         |
| [Mobbin](https://mobbin.com/) and public flow-search results | Useful discovery pointers only. No inaccessible screen or exact motion was used as implementation authority.                                                                                                                                | Login-gated content skipped; no credentials requested or paywall bypass attempted.                                                                     |

### Platform and Implementation Authorities

- **[Apple HIG tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars), [sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars), [motion](https://developer.apple.com/design/human-interface-guidelines/motion), [accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility):** stable destinations, recognizable labels, appropriate adaptation to wider layouts, sufficient hit regions and purposeful motion. Applied to §§3.1–3.3, 3.8 and 3.25. These are native-platform references, adapted to CSS pixels and PWA browser constraints, not a promise of platform-native controls.
- **[Material 3 easing/duration](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs):** short 50–200ms, medium 250–400ms and long 450–600ms categories, standard `cubic-bezier(0.2,0,0,1)`. The current page explicitly says this older system is no longer maintained in favor of Expressive motion physics; it remains usable for transitions/teams not migrating. OYO intentionally takes a small CSS-first duration system, not the whole Expressive model. Our optional spring presets are product choices, not copied Material constants.
- **[Emil Kowalski: 7 Practical Animation Tips](https://emilkowal.ski/ui/7-practical-animation-tips) and [Animations on the Web](https://animations.dev/):** immediate press feedback, avoid scaling from zero, place transform origins at the source, avoid slow/frequently repeated ornament. OYO uses scale .98 for filled buttons and no animated numeric input; the article's .97 example is not a mandatory universal value.
- **[Radix accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility), [Dialog](https://www.radix-ui.com/primitives/docs/components/dialog), [Radio Group](https://www.radix-ui.com/primitives/docs/components/radio-group):** accessible naming, focus return, Escape and conventional keyboard interactions. Reference demos are still subject to app-level testing and OYO hit-size/theme overrides.
- **[Sonner](https://sonner.emilkowal.ski/), [Vaul](https://vaul.emilkowal.ski/), [Vaul maintenance notice](https://github.com/emilkowalski/vaul), [Embla stable v8](https://www.embla-carousel.com/docs/v8):** use one toast root, be explicit about drawer maintenance/reduced motion, and avoid autoplay. A CSS-scroll-snap photo viewport is the first choice. See measured costs and conditions in §5.
- **[React Router view transitions](https://reactrouter.com/how-to/view-transitions) and [ScrollRestoration](https://reactrouter.com/api/components/ScrollRestoration):** the existing data router is sufficient. Current docs mark the older React18-compatible transition API deprecated, but still working; do not copy the React19.3 `<ViewTransition>` recipe into this stack. Scope snapshots to route content and keep restoration/focus independent of animation.

**Evidence gap:** no VoiceOver/TalkBack, installed-PWA safe-area/keyboard, touch gesture, production-frame-rate or reduced-motion behavior was certified by browsing external references. Those are explicit implementation acceptance items in §6, not implied by a polished screenshot.

### Retained Screenshot Index

Each image is a browser viewport capture, compressed to WebP at ≤150,000 bytes. Mobile references are captured at 390 × 844 CSS px; desktop references at 1200 × 900. The contact sheet is an overview; inspect individual files for detail. All are internal development references, not app assets; none is placed under `web/public` or imported by app code.

| Ref                                         | Capture and Chosen Lesson                           | Source / License                                                                                                                                | Size     |
| ------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| [01](design-refs/01-buttons.webp)           | Buttons: weight and affordance · 1200 × 900         | [shadcn/ui](https://v3.shadcn.com/docs/components/button) · [MIT](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)                         | 25,690 B |
| [02](design-refs/02-tabs.webp)              | Tabs: selected state and panels · 1200 × 900        | [shadcn/ui](https://v3.shadcn.com/docs/components/tabs) · [MIT](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)                           | 32,640 B |
| [03](design-refs/03-segmented-control.webp) | Segmented control: compact selection · 1200 × 900   | [shadcn/ui](https://v3.shadcn.com/docs/components/toggle-group) · [MIT](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)                   | 27,450 B |
| [04](design-refs/04-distance-slider.webp)   | Slider: direct manipulation · 1200 × 900            | [shadcn/ui](https://v3.shadcn.com/docs/components/slider) · [MIT](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)                         | 26,152 B |
| [05](design-refs/05-bottom-sheet.webp)      | Sheet: bounded vertical surface · 390 × 844         | [shadcn/ui](https://v3.shadcn.com/docs/components/drawer) · [MIT](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)                         | 9,186 B  |
| [06](design-refs/06-toast.webp)             | Toast: quiet anchored confirmation · 1200 × 900     | [Sonner](https://sonner.emilkowal.ski/) · [MIT](https://github.com/emilkowalski/sonner/blob/main/LICENSE.md)                                    | 18,316 B |
| [07](design-refs/07-skeleton.webp)          | Loading: shape before content · 1200 × 900          | [shadcn/ui](https://v3.shadcn.com/docs/components/skeleton) · [MIT](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)                       | 25,762 B |
| [08](design-refs/08-photo-carousel.webp)    | Photos: bounded horizontal scrolling · 1200 × 900   | [shadcn/ui](https://v3.shadcn.com/docs/components/carousel) · [MIT](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)                       | 25,450 B |
| [09](design-refs/09-progress.webp)          | Progress: stable numeric context · 1200 × 900       | [shadcn/ui](https://v3.shadcn.com/docs/components/progress) · [MIT](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)                       | 28,704 B |
| [10](design-refs/10-weekly-chart.webp)      | Stats: readable axes and tooltips · 1200 × 900      | [shadcn/ui](https://v3.shadcn.com/docs/components/chart) · [MIT](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)                          | 45,620 B |
| [11](design-refs/11-overflow-menu.webp)     | Menu: secondary actions · 1200 × 900                | [shadcn/ui](https://v3.shadcn.com/docs/components/dropdown-menu) · [MIT](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)                  | 33,444 B |
| [12](design-refs/12-edit-dialog.webp)       | Dialog: focused edit task · 1200 × 900              | [shadcn/ui](https://v3.shadcn.com/docs/components/dialog) · [MIT](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)                         | 20,008 B |
| [13](design-refs/13-signup-form.webp)       | Forms: persistent labels and errors · 1200 × 900    | [shadcn/ui](https://v3.shadcn.com/docs/components/form) · [MIT](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)                           | 34,464 B |
| [14](design-refs/14-settings-switch.webp)   | Settings: explicit toggle label · 1200 × 900        | [shadcn/ui](https://v3.shadcn.com/docs/components/switch) · [MIT](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)                         | 27,686 B |
| [15](design-refs/15-ranking-table.webp)     | Leaderboard: aligned numeric rows · 1200 × 900      | [shadcn/ui](https://v3.shadcn.com/docs/components/table) · [MIT](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)                          | 38,606 B |
| [16](design-refs/16-profile-card.webp)      | Profile: quiet information grouping · 1200 × 900    | [shadcn/ui](https://v3.shadcn.com/docs/components/card) · [MIT](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)                           | 31,324 B |
| [17](design-refs/17-inline-empty.webp)      | Empty/error: in-place explanation · 1200 × 900      | [shadcn/ui](https://v3.shadcn.com/docs/components/alert) · [MIT](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)                          | 27,154 B |
| [18](design-refs/18-drag-sheet.webp)        | Sheet: handle, title, scrollable body · 390 × 844   | [Vaul](https://vaul.emilkowal.ski/) · [MIT](https://github.com/emilkowalski/vaul/blob/main/LICENSE.md)                                          | 17,220 B |
| [19](design-refs/19-zone-radio.webp)        | Zone choice: exclusive radio semantics · 1200 × 900 | [Radix website](https://www.radix-ui.com/primitives/docs/components/radio-group) · [MIT](https://github.com/radix-ui/website/blob/main/LICENSE) | 44,984 B |
| [20](design-refs/20-scroll-area.webp)       | Scroll: bounded content surface · 1200 × 900        | [Radix website](https://www.radix-ui.com/primitives/docs/components/scroll-area) · [MIT](https://github.com/radix-ui/website/blob/main/LICENSE) | 38,156 B |

### Licensing and Attribution

Full upstream permission notices are preserved in [design-refs/LICENSES.md](design-refs/LICENSES.md). This is not a license grant over third-party brands or external images. Retained frames contain the open-source demo UI/documentation only; the external avatar/photo demo was deliberately excluded. Never transplant a source site's branding, illustration, avatar, marketing photograph or proprietary template into OYO.

- shadcn/ui, copyright © 2023 shadcn, MIT: [source and license](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md). Captures use the v3 documentation to match Tailwind3/React18 rather than copying newer Tailwind4/Base UI examples into this stack.
- Sonner and Vaul, copyright © 2023 Emil Kowalski, MIT: [Sonner license](https://github.com/emilkowalski/sonner/blob/main/LICENSE.md), [Vaul license](https://github.com/emilkowalski/vaul/blob/main/LICENSE.md).
- Radix website/documentation, copyright © 2024 WorkOS, MIT: [website license](https://github.com/radix-ui/website/blob/main/LICENSE). Primitive behavior is separately documented by [Radix accessibility guidance](https://www.radix-ui.com/primitives/docs/overview/accessibility).

### Design Skills Applied

- [unslop](https://github.com/heydamir/unslop), by Damir Sokolovsky, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): quiet chrome, product-specific signature detail, deliberate hierarchy and no generic animated decoration. Skill inspected outside this repo; no source/assets vendored.
- [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill): touch, focus, reduced-motion, chart and React guidance searched. Its generic generated teal palette, editorial font pairing and showcase layout were rejected because the explicit OYO brief takes precedence.
- [Impeccable](https://github.com/pbakaus/impeccable): Operate-mode familiarity, motion as feedback/continuity, specific empty states and progressive enhancement. This is a research/specification task with a pinned product direction, not a new-screen/redesign workflow; no app rebuild, PRODUCT.md interview, generated concepts or visual-world replacement was undertaken.
