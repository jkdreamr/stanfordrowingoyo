# Season chart and training game: research and design

Status: research and design only. Nothing here is implemented, and nothing here changes the product contract in
[ARCHITECTURE.md](./ARCHITECTURE.md) until engineers adopt it there and in `shared/types.ts`.

Research cutoff: November 6, 2026. This is product research, not legal advice or an NCAA interpretation.

How to read this document:

- Factual claims carry a source link in the same sentence or bullet.
- Every design judgment, recommendation, or extrapolation from a source is marked **Inference**.
- Facts about this app (formulas, tables, routes, colors) come from [ARCHITECTURE.md](./ARCHITECTURE.md).
- No reference images are included: none of the product screenshots found during research came with clear
  reuse permission, so `docs/game-refs/` is intentionally not created.

## Contents

1. [Summary](#1-summary)
2. [Season mileage chart spec](#2-season-mileage-chart-spec)
3. [Existing play-money and stake mechanics](#3-existing-play-money-and-stake-mechanics)
4. [Behavioral evidence](#4-behavioral-evidence)
5. [Risks for a varsity team](#5-risks-for-a-varsity-team)
6. [NCAA and Stanford compliance](#6-ncaa-and-stanford-compliance)
7. [Shared game rules: counted meters, caps, verification](#7-shared-game-rules-counted-meters-caps-verification)
8. [Design 1 (recommended): Weekly Pledge](#8-design-1-recommended-weekly-pledge)
9. [Design 2: Squad Challenge](#9-design-2-squad-challenge)
10. [Design 3 (not recommended): Teammate prediction market](#10-design-3-not-recommended-teammate-prediction-market)
11. [Recommendation and MVP scope](#11-recommendation-and-mvp-scope)
12. [Sources](#12-sources)

## 1. Summary

- **Chart.** The owner decided the Robinhood-style chart shows a rower's cumulative E-meters through the season, with
  range tabs and scrubbing. Section 2 specifies it. **Inference:** because cumulative meters never go down, the
  gain/loss color flip does not apply; the meaningful comparison is against a dashed target-pace line, and being behind
  pace is shown in neutral gray, never red.
- **Game.** The owner suggested "betting on yourself". The strongest evidence for lasting behavior change is
  for self-commitment devices (Giné, Karlan and Zinman's commitment contract; Royer, Stehr and Sydnor's gym study) and
  for loss-framed point systems without cash (BE FIT), with competition and team accountability adding more (STEP UP;
  Babcock et al.). Sources in section 4.
- **Recommendation (Inference).** Build Design 1, the Weekly Pledge: each Monday a rower pledges to hit 100%, 110% or
  120% of their own weekly target. Points are held at the start of the week and kept only if the pledge is hit. Points
  count capped meters only, cannot be bought, traded, transferred or redeemed, and there are no prizes. A small team
  bonus kicks in when most of the team hits its pledges. Pledging against teammates is deliberately excluded.
- **NCAA (Inference from the bylaw text).** Bylaw 10.3 covers "any institutional practice", and "wagering involving
  own team" is the most severe reinstatement category, so no design should let rowers stake anything on teammates.
  A wager under 10.02.2 requires giving up "an item of value"; valueless, nonredeemable points with no prizes give the
  strongest argument that the game is not a wager, but no NCAA ruling on that exact case was found. Get written
  clearance from Stanford Compliance before piloting. Details in section 6.

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
- Private entries count, matching the existing rule that private entries count toward the owner's totals
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

## 3. Existing play-money and stake mechanics

| Product                      | Core mechanic (fact)                                                                                                                                                                                                                                                                                                                                                                        | Verification (fact)                                                                                                                              | Useful for OYO (**Inference**)                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| DietBet                      | Players pay into a pot, try to lose 4% in 4 weeks, winners split the pot ([DietBet](https://www.dietbet.com/kickstarter/how-it-works)).                                                                                                                                                                                                                                                     | Photo weigh-ins with a weigh-in word, reviewed by referees ([FAQ](https://www.dietbet.com/faq)).                                                 | Fixed, short game windows; proof photos for outliers. The cash pot is exactly what we cannot copy.     |
| StepBet / WayBetter          | Personalized step goals from your own history; a weekly mix of "Active" and "Power" days plus rest days; miss a week and you are out; winners split the pot ([WayBetter](https://support.waybetter.app/hc/en-us/articles/9077538287507), [StepBet](https://stepbet.com/faq/create-game)).                                                                                                   | Data comes from connected trackers (same sources).                                                                                               | Goals relative to your own baseline, with built-in rest days. Strong template for a self pledge.       |
| HealthyWage                  | You choose a goal and a wager amount; a prize calculator sets the payout if you hit it ([HealthyWage FAQ](https://www.healthywage.com/healthywager/faq/)).                                                                                                                                                                                                                                  | Video weigh-ins (same source).                                                                                                                   | "Bet on yourself" in its purest form, but with money. Pick the stretch level yourself.                 |
| stickK                       | Commitment contract: goal, deadline, optional stakes sent to a friend, charity or anti-charity, a referee confirms reports ([stickK](https://stickk.zendesk.com/hc/en-us/articles/206109308-What-is-stickK)).                                                                                                                                                                               | Referee.                                                                                                                                         | Commitment without money still has a public promise and a referee. Coxswains can play referee.         |
| Sweatcoin                    | Steps convert to a currency after an algorithm checks location, speed and consistency ([Sweatcoin](https://sweatco.in/verification-algorithm)).                                                                                                                                                                                                                                             | Automated anomaly checks (same source).                                                                                                          | Automated plausibility rules before human review.                                                      |
| Strava challenges and clubs  | Group Challenges: most activity, fastest effort, longest single activity, or a shared group goal ([Strava](https://support.strava.com/en-us/articles/15401736)); club leaderboards reset weekly ([Strava clubs](https://support.strava.com/en-us/articles/15402172-clubs-on-strava)).                                                                                                       | Community flagging of questionable activities ([Strava](https://support.strava.com/en-us/articles/15402146-how-do-i-report-cheating-on-strava)). | The team already has the weekly leaderboard. A shared team goal is the missing piece.                  |
| Duolingo streaks and leagues | Streaks, a streak freeze bought in advance, and streak repair ([Duolingo help](https://www.duolingo.com/help/what-is-a-streak)); weekly leagues with promotion ([Duolingo blog](https://blog.duolingo.com/duolingo-leagues-leaderboards/)).                                                                                                                                                 | Not applicable.                                                                                                                                  | Streak protection for planned rest, illness or exams; see the evidence in section 4.                   |
| Peloton                      | "Here Now" leaderboard of people in the same class and virtual high fives ([Peloton](https://support.onepeloton.com/s/article/16084878507540-Peloton-Leaderboard?language=en_US)).                                                                                                                                                                                                          | Machine data.                                                                                                                                    | Positive-only social feedback (kudos already exists).                                                  |
| WHOOP Teams                  | Private teams with leaderboards for strain, recovery and sleep ([WHOOP](https://www.whoop.com/us/en/thelocker/join-create-teams-on-whoop/)).                                                                                                                                                                                                                                                | Device data.                                                                                                                                     | Ranking recovery alongside effort; a reminder that more load is not always better.                     |
| ESPN Pick'em (confidence)    | Assign a unique confidence value to each pick; earn it if right, zero if wrong ([ESPN](https://fantasy.espn.com/games/nfl-pickem-2026/howtoplay)).                                                                                                                                                                                                                                          | Game results.                                                                                                                                    | Confidence levels map to choosing 100/110/120% pledges.                                                |
| Fantasy Premier League       | £100m budget, a 15-player squad, captain points doubled, one free transfer per gameweek, chips such as Wildcard and Triple Captain ([Premier League](https://www.premierleague.com/en/news/4681092/fpl-help-copilot), [chips](https://www.premierleague.com/en/news/4362085/how-and-when-to-use-your-chips-in-fpl)).                                                                        | Real match data.                                                                                                                                 | Limited-use "chips" are a clean way to grant rare boosts; drafting teammates is ruled out (section 6). |
| Manifold                     | Play money ("mana") that cannot be converted to cash ([Manifold FAQ](https://docs.manifold.markets/faq)); prices set by an automated market maker based on a constant-product formula ([Manifold](https://news.manifold.markets/p/above-the-fold-market-mechanics)); monthly leagues with divisions and prizes ([Manifold leagues](https://manifold.markets/community-guidelines/leagues)). | Market creators resolve markets (FAQ).                                                                                                           | Shows the full prediction-market machinery; also shows how easily "play money" leagues acquire prizes. |
| Kalshi / Polymarket UI       | Kalshi charts a step line of price with range tabs ([Kalshi](https://kalshi.com/pro/help/charts)); Polymarket market pages show outcome prices, a chart, an order book, rules and comments ([guide](https://polymarketguide.gitbook.io/polymarketguide/markets/interface)).                                                                                                                 | Exchange resolution.                                                                                                                             | The market UI is dense; the step-line chart idea is the only part worth borrowing.                     |

**Inference, pattern across products:** the ones built around changing behavior (StepBet, stickK, HealthyWage,
DietBet) all make you commit to a goal about _yourself_, scaled to _your own_ baseline, for a fixed window, with
some verification. The ones built around predicting _other people_ (Pick'em, FPL, Manifold, Kalshi, Polymarket) are
entertainment products, and the person doing the predicting is not the one doing the work.

## 4. Behavioral evidence

### 4.1 Commitment devices

- Giné, Karlan and Zinman offered smokers a voluntary savings account forfeited on a failed nicotine test: 11% took
  it up, quit rates rose about 3 percentage points at 6 months, and the effect held on a surprise test at 12 months
  ([AEJ: Applied 2010](https://www.aeaweb.org/articles?id=10.1257%2Fapp.2.4.213)).
- Royer, Stehr and Sydnor found a four-week gym incentive alone had small lasting effects, while adding an optional
  self-funded commitment contract produced longer-run changes in gym use
  ([AEJ: Applied 2015](https://www.aeaweb.org/articles?id=10.1257%2Fapp.20130327)).
- Charness and Gneezy paid students to attend a gym 8 times in a month; attendance after the payments ended was
  higher than control
  ([paper](https://faculty.econ.ucsb.edu/~charness/papers/exercise.pdf)). A larger replication by Acland and Levy
  found a smaller habit effect that decayed over the semester ([Management Science 2015](https://doi.org/10.1287/mnsc.2014.2091)).

### 4.2 Loss framing and points without money

- Prospect theory: the value function is steeper for losses than for equal gains
  ([Kahneman and Tversky 1979](https://www.econometricsociety.org/publications/econometrica/1979/03/01/prospect-theory-analysis-decision-under-risk)).
- Patel et al. gave adults a daily 7,000-step goal: a loss-framed incentive (money deposited up front and taken
  away on missed days) increased goal days versus control, while equal gain-framed and lottery incentives did not
  differ significantly from control, and no arm differed from control in follow-up after incentives stopped
  ([Annals of Internal Medicine 2016](https://www.acpjournals.org/doi/10.7326/M15-1635)).
- BE FIT used **points, not money**: each family got 70 points at the start of each week and lost 10 for each day the
  goal was missed, with levels to climb. The gamification arm hit the goal on more days than control during the
  intervention and kept part of the gain in follow-up
  ([JAMA Internal Medicine 2017](https://jamanetwork.com/journals/jamainternalmedicine/fullarticle/2655242),
  [Harvard Health summary](https://www.health.harvard.edu/blog/exercise-get-game-2017122112903)).
  **Inference:** this is the most directly transferable finding: a loss-framed, money-free points design worked.

### 4.3 Team versus individual

- STEP UP (602 adults) compared gamification with support, collaboration, or competition against control for 24
  weeks: all arms increased steps, competition the most (about 920 steps/day over control), and the competition arm
  still had about 569 more steps/day than control in the 12-week follow-up
  ([JAMA Internal Medicine 2019](https://jamanetwork.com/journals/jamainternalmedicine/fullarticle/2749761),
  [Penn CHTI](https://chti.upenn.edu/step-up)).
- Babcock et al. found team-based pay raised output 9–17% versus individual pay, that people preferred individual
  pay anyway, and that the effect was consistent with guilt and social pressure toward teammates
  ([JEEA 2015](https://academic.oup.com/jeea/article/13/5/841/2319791),
  [working paper](https://faculty.econ.ucsb.edu/~charness/papers/teams.pdf)).
  **Inference:** a team layer helps, but the same pressure turns into shaming if the app names who let the team down.
- A meta-analysis of 16 randomized trials (2,407 participants) found a small-to-medium effect of gamification on
  physical activity (Hedges g = 0.42) ([JMIR 2022](https://www.jmir.org/2022/1/e26779/)).

### 4.4 Streaks

- Duolingo reports that learners who reach a 7-day streak are 2.4 times more likely to continue the next day, and
  that separating the streak from a demanding daily goal improved retention
  ([Duolingo blog](https://blog.duolingo.com/improving-the-streak/)). Company-reported data, not peer reviewed.
- The app already computes a streak of consecutive weeks hitting target
  ([ARCHITECTURE.md §6](./ARCHITECTURE.md)).

### 4.5 When incentives stop, and overjustification

- In the Patel 2016 trial above, effects did not persist after incentives ended; in STEP UP and BE FIT, part of the
  gain persisted (sources above). **Inference:** design the game to run all season rather than as a one-off, and
  expect some decline in off weeks.
- Deci, Koestner and Ryan's meta-analysis of 128 studies found that expected tangible rewards contingent on doing,
  completing or performing a task reduced later free-choice interest, while positive verbal feedback increased it
  ([Psychological Bulletin 1999](https://pubmed.ncbi.nlm.nih.gov/10589297/)).
- In Lepper, Greene and Nisbett's study, children told to expect a reward for drawing later drew less in free time
  than children given no reward or an unexpected one
  ([JPSP 1973](https://bingschool.stanford.edu/sites/bingschool/files/1973_lepperetal.pdf)).
- Gneezy and Rustichini found that a fine for late daycare pickup increased lateness, and lateness stayed high after
  the fine was removed ([Journal of Legal Studies 2000](https://www.journals.uchicago.edu/doi/10.1086/468061)).
  **Inference:** a penalty can turn a norm ("we train") into a price ("I'll lose 10 points, fine"). Keep points small,
  keep the team norm visible, and never let points substitute for the coaches' expectations.
- **Inference, overall:** varsity rowers already have strong intrinsic and team motivation. The game should act as
  feedback and a public promise, not as payment. That also points away from prizes, for motivational reasons as
  well as compliance ones.

## 5. Risks for a varsity team

### 5.1 Overtraining and the zone factors

- Zone factors run from 0.80 (R) to 9.00 (A), so a 2k A piece on the erg counts 18,000 E-meters
  ([ARCHITECTURE.md §2](./ARCHITECTURE.md)). **Inference:** any game that rewards raw E-meters rewards stacking
  max-intensity work, which is the opposite of an aerobic base program.
- Gabbett's widely cited review links rapid increases in training load to non-contact injury
  ([BJSM 2016](https://bjsm.bmj.com/content/bjsports/50/5/273.full.pdf)). Its acute:chronic workload ratio has since
  been criticized as lacking evidence for use in load management and as partly a statistical artifact
  ([Impellizzeri et al. 2020](https://journals.humankinetics.com/view/journals/ijspp/15/6/article-p907.xml),
  [Impellizzeri et al. 2021](https://pubmed.ncbi.nlm.nih.gov/33332011/)). **Inference:** use simple caps on the
  week-to-week ramp rather than presenting an ACWR "injury risk" number.
- Rib stress fractures are reported in about 8–16% of elite rowers over a career, and review authors associate them
  with training volume changes and recommend gradual changes
  ([Br J Sports Med review](https://pubmed.ncbi.nlm.nih.gov/21985212/)).
- Mitigations: section 7 caps.

### 5.2 Log inflation and cheating

- Self-reported activity correlates only low-to-moderately with measured activity, in both directions
  ([Prince et al. 2008](https://pmc.ncbi.nlm.nih.gov/articles/PMC2588639/)).
- Concept2 monitors produce a verification code per piece, and pieces uploaded through ErgData are treated as
  verified ([Concept2 UK](https://www.concept2.co.uk/service/monitors/pm5/how-to-use/viewing-verification-code),
  [Concept2 ErgData](https://www.concept2.com/support/ergdata)).
- **Inference:** adding stakes raises the incentive to round up, mislabel zones (a D session logged as C is worth 56%
  more) or back-date entries. Mitigations: section 7.

### 5.3 Betting against teammates and shaming

- **Inference:** markets on whether a teammate will hit target create a direct reward for that teammate failing,
  inside a boat where people depend on each other, and they also create the most severe NCAA category (section 6).
- **Inference:** a public list of who missed their pledge would harness the Babcock pressure in the worst way. The
  team view shows counts only; individual pledges are visible only to the rower and staff.

## 6. NCAA and Stanford compliance

Full bylaw text was read from the 2026–27 NCAA Division I Manual (PDF dated 8/17/26), listed in the NCAA's
publications catalog ([catalog](https://ncaapublications.com/products/2026-27-ncaa-division-i-manual-pdf)) and
available as a full copy hosted by a member school ([Manual PDF](https://gozips.com/documents/download/2026/8/17/NCAA_2026-27_Manual.pdf));
the main 10.3 paragraph is also on the NCAA's own legislative database
([LSDBi 10.3](https://web3.ncaa.org/lsdbi/bylaw?ruleId=5221)).

### 6.1 The text

> **10.02.1 Sports Wagering.** Sports wagering includes placing, accepting or soliciting a wager (on a staff
> member's or student-athlete's own behalf or on the behalf of others) of any type with any individual or
> organization on any intercollegiate, amateur or professional team or contest. Examples of sports wagering include,
> but are not limited to, the use of a bookmaker or parlay card; internet sports wagering; auctions in which bids are
> placed on teams, individuals or contests; and pools or fantasy leagues in which an entry fee is required and there
> is an opportunity to win a prize.

> **10.02.2 Wager.** A wager is any agreement in which an individual or entity agrees to give up an item of value
> (e.g., cash, shirt, dinner) in exchange for the possibility of gaining another item of value.

> **10.3 Sports Wagering Activities.** The following individuals shall not knowingly participate in sports wagering
> activities or provide information to individuals involved in or associated with any type of sports wagering
> activities concerning intercollegiate, amateur or professional athletics competition: (a) Staff members of an
> institution's athletics department; (b) Nonathletics department staff members who have responsibilities within or
> over the athletics department (...); (c) Staff members of a conference office; and (d) Student-athletes.

> **10.3.1 Scope of Application.** The prohibition against sports wagering applies to any institutional practice or
> any competition (intercollegiate, amateur or professional) in a sport in which the Association conducts
> championship competition, in bowl subdivision football and in emerging sports for women.

> **10.4 Disciplinary Action.** Prospective or enrolled student-athletes found in violation of the provisions of this
> regulation shall be ineligible for further intercollegiate competition, subject to appeal for restoration of
> eligibility. (...)

Source for all five: [2026–27 DI Manual, pp. 21–22](https://gozips.com/documents/download/2026/8/17/NCAA_2026-27_Manual.pdf).
10.3.1.1 exempts only traditional wagers _between institutions_ such as rivalry games (same source).

### 6.2 Penalties

The NCAA Division I reinstatement guidelines (revised May 2025) start the analysis for "wagering involving own team"
at "permanent loss of eligibility in all sports"; bets on other teams at one's own school start at one season, own
sport at another school at 50% of a season, and other wagering is tiered by dollar amount, with education only at
$200 or less ([DI reinstatement guidelines](https://ncaaorg.s3.amazonaws.com/committees/d1/reinstate/D1SAR_CommitteeGuidelines.pdf),
[NCAA June 2023](https://www.ncaa.org/news/media-center-di-approves-changes-to-reinstatement-guidelines-for-sports-wagering-violations/),
[NCAA November 2023](https://www.ncaa.org/news/governance-di-approves-modifications-to-wagering-related-reinstatement-guidelines/)).

A 2025 Division I change that would have allowed betting on professional sports was delayed and then rescinded by
member vote on November 21, 2025, before taking effect
([NCAA November 21, 2025](https://www.ncaa.org/news/media-center-di-schools-rescind-betting-rules-change-ban-on-pro-sports-betting-remains-in-place/)),
and the 2026–27 Manual still lists professional competition in 10.3 ([Manual](https://gozips.com/documents/download/2026/8/17/NCAA_2026-27_Manual.pdf)).

### 6.3 Does rowing count, and does training count?

- Rowing is an NCAA championship sport for women; the Manual's championship list places Rowing in the women's
  column ([Manual p. 289](https://gozips.com/documents/download/2026/8/17/NCAA_2026-27_Manual.pdf),
  [NCAA rowing rules](https://www.ncaa.org/championships/playing-rules/rowing-playing-rules/)).
  **Inference:** 10.3.1 says "a sport in which the Association conducts championship competition", not "the same
  sex's championship", so do not assume men's rowing is outside 10.3. No interpretation resolving this was found.
- 10.3.1 explicitly covers "any institutional practice". **Inference:** "it's only training" is not an exemption.
  Whether self-directed OYO sessions are "institutional practice" is a question for compliance, not something to
  assume.

### 6.4 Prizes, entry fees and Stanford guidance

- Stanford Compliance summarizes the NCAA wager definition as "Entry Fee + Prize", lists fantasy leagues with entry
  fees and prizes as prohibited, and allows DAPER staff to join pools "that do not require an entry fee" such as an
  ESPN bracket challenge ([Stanford Compliance Services](https://gostanford.com/compliance)).
- The same page says DAPER staff may not place "a tangible bet or wager" on any NCAA-championship sport at any level,
  defines extra benefits, and asks staff to notify compliance before an athlete receives a potential extra benefit;
  its motto is "Ask Before You Act!", and it lists a compliance contact for men's rowing
  (same source; contact: stanfordcompliance@stanford.edu).
- The NCAA's example items of value are "cash, shirt, dinner" (10.02.2), and awards to athletes are governed
  separately by Article 16, which excludes cash and cash-equivalent gift cards and caps award value
  ([Manual pp. 167–168](https://gozips.com/documents/download/2026/8/17/NCAA_2026-27_Manual.pdf)).
- California separately addresses app-based simulated gambling with prizes of value, and says it does not make a
  game unlawful that awards no cash prizes or cash equivalents
  ([Cal. Bus. & Prof. Code 17539.1](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=17539.1)).
- No NCAA or Stanford interpretation was found that decides whether nonredeemable, workout-earned app points are
  "an item of value". **Inference:** absence of a ruling is not clearance.

### 6.5 Assessment (all Inference)

- **Lowest risk:** points that are never purchasable, transferable, redeemable or exchangeable, no entry fee, no
  prizes or privileges of any kind, and predictions only on your own training. This gives a strong textual argument
  that nothing of value is given up or gained, so there is no "wager" under 10.02.2.
- **Do not build:** anything where a rower puts points on a teammate's or the team's outcome. If anyone ever treats
  the points as valuable (a side bet paid in coffee, a coach's prize for the top scorer), the conduct maps onto
  "wagering involving own team", the category whose analysis starts at permanent loss of eligibility.
- **Prizes change the analysis.** Even small items (a shirt, a meal) are the bylaw's own examples of value. Keep the
  game prize-free; if staff ever want awards, route them through Stanford Compliance as Article 16 awards,
  disconnected from game points.
- **Words matter for how people treat it.** The UI should not use "bet", "wager", "odds", "stake", "pot" or "payout".
- **Before a pilot:** email Stanford Compliance (stanfordcompliance@stanford.edu, copying the listed men's rowing
  contact) with this section and the exact rules of the chosen design, and get a written answer.

## 7. Shared game rules: counted meters, caps, verification

Every design below uses the same safety layer. All numbers are **Inference** (proposed defaults), and all are
staff-editable settings.

### 7.1 Counted meters

The game never scores raw `equiv_m`. It scores **counted meters**, computed per rower per week:

1. Start from each entry's stored `equiv_m`.
2. **Hard-zone allowance:** meters from zones C/B, B and A count only up to 15% of the rower's weekly target per week
   (15,000 for a 100k target). Above that, they still count fully on the chart and leaderboard, just not in the game.
3. **Daily cap:** at most 35% of the weekly target counts on any one day. This stops a single huge Sunday from
   rescuing a week and nudges sessions to spread across the week.
4. **Weekly ceiling:** counted meters stop at the pledge level (at most 120% of target). Nothing is gained past it.

Why: without the hard-zone allowance, two A-zone 2k pieces (36,000 E-meters) would cover a third of a U23 week. The
cap keeps the game neutral about intensity and leaves intensity to the coaches' plan.

### 7.2 Ramp limit

A rower can pledge above 100% only if their counted meters averaged at least 90% of target over the last 3 weeks,
and never more than 110% of last week's counted meters (100% is always available). New rowers and rowers returning
from an excused week can only pledge 100%.

### 7.3 Excused weeks

Staff (coxswains, admin) can mark a rower's week as excused: injury, illness, exams, travel, or a coach-directed down
week. An excused week returns any held points and keeps the streak intact. Rowers can also request one, with a short
note; staff approve. There is no limit for staff-granted excuses. **Inference:** this replaces Duolingo's purchasable
streak freeze, which would let points buy rest, with a human decision that treats rest as part of training.

### 7.4 Staff controls

- Game on/off for the whole team, and per rower (opt-out is always available to the rower too).
- Edit caps, ramp limit, pledge levels, points values.
- Excuse a week; void a pledge; adjust points with a required reason (written to `audit_log`).
- Pause the game during race weeks or exam periods with one switch.

### 7.5 Anomaly flags and verification

Flags are computed when an entry is created or edited, and shown to staff in the existing Admin compliance view.
They never block logging and are never shown to other rowers.

| Rule                                                                                   | Default |
| -------------------------------------------------------------------------------------- | ------- |
| Single entry above 40% of weekly target                                                | flag    |
| Erg split faster than the rower's best 2k split, or zone pace far from their zone pace | flag    |
| Entry created or edited after Sunday 23:59 for the week being settled                  | flag    |
| Entry dated more than 2 days before it was created                                     | flag    |
| More than 3 entries in a day, or more than 2 hard-zone entries in a week               | flag    |
| Distance with no duration on a hard-zone entry                                         | flag    |

- Flagged entries in a pledge week hold settlement until a staff member clears or rejects them (rejecting removes
  the entry from counted meters, not from the log).
- Proof: an optional photo of the monitor screen (the existing up-to-4 photo attachment) or a Concept2 verification
  code field. Staff can ask for proof on a flagged entry; the rower sees a notification.
- Random spot checks: staff can request proof on 1 random pledge-week entry per rower per month.
- **Inference:** keep it light. The point is that rounding up is noticed, not that everything is policed.

## 8. Design 1 (recommended): Weekly Pledge

### 8.1 How it works

- **Pledge:** by Tuesday 23:59 Pacific, each rower picks a pledge for the current week: `Target` (100%),
  `Target +10%` (110%) or `Target +20%` (120%) of their own weekly target, subject to the ramp limit. No pledge means
  no game that week, with no penalty. Pledges lock after Tuesday.
- **Points held up front:** when you pledge, the points are held at once and shown as "on the line": 10 for 100%, 12
  for 110%, 14 for 120%. At settlement you keep them if counted meters reach the pledge, and lose them otherwise.
  This is the BE FIT loss frame with no money.
- **Partial credit:** none for the week, but the chart and normal leaderboard still show every meter.
- **Streak:** consecutive weeks with a kept pledge. Excused weeks don't break it. Streak milestones (4, 8, 12, ...)
  use the orange highlight already reserved for streaks.
- **Team bonus:** if at least 80% of active, opted-in rowers keep their pledge, everyone who pledged gets +3, including
  those who missed. **Inference:** a team reward without punishing anyone individually; the condition shows as a
  count ("27 of 33 kept their pledge"), never a list of names.
- **Season score:** the sum of kept points, shown on the Me page and an optional "Pledge" tab on the leaderboard.
  Points do nothing else. They can't be spent, gifted, transferred, bought, or exchanged for anything.
- **What you can predict or stake:** only your own week, only by pledging. Nothing on teammates, crews, races,
  seat racing, or selection.
- **Settlement:** Monday 12:00 Pacific (12 hours of grace for late Sunday logs), via a Durable Object alarm, which
  Cloudflare documents as at-least-once with automatic retries
  ([Cloudflare DO alarms](https://developers.cloudflare.com/durable-objects/api/alarms/)). Settlement must be
  idempotent per `(user_id, week_start)`. Weeks with open flags settle when the flags are resolved.

### 8.2 Why this rewards consistency, not overtraining (Inference)

- The pledge is relative to the rower's own target, which staff already set per group.
- Above-target pledges pay only slightly more (14 vs 10) and need a 3-week base.
- Counted meters cap hard zones, single days and the weekly total.
- Missing a week costs at most 14 points and a streak; excused weeks cost nothing.

### 8.3 Chart fit

- The season chart (section 2) is the main Me screen and stays the real mileage record.
- On the `1W` tab only, when a pledge exists, the dashed pace line becomes the pledge pace, and the delta line reads
  "18,400 m to your pledge". Nothing else on the chart changes.

### 8.4 Screens

Mobile (bottom tabs per [ARCHITECTURE.md §7](./ARCHITECTURE.md)):

1. **Home:** a compact pledge card under the week summary. Before Tuesday: "Make this week's pledge" with three
   choices. After: progress bar of counted meters to pledge, points on the line, days left.
2. **Pledge sheet:** three large options with the meters each one needs this week, the points held, and a short line
   on the caps ("Hard-zone meters count up to 15,000 this week"). One confirm button.
3. **Me:** season chart on top; below it, season score, pledge streak, and a list of past weeks (kept, missed,
   excused).
4. **Leaderboard:** existing tabs, plus an optional "Pledge" tab ranked by season score, shown only if staff enable it.
5. **Notifications:** Monday reminder to pledge; Sunday 18:00 nudge only if under pledge; settlement result; proof
   requests. No push spam, no streak-loss scare copy.
6. **Admin → Game:** settings, excuse/void, flag queue, team summary.

Desktop (≥1024px left nav): the same screens laid out with the season chart and pledge card side by side on Home,
and the flag queue as a table in Admin.

### 8.5 Data model (additions inside `TeamDO`)

```
pledges(user_id, week_start, level INT (100|110|120), target_m INT, pledge_m INT, points_held INT,
        status ('open'|'kept'|'missed'|'excused'|'void'), counted_m INT NULL, points_awarded INT NULL,
        created_at, settled_at NULL, PRIMARY KEY (user_id, week_start))
game_ledger(id PK, user_id, week_start, kind ('pledge'|'team_bonus'|'adjust'), points INT, reason TEXT NULL,
            actor_id NULL, created_at)          -- append-only; season score = SUM(points)
entry_flags(id PK, entry_id, rule TEXT, status ('open'|'cleared'|'rejected'), note TEXT NULL,
            reviewer_id NULL, created_at, resolved_at NULL)
entry_proofs(entry_id, kind ('photo'|'c2_code'), image_id NULL, code TEXT NULL, created_at)
excused_weeks(user_id, week_start, reason, requested_by, approved_by NULL, created_at, PRIMARY KEY (user_id, week_start))
settings: game_enabled, game_config_json (caps, ramp, levels, points, team threshold)
users: + game_opt_out INT DEFAULT 0
```

`target_m` is snapshotted on the pledge, like factors on entries, so later target edits don't change a settled week.

### 8.6 API sketch

```
GET  /api/game/week?week=YYYY-MM-DD        → { pledge | null, allowed_levels, counted_m, caps, team: { kept, total } }
PUT  /api/game/pledge                       { level }  (until Tuesday 23:59 PT)
GET  /api/game/season?season=YYYY&user=     → { score, streak, weeks: [...] }
POST /api/game/excuse                       { week_start, reason }  (request)
GET  /api/stats/series?range=...            (section 2.8)
Staff:
GET   /api/admin/game/flags?status=open
PATCH /api/admin/game/flags/:id             { status, note }
POST  /api/admin/game/excuse                { user_id, week_start, reason }
POST  /api/admin/game/adjust                { user_id, week_start, points, reason }
PATCH /api/admin/game/settings              { game_enabled, game_config }
```

### 8.7 Compliance angle (Inference)

Pledges are only about the rower's own training, there is no entry fee, points have no use outside the app, and
there are no prizes. This is the lowest-risk shape identified in section 6.5. Remaining question for Stanford
Compliance: whether pledging valueless points on your own OYO volume raises any concern under 10.3.1's "institutional
practice" language. Ship only after a written answer.

## 9. Design 2: Squad Challenge

- **Mechanic:** staff split the team into 4–6 mixed squads (across groups and class years), reshuffled every 4 weeks.
  Each week a squad's score is the average of members' `min(counted %, 100%)`. Squads that average 100% earn a
  "full week" mark; the squad with the most full weeks in the block is shown at the top. A team-wide group goal
  (Strava-style) runs alongside: "Team: 2.6M of 2.8M counted meters this week".
- **What you predict or stake:** nothing.
- **Overtraining:** capping each member at 100% means extra volume by one rower cannot carry a squad. Same section 7
  caps.
- **Anti-cheating:** section 7; squadmates have more reason to inflate, so flags matter more.
- **Chart fit:** personal chart unchanged; the squad page has the same chart component plotting the squad's
  cumulative counted meters against squad pace.
- **Screens:** Home squad card; Squad page (members with check marks for hit target only, no percentages for those
  below); Leaderboard "Squads" tab; Admin squad builder.
- **Data model:** `squads(id, block_start, name)`, `squad_members(squad_id, user_id)`, `squad_weeks(squad_id,
week_start, score_pct, full_week INT)`. API: `GET /api/squads/current`, `GET /api/squads/:id/week`, staff
  `POST /api/admin/squads/shuffle`.
- **Evidence:** STEP UP's competition arm and Babcock's team effect (section 4.3).
- **Risks (Inference):** strongest pressure on low-volume teammates; injured rowers drag the squad unless excused
  weeks are removed from the average. Rank 2 because the shaming risk is structural.
- **Compliance (Inference):** no staking at all, so the wagering analysis is the same as the existing leaderboard.

## 10. Design 3 (not recommended): Teammate prediction market

- **Mechanic:** each rower gets weekly play-money points and trades yes/no shares on questions like "Will the
  team's average reach 100%?" or "Will rower X hit target?", priced by a Manifold-style automated market maker
  (section 3).
- **Why it is ranked last (Inference):**
  - It rewards predicting, not training: the rower who trades best gains, whether or not they rowed.
  - "Will rower X hit target?" pays people when X fails, and X can trade on themselves and then underperform.
  - It is the closest of the three to "wagering involving own team" if the points are ever treated as valuable
    (section 6.2), the category whose analysis starts at permanent loss of eligibility.
  - Market-maker math, resolution disputes and liquidity are a large build for 35 people.
- **If built anyway:** only team-level questions, never individuals; points not connected to anything; staff
  resolve markets; written compliance clearance first. Data model sketch: `markets(id, question, closes_at,
resolution)`, `positions(market_id, user_id, yes_shares, no_shares)`, `trades(...)`.

## 11. Recommendation and MVP scope

**Recommendation (Inference):** build the season chart now, then the Weekly Pledge as a 6-week pilot after written
Stanford Compliance clearance. Skip the prediction market. Revisit Squad Challenge after the pilot if the team wants
more social pressure.

MVP (in order):

1. Season chart on Me and rower profiles: `GET /api/stats/series`, hand-rolled SVG, tabs 1W/1M/3M/Season/All, scrub,
   empty state. No dependency on the game or on compliance.
2. Counted-meters function with the section 7 caps, unit-tested against the architecture's checks.
3. Pledge card and sheet, `pledges` and `game_ledger`, settlement alarm, streak, team count.
4. Admin → Game: on/off, caps, excuse/void, flag queue with the first three flag rules.
5. Opt-out in Settings.

Not in the MVP: Pledge leaderboard tab, proof requests and spot checks, Concept2 code field, squads.

Pilot success measures (Inference): share of rowers hitting weekly target versus the same weeks last season and the 4
weeks before the pilot; share of weeks logged by Sunday; hard-zone share of meters (should not rise); number of
excused weeks and flags; a 3-question survey on whether it felt motivating or stressful. Stop the pilot if hard-zone
share or injury-related excused weeks rise.

## 12. Sources

All sources are linked inline. Main groups:

- Chart: Robinhood support pages, Bluechip walkthrough, Google Design, Kalshi, Strava, W3C, caniuse, MDN, We.Inc,
  uPlot and visx repositories, Reuters, Massachusetts consent order.
- Mechanics: DietBet, WayBetter/StepBet, HealthyWage, stickK, Sweatcoin, Strava, Duolingo, Peloton, WHOOP, ESPN,
  Premier League, Manifold, Polymarket guide.
- Evidence: AEJ: Applied (Giné et al.; Royer et al.), Charness and Gneezy, Management Science (Acland and Levy),
  Econometrica (Kahneman and Tversky), Annals of Internal Medicine (Patel 2016), JAMA Internal Medicine (BE FIT;
  STEP UP), JEEA (Babcock et al.), JMIR, Psychological Bulletin (Deci et al.), JPSP (Lepper et al.), Journal of
  Legal Studies (Gneezy and Rustichini).
- Risk: BJSM (Gabbett), IJSPP and Sports Medicine (Impellizzeri et al.), rib stress fracture review, Prince et al.,
  Concept2.
- Compliance: 2026–27 NCAA Division I Manual, NCAA LSDBi, NCAA reinstatement guidelines and announcements, Stanford
  Compliance Services, California Business and Professions Code 17539.1, Cloudflare Durable Objects docs.
