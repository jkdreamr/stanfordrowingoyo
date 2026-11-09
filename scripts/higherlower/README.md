# Higher or Lower data

`copy.mjs` holds the reviewed import-time questions, short comparison labels and
date captions. Importers apply it to the source-of-truth metadata in `facts.json`.
The public day caption is shown once; optional per-fact `asOf` overrides survive
packing and appear only on the differing card. Display precision is fixed per
unit: whole km/counts/calories, one decimal for m/km²/kg/mph, and two decimals
for density and scaled money/population/passenger values.

`facts.json` is the human-editable source: category metadata (question, labels,
unit, source, asOf) and named facts with optional detail/source/asOf overrides.
Use null asOf only for timeless measurements. Sources remain here, not in the
Worker. Batches A and B contain eighteen categories with 30–64 facts each. Only
land area remains from the original three correlated state-area categories.

`sources.json` describes source columns and explicit name mappings. Run
`node scripts/higherlower/verify.mjs` to re-fetch every source and compare every
fact (network required; not a CI test). Wikipedia revisions are pinned; World
Bank observations are pinned to 2023 but may receive later revisions, which
verification deliberately reports rather than silently accepting. Values match
exactly except GDP/country land area, rounded to whole dollars/km². Census land
area uses the published whole-km² column. Density uses CRC near-room-temperature
solid-phase values and named allotropes, not STP gas or liquid-phase densities.
`import-batch-a.mjs` and `import-batch-b.mjs` rebuild the pool from those sources; review all changes
before resetting a pre-launch schedule. Duplicate source names are matched using
country/team details. Source notes include URLs, revision ids and access dates.
USDA uses the public SR Legacy ZIP, nutrient 1008, and exact FDC ids/entry names;
the verifier extracts CSVs with Node's built-in ZIP/deflate support. NASA/JPL
solar-system diameters are twice mean radii, displayed as whole km. The curated
30-body pool includes eight planets, Ceres/Pluto/Makemake, and nineteen round,
well-measured moons at least 200 km across; no irregular moons or uncertain
dwarf-planet estimates. It supports 21 unique valid days in the 380-day schedule.
NPS acreage converts to km² rounded to one
decimal. Retired NBA totals are final regular-season NBA-only career totals.
Use `--categories id,id` to retry only failed categories after a network error.

With Node 24 loaded:

```
node scripts/higherlower/generate.mjs --reset --extend 380
node scripts/higherlower/generate.mjs --extend 30
node scripts/higherlower/generate.mjs
```

The last command only derives the Worker module. `schedule.json` stores explicit
dates, category ids, pool sizes, seeds and fact **names**; normal runs never replace
existing days. Facts may only be appended, never reordered or removed once scheduled.
Keep names and surprise weights stable. Value corrections are allowed but must still
pass frozen-name and difficulty validation; a correction that changes a historical
walk needs explicit review, not silent regeneration. Tests reconstruct every frozen
chain exactly and verify that appending facts leaves old days unchanged.
`--reset` is an explicit pre-launch escape hatch, not a production update workflow.
The deterministic seeded weighted walk balances categories, rejects repeated sets and
orders, requires adjacent differences ≥10%, 7–13 higher answers, runs ≤4, and an
opening item ranked 5th–17th within its chain. All categories use the
same hard difficulty thresholds: at least 14 of 20 adjacent ratios (70%) must be
at most 1.40, and no ratio may exceed 3.0. There are no category exceptions.
Close neighbors receive 8× sampling weight. An optional fact `surprise` boolean
or weight (0–10) boosts adjacency to that fact; it never relaxes validation.
Failure to find a chain aborts without writing either file. The generator balances
category counts and never places two country/state categories consecutively.

Schedule starts with previews on 2026-11-02. Launch day index zero is 2026-11-16,
14 records later. Each record is six base64-alphabet characters: one category
index, one pool size minus one, and a four-character big-endian 24-bit seed.
`worker/src/games/higherlower/chain.ts` is the pure deterministic constructor used
by both runtime and generator. It only sees the first emitted pool-size facts,
so later appends cannot change old chains. Changing the walk requires preserving
existing frozen names or an explicit pre-launch reset. There are at most 64
categories and 64 facts per category. Category tuples pack facts as
`name|detail|value[|surpriseWeight]` separated by `~`.
Reserved delimiters are rejected. Worker category decoding is lazy and cached
per isolate; a request constructs a 21-item walk (≤64 candidates per step) and
replays ≤20 choices. A test reports construction time for all 380 days; its Node
wall-clock average is a local benchmark, not a production Cloudflare CPU measurement.
Dates are LA team dates supplied by `shared/dates.today`. Outside the emitted
range, the integer day offset from the preview start wraps modulo schedule length
(including negative offsets). Extending can therefore change fallback puzzles
outside the explicitly scheduled range, never an already-emitted date.

Validators live in `scripts/higherlower/data.test.ts`; API tests in
`worker/src/higherlower.test.ts`. Hidden facts/schedules must never enter web code.
