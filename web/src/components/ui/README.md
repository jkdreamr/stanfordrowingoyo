# OYO UI Kit

Social extensions: `ApiImage` accepts optional `className`, `loading` and `draggable` image props without changing existing consumers. `Avatar` accepts optional `size="feed"` for 40px social-card portraits; existing sizes are unchanged. `useWeekStats(query, enabled?)` supports deferred viewport fetching. Social cards compose the kit's card surface, buttons, avatars, zones and images; carousel/viewer and touch-refresh behavior live in `components/social` with scoped styles in `styles.css`.

Pattern reference: [Design Guide](../../../../docs/DESIGN_GUIDE.md). Architecture §7, owner taste rules and roster signup contract take precedence. Keep the owner's iOS type scale and orange completed ring; retain all ten inline zone choices for one-handed logging. Route crossfades are intentionally omitted to avoid snapshots of sensitive form content. Skeletons stay static, as required by the owner.

## Semantic and Motion Tokens

- `--oyo-accent-ink`, `--oyo-focus`, `--oyo-hover`, `--oyo-selected`, `--oyo-control-border`, `--oyo-highlight-ink`, `--oyo-skeleton` map to Tailwind `accent-ink`, `focus`, `hover`, `selected`, `control-border`, `highlight-ink`, `skeleton`
- Ink aliases preserve the existing contrast-tested colors: dark accent ink `#F18B83`, light achievement ink `#B43900`, dark achievement ink `#FF905C`. Fields and neutral controls use a distinct control border; decorative dividers do not identify inputs
- `--oyo-motion-{instant,press,fast,control,panel,sheet,exit,progress}`: 0/80/120/160/240/300/200/600ms. Tailwind exposes corresponding duration names. `--oyo-ease-{out,standard,in,linear}` supplies curves. Filled button presses scale to .98; tint/selection remain short
- Native sheets enter in 300ms, exit in 200ms, with desktop .99 scale/fade. Focus, Escape and inertness come from native dialog; explicit Close is always available. No drag gesture is promised. Scroll locking is released on close/unmount
- Rings mount at their actual value, interpolate changes for 600ms, never count up text. A confirmed current-week save crossing an unchanged target can reveal one finish tick; acknowledgement stores only user/week and a boolean, never training totals
- Reduced motion is bounded to components: no transform, slide, sweep, spinner rotation or finish animation; all final information remains visible. Hover tint is fine-pointer only
- Controls use 8px corners, cards/groups 12px, sheets 20px top corners; primary form submissions are at least 48px tall. Cards have a border, no shadow
- The mobile Log control stays prominent but wholly in the bar, with a visible label. Sidebar is 232px; rail requires ≥1280px and preserves a ≥560px main column

Import from `components/ui`. Preview at `/dev/kit` in development only. Wrap the application in `ThemeProvider` and `ToastProvider`, inside a router for navigation components. Components use native elements and semantic theme variables; do not replace them with screen-local lookalikes.

## Design Rules

