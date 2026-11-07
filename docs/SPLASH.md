# OYO launch splash

## Direction contract

**Thesis:** a brief team portrait, not onboarding or an advertisement. No tagline,
progress indicator, dismissal action, or additional navigation.

**Own-world:** retain the incumbent system sans stack and Stanford cardinal. The
official crew photograph is the only full-bleed visual; Gabriel's circular portrait
and the short OYO wordmark form one quiet, lower-centered lockup.

**Story:** recognize the team, then enter the current app route automatically. The
photograph is enhancement, never a prerequisite for entering the app.

**First viewport:** viewport-filling cardinal, a loaded-only team photograph and
contrast scrim, a 96px portrait with a white rim, and a 64px white OYO wordmark.
Keep the lockup clear of the bottom safe area.

**Form:** user-pinned launch overlay extending the existing visual system, not a
new visual world. Code-led implementation; seed: none (brief-pinned).

**Signature:** a single restrained 420ms settling motion; reduced motion makes
the composition static. React retains the original HTML element until auth settles.

## Lifecycle

- The HTML paints before the React bundle executes. It starts the elapsed timer
  and fades in successfully loaded local images without waiting for React.
- React observes the existing `/api/me` query, including retries and error/401
  completion. Minimum display is 600ms from the inline script, not from React mount.
- After readiness, at most the remaining 600ms minimum plus a 180ms exit remains
  (780ms maximum, below the 1.2s budget). Image loading never enters this decision.
- The root is inert until exit starts; the splash never takes keyboard focus.
  Exit releases the app and restores its resolved light/dark browser theme color.
- Removal is permanent for that document. Navigation, focus, visibility changes,
  and returning from the background cannot recreate it. A new document starts anew.
- The PWA launch background matches cardinal; all existing manifest icons remain
  unchanged. Local WebP assets are included in the normal app-shell cache.

## Official image sources

Retrieved November 7, 2026. Bundled copies only; no runtime hotlinks.

### Team

The latest men's-rowing roster (2026–27) uses an oar/logo placeholder for its
`team_photo`. The latest completed men's-team season review instead supplies a
posed crew photograph, titled **1V8 at IRA**, credited **Stockton Photo**. The newer
sport-home news items concern individual/alumni international racing, not the
Stanford crew. Use the June 2026 crew photograph, not the placeholder banner.

- Official page: <https://gostanford.com/news/2026/06/28/2026-season-in-review-mrow>
- Original image: <https://storage.googleapis.com/stanford-prod/2026/06/28/N5NfBS9Z596Dx4Qbr25KY1rLJO8kPUq89D37llNq.jpg>
- Original dimensions: 2000 × 1125.
- `web/public/splash/team-480.webp`: 480 × 270, 36,808 bytes.
- `web/public/splash/team-960.webp`: 960 × 540, 122,716 bytes (phone retina).

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
the official page provenance. Combined: **164,342 bytes (160.5 KiB)** across all
four variants, below 250 KB even counting both resolutions.
