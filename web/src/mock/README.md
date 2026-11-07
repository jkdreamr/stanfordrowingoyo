# Development mock

Run `VITE_MOCK=1 npm run dev:web`. Mock handlers, generated images and fixtures are development-only and mutations reset on reload. Session selection persists.

- Default rower: `marcus.albrecht@stanford.edu` / `password` (Marcus Albrecht, 48,000 / 80,000 E-meters this week)
- Staff: `joskoo@stanford.edu` / `password` (Joshua Koo)
- Team join code: `cardinal-oyo`

The owner-provided roster has 35 rowers, three coxswains and Joshua Koo. Only Joshua has a roster email. Synthetic demo login emails for claimed athletes are not roster invitations. Twenty-nine rowers, two coxswains and Joshua are pre-claimed; six rowers and Ginger Bernstein remain available for signup. No coach is seeded.

Signup resolves names with `POST /api/auth/roster`, then claims a roster ID with the chosen group and preferred email. Staff skip group selection. Config is authenticated, so the pre-login group picker shows labels only, never hard-coded target numbers. The invite-email path skips roster lookup. Joshua is already claimed in the demo, so that email returns 409 on signup; fresh-state tests explicitly free his roster row to verify successful bootstrap signup.

Staff unlinking deactivates the account and frees the roster name. Renaming a claimed row also renames the linked user. Group changes refresh current group-derived targets, stats and leaderboard; existing personal targets remain authoritative.

Password changes verify the current password with `POST /api/me/password/verify`, then send the returned `reauth_token` with `new_password` to `POST /api/me/password`. Grants expire after five minutes, are single-use and session-bound, and are revoked on password changes/reset or session replacement. Forced temporary-password changes send only `new_password`. Errors use the backend's `INVALID_CREDENTIALS`, `REAUTH_REQUIRED`, `UNAUTHENTICATED`, `CREDENTIALS_CHANGED` and `VALIDATION_ERROR` codes. The injectable mock clock controls grant expiry.
