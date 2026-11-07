## Implementation notes

- Use daily totals from `SeasonStats.days` on `GET /api/stats/season`; compute cumulative mileage and daily target pace client-side. All fetches every preceding season back to the season starting in 2024 in parallel, including empty seasons. The API has no earliest-entry bound, and backdated entries can predate account creation, so `created_at` is not a reliable history floor. Do not add `/api/stats/series`.
- Every workout is team-visible. Other rowers' charts show the same workout totals as their own charts and the leaderboard.

## 2. Season mileage chart spec

### 2.1 What the Robinhood chart does (research)

- Robinhood says its charts let you pick time spans and "select and hold" a point to see the value at that date or
  time ([Robinhood: Viewing stock details](https://robinhood.com/us/en/support/articles/viewing-stock-detail-pages/)).
- Robinhood says the portfolio chart reflects investment returns and excludes deposits and withdrawals from the
  return ([Robinhood: Using charts](https://robinhood.com/us/en/support/articles/using-charts/)).
- A third-party walkthrough describes tap-hold-drag scrubbing on mobile, hover on web, a dotted previous-close line
  on the one-day view, and the line turning green above or red below the reference value
  ([Bluechip](https://blog.bluechip.dev/how-to-read-the-robinhood-stock-details)).
- Google's design case study says Robinhood uses color to communicate portfolio change and keeps the screen focused
  on a few numbers ([Google Design](https://design.google/library/robinhood-investing-material)).
- The owner's attached screenshot shows: an account name, a large value ("$150.00") with a small delta below it
  ("▲ $0.00 (0.00%)"), a thin line with no axes or gridlines, a vertical scrub rule with the date ("Jul 31, 2026")
  printed above it and a dot on the line, a flat stretch at the start followed by a jump, and range tabs
  1D / 1W / 1M / 3M / YTD / 1Y / ALL under the chart with the selected tab in the accent color (source: owner
  attachment in the request).
- Kalshi's chart draws a step line, because price stays flat between trades, and offers range tabs from LIVE to ALL
  ([Kalshi Pro charts](https://kalshi.com/pro/help/charts)).
- Strava's Fitness & Freshness chart (an impulse-response load model) lets you click a point to see that day's
  values ([Strava support](https://support.strava.com/en-us/articles/15402032-how-fitness-freshness-is-calculated)).
- Haptics: the Vibration API is not implemented in Safari or any iOS browser, and Firefox removed it in version 129
  ([W3C implementation report](https://w3c.github.io/vibration/reports/implementation.html),
  [caniuse](https://caniuse.com/vibration)).
- Robinhood retired its confetti animation in 2021 after criticism that the app gamified trading
  ([Reuters](https://www.reuters.com/technology/robinhood-scrap-confetti-animation-app-after-gamification-criticism-2021-03-31/)),
  and in January 2024 agreed to a $7.5 million Massachusetts settlement over "gamification" features including
  confetti and a scratch-off style reward reveal
  ([Reuters](https://www.reuters.com/legal/transactional/robinhood-settles-massachusetts-regulators-trading-case-75-million-2024-01-18/),
  [consent order](https://www.sec.state.ma.us/divisions/securities/download/RH-Consent-Order.pdf)).
  **Inference:** borrow the calm chart, not the casino feedback (no confetti, no slot-style reveals).

### 2.2 The line

- **Value plotted:** for each Pacific calendar day `d` in the range, the rower's cumulative E-meters from the season
  start through the end of `d`: `cum(d) = sum(entries.equiv_m where season_start <= date <= d)`.
- Uses the stored `equiv_m` exactly as the app already computes it (distance × mode factor × zone factor, snapshotted
  per entry, per [ARCHITECTURE.md §2](./ARCHITECTURE.md)). The chart never uses game-capped meters (section 7); it is
  the real mileage record. **Inference:** mixing the game's capped number into the mileage line would make two
  numbers disagree on the same screen.
- Every workout counts, matching the team-visible entry policy
  ([ARCHITECTURE.md §6](./ARCHITECTURE.md)). Viewing another rower's profile shows the same total.
- One point per day, including zero days, joined with straight segments. **Inference:** daily points make rest days
  read as flat stretches, which is the honest picture and matches the flat-then-jump look in the owner's screenshot.
- Reference line: a thin dashed neutral line for **target pace**: the sum of weekly targets for completed weeks, plus
  the current week's target × (days elapsed this week / 7). Targets come from the existing versioned
  `weekly_targets` lookup. Coxswains with no target get no pace line.
- Colors: line cardinal `#8C1515` at 2px; pace line `#9A9AA1` dashed at 1px; scrub dot cardinal. No fill, no
  gradient, no glow. Orange `#FC5200` only on the marker of a best week or for a target-hit day, as the architecture
  reserves orange for those highlights ([ARCHITECTURE.md §7](./ARCHITECTURE.md)).
- No y-axis, no gridlines. Season and All ranges start the y-domain at 0. 1W, 1M and 3M use
  `[min(range), max(range, pace)]` with 8% padding, so growth within a short range is visible.

### 2.3 Header value and delta

| State                | Big number                           | Delta line                                                      |
| -------------------- | ------------------------------------ | --------------------------------------------------------------- |
| Resting, any range   | Season total today, e.g. `412,350 m` | `+38,200 m past month` (meters added within the selected range) |
| Resting, second line |                                      | `6,100 m ahead of target pace` or `4,300 m behind target pace`  |
| Scrubbing            | `cum(d)` at the scrubbed day         | `+x m since <range start>` and the pace gap on that day         |
| All tab              | Lifetime total across seasons        | `+x m this season`                                              |

- Delta is meters added in the range, never a percentage. **Inference:** "+0.8%" of a season total says nothing
  useful to a rower; meters match how the team talks about volume.
- The delta is never negative, so there is no up/down arrow and no green/red. "Ahead of pace" uses primary text;
  "behind pace" uses secondary gray text. **Inference:** red would read as failure in front of teammates, and the
  brand cardinal is itself a red, so red-for-bad would make the accent ambiguous.
- Numbers use tabular figures with thousands separators and a plain "m" unit. No uppercase labels, no monospace.

### 2.4 Range tabs

`1W · 1M · 3M · Season · All`, under the chart, like the screenshot. Default: `Season`.

- `1W`: this Monday through today (Pacific), matching the team's Monday–Sunday week.
- `1M`: the last 4 full weeks plus this week. `3M`: the last 12 full weeks plus this week. Aligning to Mondays keeps
  week boundaries consistent with the leaderboard.
- `Season`: season start (default Sep 1, staff-editable) through today.
- `All`: first entry ever through today, plotted as a lifetime total, with one point per week once the range passes
  400 days.
- 1D and 1Y are dropped. **Inference:** one day of training has one or two sessions, and the season already covers a
  year. YTD is replaced by Season because the training year starts Sep 1.
- Tabs are buttons at least 44px tall ([ARCHITECTURE.md §7](./ARCHITECTURE.md)), selected tab in cardinal text with a
  2px underline.

### 2.5 Scrub behavior

- **Touch:** press and drag horizontally on the plot. A 1px vertical rule and a dot snap to the nearest day, the date
  ("Tue, Oct 14") is printed above the rule, and the header switches to that day. On release, the header and line
  return to today.
- **Mouse:** hover scrubs; leaving the plot resets.
- **Keyboard:** the plot is focusable (`role="img"` with an `aria-label` summary, plus `tabindex="0"`). Left/Right move
  one day, Home/End jump to the range ends, Escape resets. The header sits in an `aria-live="polite"` region that
  updates on keyboard moves only, so drags don't flood screen readers.
- **Scrolling:** the plot container sets `touch-action: pan-y`, so vertical swipes still scroll the page and
  horizontal drags reach the chart. MDN notes the browser fires `pointercancel` when it takes over a gesture the page
  didn't opt out of ([MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)). Call
  `setPointerCapture` on `pointerdown` so the drag keeps tracking outside the SVG
  ([MDN setPointerCapture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture)). Avoid
  `touch-action: none` on the whole chart, which MDN warns can block zooming.
- **Haptics:** if `navigator.vibrate` exists, fire a 5ms pulse when the cursor crosses a Monday. Do nothing otherwise.
  This only runs on Chromium-based Android browsers (W3C report above); iOS gets no haptics.
- **Motion:** no draw-in animation. Range changes swap the path instantly. **Inference:** this satisfies
  `prefers-reduced-motion` by default and avoids the glossy feel the owner dislikes.

### 2.6 Empty and flat-start states

- **No entries this season:** big number `0 m`, delta line "No sessions logged this season", a flat cardinal line
  along the bottom across the whole range, the dashed pace line rising above it, and one button "Log a session" that
  opens the existing Log flow. **Inference:** the flat line plus rising pace line mirrors the screenshot's flat start
  and tells the rower what to do.
- **Few entries:** the line stays flat at the start of the range and steps up on each logged day, as in the screenshot.
- **Range with no new meters (e.g. 1W on a Monday morning):** flat line at the current total, delta `+0 m this week`.
- **Coxswain or no target:** no pace line and no pace text.
- **Loading:** a gray placeholder block with the chart's height. No shimmer.

### 2.7 Implementation pick

**Pick: hand-rolled SVG with pointer events, no new dependency.**

| Option                     | Approx. size (gzip)       | Notes                                                                           |
| -------------------------- | ------------------------- | ------------------------------------------------------------------------------- |
| Hand-rolled SVG            | 0 KB dependency           | Daily cumulative series is at most ~366 points per season.                      |
| visx (`@visx/*`)           | 24.6 KB (measured bundle) | Low-level React primitives; v4.0.0 released June 2026 with React 18/19 support. |
| Chart.js + react-chartjs-2 | 54.2 KB                   | Canvas; custom scrub header means fighting its tooltip system.                  |
| uPlot                      | ~50 KB minified           | Canvas, built for very large time series.                                       |
| Recharts                   | 116 KB                    | Heavy for one line.                                                             |

Sizes come from one third-party measurement of a sample chart ([We.Inc](https://we.inc/guides/react-chart-libraries)),
uPlot's own README ([GitHub](https://github.com/leeoniya/uPlot)) and the visx release page
([GitHub](https://github.com/airbnb/visx/releases/tag/v4.0.0)); treat them as indicative.

**Inference, reasons:** the app needs one line, one dashed line, one cursor and one dot. With `viewBox` scaling,
`x = i * w / (n - 1)`, a path string, and index lookup from `pointer.x`, the component is roughly 150–200 lines, has
no dependency to maintain, and matches the Tailwind styling directly. If the app later grows several chart types,
`@visx/scale` and `@visx/shape` are the upgrade path.

Component sketch (illustrative, not code to ship):

```
<SeasonChart series={[{ date, cum_m }]} pace={[{ date, cum_target_m }]} range onRangeChange />
  state: scrubIndex: number | null
  header: scrubIndex == null ? last : series[scrubIndex]
  svg: <path d=line />, <path d=pace stroke-dasharray />, rule + dot when scrubbing
  handlers: pointerdown (capture) / pointermove / pointerup / pointercancel / pointerleave / keydown
```

### 2.8 API

**Inference:** the existing `GET /api/stats/season` returns a weekly series ([ARCHITECTURE.md §6](./ARCHITECTURE.md)),
which is too coarse for scrubbing by day. Proposed addition (needs a matching `shared/types.ts` change when adopted):

```
GET /api/stats/series?range=1W|1M|3M|season|all&user=<id>
→ { range, start: 'YYYY-MM-DD', end: 'YYYY-MM-DD',
    header: { total_m, range_delta_m, pace_gap_m | null },
    points: [{ date, cum_m, day_m }],
    pace: [{ date, cum_target_m }] | null }
```

One `SELECT date, SUM(equiv_m) ... GROUP BY date` on the existing `(user_id, date)` index, then a running sum in the
Worker.