- Exact, athletic, quietly competitive. Use inset-grouped lists for settings and cards for distinct content
- Cardinal is the only interactive accent. Orange is reserved for PR, streak, target-hit and best-week highlights. Zone colors appear only in small chips, always with dark text
- Light: background #F7F7FA, surface #FFFFFF, secondary fill #F1F1F6 (slightly lighter to preserve muted-text contrast), text #242428, muted #6D6D78, divider #DFDFE8. Dark: background #121214, surface #1C1C1F, secondary fill #2A2A2E, text #F2F2F5, muted #A3A3AF, divider #2C2C31
- Cardinal fills: #8C1515 / #C0352B, pressed #6F1010 / #8C1515. Use `accent-ink` for text (dark #F18B83), not the dark cardinal fill. White button text on dark cardinal meets 4.5:1
- Semantic danger: #D70015 light / #FF5C52 dark, used for destructive button text on surface-2 (4.78:1 light / 4.70:1 dark). Dark is slightly lighter than iOS #FF453A to meet text contrast. Plain buttons remain unfilled accent-ink
- No tracked uppercase, monospace labels, emoji, gradients, glows, colored shadows, arrow glyphs in buttons, keyboard chips, transition-all, hover scaling, pulse/ping loops, exclamation marks, greeting headlines or trailing periods on labels
- Title Case headings, labels, buttons and links, including interactive prompts: “Have an Invite Email?”, “Already Registered? Log In”, “How to Finish Your Week”. Prose, hints, descriptions, helper text, errors and feedback stay sentence case: “Ask a coxswain or coach to reset your password”, “Session saved”. Lucide only, stroke 1.75, 20px inline/row icons and 24px navigation icons. Decorative icons must be hidden from assistive technology
- System font stack; weights 400/500/600 only. Tailwind type keys: `large-title` 34/41 600, `title1` 28/34 600, `title2` 22/28 600, `title3` 20/25 600, `headline` 17/22 600, `body` 17/22, `callout` 16/21, `subhead` 15/20, `footnote` 13/18, `caption` 12/16. Inputs are at least 16px; numbers are tabular
- 4px spacing grid. Controls radius 8px, groups/cards 12px, sheet tops 20px. Touch targets at least 44px; small buttons have 36px visual bounds and a 44px hit area, so preserve their 4px vertical margin
- Motion uses the semantic tokens above; reduced motion disables component animation/transition. Skeletons reserve space immediately, appear after 150ms and remain completely static; reduced motion shows them immediately. LoadState offers Refresh after a ten-second wait
- Focus-visible uses a 2px accent-ink outline with 2px offset. Selection and carets use cardinal
- Fixed layouts own safe-area insets. Sheet respects bottom inset; PageHeader respects top inset. Screen shells must reserve space for their fixed tab bars. Toasts sit above the mobile tab bar, bottom-center on desktop

## Components

### SeasonChart

`<SeasonChart userId={optionalOtherUserId} isMe={false} />` is data-connected through the existing stats/config query cache. Omit both props for the signed-in rower. It uses `SeasonStats.days` and versioned weekly targets; no new endpoint. The default range is Season. Selecting All loads every preceding season back to the season starting in 2024 in parallel, without stopping at empty seasons. There is no API earliest-entry bound; account creation is not a reliable history floor because entries may be backdated. Public profiles use only API-authorized data; coxswains and zero-target histories omit pace.

`SeasonChartView` is the pure-data surface: `stats`, optional `history`, `today`, `currentWeekStart`, optional `isMe` (default true), `coxswain`, `createdAt`, controlled `range` and `onRangeChange`. The connected chart supplies `User/PublicUser.created_at`. Pace starts at the later of season start and account creation (Los Angeles date), including for backdated activity; without `createdAt`, first entry or season start is used. The same rule applies independently to every season in All. Pure cumulative, pace-gap, range, weekly-sampling, y-domain and SVG-path helpers live in `lib/season-chart.ts`. Scrubbing supports pointer capture, mouse hover and Left/Right/Home/End/Escape; only keyboard changes announce in the polite live region. The chart uses a local accessible range button group to preserve the specified underline style, without changing kit Tabs or SegmentedControl. Paths are memoized and isolated from cursor/header updates; range swaps are immediate. Plot-only `pan-y` preserves vertical page scrolling. Loading uses a static kit Skeleton and failed requests offer retry.

This is an additive export; existing kit component APIs and styles are unchanged.

### Core-screen patterns

`ChoiceRow` is a native radio row for grouped selection. Props: `name`, `value`, `checked`, `onChange`, `title`, optional `subtitle`. Place related rows in a labeled `fieldset` inside `ListGroup`; native keyboard navigation and a visible checkmark expose the current selection. `<ChoiceRow name="group" value="normal" checked={group === 'normal'} onChange={() => setGroup('normal')} title="Normal Non-Frosh" />`

