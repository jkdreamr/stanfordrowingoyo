# OYO launch splash

## Direction contract

**Thesis:** a brief brand launch, not a poster, onboarding or an advertisement. No tagline,
progress indicator, dismissal action, or additional navigation.

**Own-world:** retain the incumbent system sans stack and Stanford cardinal. The
cardinal field is uninterrupted: the crew photograph is dropped entirely, rather
than making a sports poster into a washed-out texture. Gabriel's circular portrait
and the short OYO wordmark form one centered lockup.

**Story:** recognize the mark, then enter the current app route automatically. The
portrait is enhancement, never a prerequisite for entering the app.

**First viewport:** viewport-filling cardinal, an 84px portrait inside a 96px thin
white ring, and a 28px medium-weight OYO wordmark with 0.14em tracking. Center the
lockup in the viewport, clear of both safe areas.

**Form:** user-pinned launch overlay extending the existing visual system, not a
new visual world. Code-led implementation; seed: none (brief-pinned).

**Signature:** a 350ms mark entrance (0.8 → 1.035 → 1), with a two-part white ring
draw and an 80ms-staggered rising wordmark. The arrival uses Impeccable's
`cubic-bezier(0.16, 1, 0.3, 1)`. The requested small spring overshoot is explicit,
not a looping bounce. The ring reveal rotates two statically clipped half-strokes;
only transform and opacity animate, including during exit. No new dependency.
Reduced motion uses a static mark/ring/wordmark and a 120ms opacity-only exit.
React retains the original HTML element until auth settles, with identical inline
layout, type and pseudo-element box sizing before and after the bundle loads.

## Lifecycle

- The HTML paints before the React bundle executes. It starts the elapsed timer
  and fades in successfully loaded local images without waiting for React.
- React observes the existing `/api/me` query, including retries and error/401
  completion. Minimum display is 600ms from the inline script, not from React mount.
- After readiness, at most the remaining 600ms minimum plus a 250ms exit remains
  (850ms maximum, below the 1.2s budget). Image loading never enters this decision.
  If auth takes longer, it remains visible until auth resolves as before.
- Exit scales the emblem to 1.08 and fades it while the cardinal overlay crossfades
  into the app over 250ms. Reduced motion removes all spatial movement.
- The root is inert until exit starts; the splash never takes keyboard focus.
  Exit releases the app and restores its resolved light/dark browser theme color.
- Removal is permanent for that document. Navigation, focus, visibility changes,
  and returning from the background cannot recreate it. A new document starts anew.
- The PWA launch background matches cardinal; all existing manifest icons remain
  unchanged. Local WebP assets are included in the normal app-shell cache.

## Official image sources

Retrieved November 7, 2026. The portrait is bundled; no runtime hotlinks.

### Team (previous direction; intentionally removed in v2)

The latest men's-rowing roster (2026–27) uses an oar/logo placeholder for its
`team_photo`. The latest completed men's-team season review instead supplies a
posed crew photograph, titled **1V8 at IRA**, credited **Stockton Photo**. The newer
sport-home news items concern individual/alumni international racing, not the
Stanford crew. This provenance is retained for the original asset decision; neither
team-photo resolution is bundled, fetched or precached in the v2 launch.

- Official page: <https://gostanford.com/news/2026/06/28/2026-season-in-review-mrow>
- Original image: <https://storage.googleapis.com/stanford-prod/2026/06/28/N5NfBS9Z596Dx4Qbr25KY1rLJO8kPUq89D37llNq.jpg>
- Original dimensions: 2000 × 1125.

### Gabriel George

Gabriel is on the **men's rowing** roster; the live roster/profile currently
resolve to **2026–27**. His portrait is used only on this splash, with his consent
as supplied in the brief, never as an app/manifest icon.

- Official page: <https://gostanford.com/sports/mens-rowing/roster/player/gabriel-george>
- Season page: <https://gostanford.com/sports/mens-rowing/roster/season/2026-27/player/gabriel-george>
- Original image: <https://storage.googleapis.com/stanford-prod/2026/02/05/ub5jQtqqez0avMsDFVPHxxtL95aDx3lIZTANGCm7.jpg>
- Original dimensions: 714 × 1000; square crop `(0, 0, 714, 714)`.
- `web/public/splash/gabriel-96.webp`: 96 × 96, 1,330 bytes.
- `web/public/splash/gabriel-192.webp`: 192 × 192, 3,488 bytes (2×).

All assets use WebP quality 76, method 6; their EXIF image descriptions preserve
the official page provenance. Combined: **4,818 bytes (4.7 KiB)** across both
portrait variants. The v2 choice removes 159,524 image bytes from the app shell.
