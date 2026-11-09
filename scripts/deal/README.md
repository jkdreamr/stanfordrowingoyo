# Deal offline curation

Run `node scripts/deal/generate.ts` on Node 24+. The solver is offline-only;
the Worker reconstructs only a seeded witness. Round indices are zero-based.
The schedule spans 2026-11-09 through 2028-11-15 inclusive. Each byte stores
the candidate index in its low six bits and the difficulty tier in its high two.
Regenerating is an explicit product change: pinned fixtures protect past deals.

The exhaustive subset DP counts binary expression trees with labeled leaves
(identical-valued cards remain distinct). Addition and multiplication children
are unordered; subtraction and division are ordered. Associative trees remain
distinct. Intermediate values are positive safe integers. The full-hand map is
never materialized: each goal uses inverse-operation lookups across partitions.
A second DP excluding division establishes whether division is necessary.

Hands use date/round/attempt-seeded deck shuffles. The first hand whose k=0
construction reaches its goal range within 24 attempts is accepted (at most 128
hand attempts). This cheap acceptance rule needs no solver and is independent
of k. Other k values that exhaust their 24 construction attempts are ineligible.

Each hand evaluates 64 seeded expression candidates. The all-sum/all-product
goals, counts below two, and sorted-hand/goal repeats
within 365 days are rejected. R1 selects the 40th-percentile candidate by tree
count. R2–R5 minimize count, then prefer division-required goals, then lower k.
No large report JSON is emitted; the generator prints summary statistics.

Tier thresholds are upper-inclusive and depend on hand size. Higher tiers mean
fewer solutions. These are heuristic difficulty bands, not human-time estimates
derived from player telemetry:

| Cards | Tier 3 ≤ | Tier 2 ≤ | Tier 1 ≤ | Tier 0 |
| ----- | -------- | -------- | -------- | ------ |
| 4     | 4        | 12       | 40       | >40    |
| 5     | 20       | 80       | 250      | >250   |
| 6     | 100      | 500      | 2000     | >2000  |
| 7     | 500      | 3000     | 12000    | >12000 |
| 8     | 3000     | 18000    | 80000    | >80000 |

Par times in seconds allow more planning time for larger hands and scarcer
solutions, always below the five-minute cap:

| Cards | Tier 0 | Tier 1 | Tier 2 | Tier 3 |
| ----- | ------ | ------ | ------ | ------ |
| 4     | 20     | 30     | 45     | 60     |
| 5     | 30     | 45     | 65     | 90     |
| 6     | 45     | 65     | 90     | 120    |
| 7     | 65     | 90     | 125    | 165    |
| 8     | 90     | 120    | 160    | 210    |

Dates outside the committed schedule use candidate zero and tier one. That
fallback is solvable but has not undergone offline hardness/uniqueness curation.

Run `node --no-concurrent-recompilation scripts/deal/benchmark.ts` for timings
without counting V8 background compilation threads toward individual calls.
It reports the worst per-deal CPU average across 30 reconstructions for every
scheduled date/round, with no hand or candidate cache. Startup/JIT/GC outliers
can exceed pure reconstruction cost; these measurements are not hard real-time
guarantees or production Worker telemetry.