| Component    | Props and use                                                                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TaskHeader   | `title`, `leading`, `trailing`: sticky compact task bar with a single h1, Cancel on the left and Save on the right                                                                              |
| ActionCard   | `to`, accessible `label`, `children`: a whole-card router link, never nest other controls inside                                                                                                |
| Disclosure   | `title`, controlled `open`, `onChange`, `children`: 44px+ disclosure button with aria-expanded and a wired hidden content region                                                                |
| ConfirmSheet | `open`, `onClose`, `onConfirm`, `title`, `body`, `confirmLabel`, optional `loading`: destructive confirmation with a safe cancel action                                                         |
| PhotoPicker  | controlled `photos: {key,url,id?}[]`, `onAdd(File[])`, `onRemove(key)`, optional `max=4`, `disabled`: native file picker and removable previews; pair with `usePhotos` to resize/upload on Save |
| ApiImage     | `imageId`, `alt`, optional `onError`: loads API image blobs through the query layer and revokes its object URL on cleanup; also works with the development fetch mock                           |

`<TaskHeader title="Log Session" leading={<Button variant="plain">Cancel</Button>} trailing={<Button type="submit" variant="plain">Save</Button>} />`

`<Disclosure title="Add Details" open={open} onChange={setOpen}><TextField label="Time" /></Disclosure>`

`<ActionCard to="/me/target" label="Change weekly target"><ProgressRing value={48000} max={80000} label="Weekly Target" /></ActionCard>`

Target-hit text uses `--highlight-ink` (#B43900 light / #FF905C dark) for readable orange text; the ring retains `--highlight`. PhotoPicker remains the session-photo picker: decoding honors EXIF orientation, caps the long side at 1600px and encodes JPEG at 0.82. Profile avatars instead open a Profile Photo sheet and a Move and Scale crop step, encoding a 512px square as WebP (JPEG fallback). Avatar accepts an optional `src` for local draft previews. `usePhotos.addProcessed(Blob)` uploads that crop unchanged on Save. Processing/upload errors leave the form intact.

`formatNumber(value, digits=0)` formats factors, counts and percentages without raw floats. `formatPercent(value)` adds `%`; `formatWeekday(date)` uses LA dates. Pass `config.today` as the second argument to `formatEntryDate` on API-backed screens. `daysLeft` includes Sunday; `finishWeek` always uses API-configured factors.

Native attributes are supported where stated. All callbacks are controlled: update the corresponding value in the parent. Field labels are mandatory; hint and error are joined through aria-describedby and errors set aria-invalid.

### Button

| Prop               | Type / Default                                          |
| ------------------ | ------------------------------------------------------- |
| variant            | primary (default), secondary, plain, destructive        |
| size               | sm (44, compact text), md (44, default), lg (50)        |
| fullWidth, loading | boolean, false                                          |
| leading, children  | ReactNode; children required                            |
| to                 | string: renders router Link; otherwise native button    |
| disabled           | boolean; links prevent navigation and announce disabled |
| other              | native button attributes or LinkProps                   |

`<Button leading={<Plus size={20} strokeWidth={1.75} />} loading={saving}>Log Session</Button>`

Loading preserves label width, disables activation, and announces busy. The spinner is decorative.

### IconButton

| Prop       | Type                     |
| ---------- | ------------------------ |
| aria-label | required string          |
| children   | icon node                |
| other      | native button attributes |

`<IconButton aria-label="Close" onClick={close}><X size={20} strokeWidth={1.75} /></IconButton>`

### SegmentedControl

| Prop            | Type / Default                                             |
| --------------- | ---------------------------------------------------------- |
| label           | required radiogroup name                                   |
| value, onChange | generic string T, (value: T) => void                       |
| options         | readonly { value: T; label: string; disabled?: boolean }[] |
| size            | sm, md (default), lg; all have 44px minimum hit targets    |

`<SegmentedControl label="Modality" value={mode} onChange={setMode} options={[{value: 'erg', label: 'Erg'}, {value: 'bike', label: 'Bike'}]} />`

Arrows wrap and skip disabled options; Home/End select the first/last enabled option. Selected thumb slides without layout movement.

### ListGroup / ListRow

| Component | Props                                                                                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ListGroup | header?: string, footer?: string, children: ReactNode                                                                                                           |
| ListRow   | title: string, subtitle?: ReactNode, leading?: icon, avatar?: ReactNode, trailing?: ReactNode, to?: string, onClick?: () => void, tone?: default or destructive |

`<ListGroup header="Training"><ListRow title="Weekly Target" trailing="80.0k" to="/me/target" /></ListGroup>`

Headers and footers use Title Case footnotes, never uppercase. `to` wins over onClick. Optional `chevron?: boolean` defaults to `!!to`: action rows have no chevron unless explicitly requested. Static rows are divs. Leading icons receive a neutral tile; avatars do not.

### Card

| Prop  | Type                               |
| ----- | ---------------------------------- |
| other | native div attributes and children |

`<Card><h2 className="text-headline">Season Total</h2><p>240.0k E-meters</p></Card>`

### Sheet

| Prop             | Type                                   |
| ---------------- | -------------------------------------- |
| open             | boolean                                |
| onClose          | () => void; parent must set open=false |
| title            | string, accessible dialog name         |
| children, footer | ReactNode; footer optional             |

`<Sheet open={open} onClose={() => setOpen(false)} title="Session Details" footer={<Button onClick={save}>Save</Button>}>...</Sheet>`

Native dialog traps focus and makes background inert; focus returns on close. Esc, outside scrim and Close dismiss. No swipe/drag affordance. Mobile bottom sheet, desktop centered at 1024px; body scrolls within 85dvh (85vh fallback).

### TextField / NumberField / TextArea / Select

| Prop            | Type                                                                             |
| --------------- | -------------------------------------------------------------------------------- |
| label           | required visible string                                                          |
| id, hint, error | optional strings                                                                 |
| suffix          | TextField/NumberField optional visual unit; include unit in label when ambiguous |
| trailing        | TextField optional ReactNode; use a labeled IconButton for password visibility   |
| inputMode       | NumberField: numeric or decimal (default); value remains a string                |
| other           | native input/textarea/select attributes                                          |

`<TextField label="Session Name" hint="Keep it short" />`

`<NumberField label="Distance In Meters" suffix="m" value={distance} onChange={e => setDistance(e.target.value)} />`

`<TextArea label="Notes" error={error} />`

`<Select label="Group"><option value="normal">Normal</option><option value="frosh">Frosh</option></Select>`

NumberField is a text input with numeric keyboard, allowing incomplete edits; parse and validate before submitting. Native Select retains platform picker behavior.

### Toggle

| Prop              | Type                                |
| ----------------- | ----------------------------------- |
| label             | string                              |
| checked, onChange | boolean, (checked: boolean) => void |
| disabled          | optional boolean                    |

`<Toggle label="Pinned" checked={pinned} onChange={setPinned} />`

### Avatar

| Prop    | Type / Default                                        |
| ------- | ----------------------------------------------------- |
| name    | string, accessible name and initials source           |
| imageId | optional string or null, fetched from /api/images/:id |
| size    | sm 32, md 44 (default), lg 64                         |

`<Avatar name="Marcus Albrecht" imageId={user.avatar_image_id} />`

Broken images fall back to initials; neutral background is deterministic by name.

### ZoneChip / ZoneOption

| Component  | Props                                              |
| ---------- | -------------------------------------------------- |
| ZoneChip   | zone: shared Zone, selected?: boolean              |
| ZoneOption | zone: Zone, selected: boolean, onClick: () => void |

`<ZoneChip zone="E/D" />` / `<ZoneOption zone="E" selected={zone === 'E'} onClick={() => setZone('E')} />`

ZoneOption adds a 44px button and aria-pressed. Chip alone is noninteractive.

### ProgressRing

| Prop       | Type / Default                                          |
| ---------- | ------------------------------------------------------- |
| value, max | numbers, clamped for display; invalid max displays zero |
| label      | required accessible progress name                       |
| size       | number, 144                                             |
| children   | optional center slot                                    |

`<ProgressRing value={52000} max={80000} label="Weekly Target"><span>65%</span></ProgressRing>`

Cardinal stroke becomes orange only at completion. Center content is presentational to the progressbar; value/max provide the accessible value.

### Skeleton / EmptyState

| Component  | Props                                                            |
| ---------- | ---------------------------------------------------------------- |
| Skeleton   | native div props; className sets dimensions; aria-hidden         |
| EmptyState | icon: ReactNode, title: string, body: string, action?: ReactNode |

`<Skeleton className="h-16 w-full" />`

`<EmptyState icon={<Activity size={20} strokeWidth={1.75} />} title="No Sessions Yet" body="Your extra training starts here" action={<Button to="/log">Log Session</Button>} />`

### ToastProvider / useToast

| API             | Type                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| ToastProvider   | children: ReactNode                                                                                          |
| useToast().show | ({title: string, action?: {label: string; onClick: () => void}, tone?: default or error or success}) => void |

`const toast = useToast(); toast.show({title: 'Session Saved', action: {label: 'Undo', onClick: undo}});`

Polite live announcements, 4s lifetime, latest notification replaces previous. Explicit dismiss and action buttons. Success uses a check, not orange (saving is not a PR).

### PageHeader

| Prop     | Type                                                 |
| -------- | ---------------------------------------------------- |
| title    | string                                               |
| back     | optional string destination or true for history back |
| trailing | optional ReactNode actions                           |

`<PageHeader title="Training" back="/" trailing={<IconButton aria-label="Settings" onClick={openSettings}><Settings size={20} strokeWidth={1.75} /></IconButton>} />`

IntersectionObserver collapses the large title into the sticky bar on scroll; compact duplicate is hidden from assistive technology.

### Tabs

| Prop            | Type                                                                         |
| --------------- | ---------------------------------------------------------------------------- |
| label           | tablist name                                                                 |
| value, onChange | generic string T, (value: T) => void                                         |
| tabs            | readonly {value: T; label: string; content: ReactNode; disabled?: boolean}[] |

`<Tabs label="Progress Period" value={period} onChange={setPeriod} tabs={[{value: 'week', label: 'This Week', content: <WeekStats />}, {value: 'season', label: 'Season', content: <SeasonStats />}]} />`

Horizontal arrows wrap and activate; Home/End supported. Each tab controls an ID-linked tabpanel; only selected panel is visible.

## Meters And Splits Formatting Guide

Import from `lib/format`. Never render arithmetic results directly. Invalid numeric display values produce an em dash. Parsers return null on empty or invalid input; zero is a valid result. Calculations retain precision until formatting.

| Function                              | Use                                        | Example                                                                                                 |
| ------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| formatMeters(meters, compact=false)   | Physical distance in rows/details          | 20000.4 → 20,000 m; compact → 20.0k                                                                     |
| formatKm(meters, digits=1)            | Distance menu and kilometer fields         | 12000 → 12.0 km                                                                                         |
| formatEMeters(meters, compact=false)  | Equivalent totals and live Log result      | 20000 → 20,000 E-meters; compact → 20.0k                                                                |
| formatSplit(seconds)                  | Pace per 500m                              | 112.4 → 1:52.4                                                                                          |
| formatDuration(seconds)               | Total session duration                     | 1500 → 25:00; 3723 → 1:02:03                                                                            |
| parseDuration(text)                   | Duration field on submit                   | 25:00 / 25.00 → 1500; 1:02:03 / 1.02.03 → 3723; 90 → 90                                                 |
| parseSplit(text)                      | Pace field on submit                       | 145 / 1450 / 145.0 / 1.45.0 → 105; 1:60 → null                                                          |
| parseTimeInput(text, kind)            | Shared time parsing and blur normalization | split: 1450 → 1:45.0; duration: integer seconds or dot/colon clock; elapsed: clock with optional tenths |
| splitFromTime(duration_s, distance_m) | Derive seconds/500m, then formatSplit      | (1500,6000) → 125; zero distance → null                                                                 |
| formatEntryDate(date, now?)           | Feed and entry headers, LA-relative date   | Today, Yesterday, Mon, Nov 3                                                                            |
| formatShortDate(date)                 | Absolute local entry date                  | 2025-11-03 → Mon, Nov 3                                                                                 |

Entry dates are shared LA calendar strings (`YYYY-MM-DD`), not UTC timestamps. Helpers use shared date and math implementations without changing training semantics.
