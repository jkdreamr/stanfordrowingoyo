# R6 geography refinement

Base: `d9f96cf`. Seven old IDs retired in place; seven new geography specs inserted immediately after their predecessors. All old specifications and bases otherwise unchanged. No runtime/generated files are committed.

| Old ID (count)             | New ID                     | Exact displayed prompt                                                                               | Count / band | Exact recall |
| -------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------- | ------------ | ------------ |
| `china-provinces` (23)     | `china-compass-names`      | Name a Chinese province-level division whose Chinese name contains north, south, east or west.       | 14 / tiny    | 27/27        |
| `new-zealand-regions` (16) | `lakes-10000-km2`          | Name a lake with a surface area of more than 10,000 square kilometres (2026 areas).                  | 17 / tiny    | 28/28        |
| `japan-prefectures` (47)   | `japan-same-name-capitals` | Name a Japanese prefecture whose capital is a city of the same name.                                 | 29 / medium  | 33/33        |
| `swiss-cantons` (26)       | `alpine-four-thousanders`  | Name one of the 82 official four-thousand-metre peaks of the Alps.                                   | 82 / medium  | 46/46        |
| `brazil-states` (27)       | `rivers-3000-km`           | Name a river system listed as more than 3,000 kilometres long (2026 lengths).                        | 28 / medium  | 39/39        |
| `mexico-states` (32)       | `us-capitals-not-largest`  | Name a US state capital that wasn't its state's most populous city in the 2020 census.               | 33 / medium  | 35/35        |
| `indian-states` (36)       | `islands-50000-km2`        | Name an island with an area of more than 50,000 square kilometres (2026 areas; continents excluded). | 28 / medium  | 30/30        |

## Source and completeness review

Each pinned Wikipedia table was fetched with title/revision checks and reviewed row by row. Full retained source rows and predicate evidence are in `refine-R6-audit.json`; each source has exact expected counts. Measurements and mutable administrative definitions are explicitly bounded to 2026 or the 2020 census. Nothing depends on a future release or event.

- China: the lead’s Provinces of China page omitted municipalities and autonomous regions. Used the complete Provincial-level divisions of China table instead, filtering 北/南/东/西 across all 34 rows. Fourteen qualify, including Beijing and Xizang/Tibet.
- Japan: all 47 rows compared. Require a city (市), not just an English-name match: Tokyo is not a city. The pinned table actually labels its capital 東京都, not Shinjuku as the lead expected. The other 29 matching rows qualify.
- Alps: all 82 official UIAA peaks, not the enlarged table of subsidiary tops. Massif shorthand maps to its main summit only; shorter summit names and natural local names are aliases. Les Droites at exactly 4,000 m is on the official list.
- Lakes: main table’s 16 qualifying lakes plus combined Michigan–Huron from its alternative table, 17 total. **Departure from lead notes:** retaining a valid frozen guess as an unscorable exception would violate the user’s requirement to add every valid answer. The combined lake therefore owns its own row, never an alias to only one component. Both common lake-counting conventions are accepted; all 28 valid frozen guesses now hit.
- Rivers: all 28 rows whose primary displayed length exceeds 3,000 km. Primary value, not alternative estimate, controls São Francisco. Each main-stem shorthand maps to its river-system row. Systems and tributaries do not create extra entries. Rio Grande maps to the separate North American system, never the Paraná tributary.
- US capitals: all 50 state rows, retain the 33 whose city-proper population rank exceeds 1 in the 2020 Census; never metropolitan/CSA populations. Snapshot-bound displayed wording avoids changes during the cycle.
- Islands: all 28 individual noncontinental islands above 50,000 km² using the table’s 2026 figures. Alexander Island qualifies; Tierra del Fuego and Severny do not in this dataset. Continents and multi-island archipelagos do not qualify.

## Frozen recall and overlap

`refine-R6-raw.json` was committed before this source review and remains byte-identical. The selected corpus preserves all guesses in original order; only genuine nonmembers carry explicit reasons. Their rejected inputs, plus empty/error inputs, were checked with the existing exact evaluator in a throwaway script. Per-prompt recall is 100%; there are no remaining recall exceptions. Every reviewed-invalid guess is rejected.

The default evaluator and selected-only evaluator give identical per-prompt results. The selected-only run deliberately reports missing corpus for unrelated scheduled prompts; that is not missing answer data. The audit includes canonical-only before results with the same valid denominator.

Normalized-canonical intersections against every other active constrained spec are below 50% of the smaller set. Maximums: China 2/8 = 25% (Chinese cuisines); Japan 1/22 = 4.55% (Winter Olympic hosts); rivers 2/14 = 14.29% (countries without U/S/A, Congo/Niger homographs); US capitals 1/33 = 3.03% (Spielberg films, Lincoln homograph); islands 5/28 = 17.86% (island countries); lakes and Alps 0%. The other shards’ slot lists in the attached review are sports/music/film/book/office-holder/everyday replacements, not these geographic sets; no same-question replacement is introduced.

## Checks and standalone size

- Generator: 650 runtime data modules; 639 active + 106 inactive candidates; 149,343 canonical answers and 97,629 aliases.
- Source acquisition: all seven pinned reviewed snapshots verified; every retained row recorded in the audit.
- Recall: 238/238 across seven new prompts; default and selected-only agree.
- Existing recall regression: 15 tests passed. Throwaway frozen/invalid/empty/error checks: seven prompts passed.
- Lint and typecheck passed.
- `format:check` is blocked only by the pre-existing formatting of the frozen `refine-R6-raw.json` from commit `42e15b8`. It was deliberately not reformatted: the lead explicitly requires that frozen file to remain byte-identical. All other files passed formatting.
- `python -m unittest`: 30 tests, two failures, both stale aggregate assertions: 394 vs 387 total specs and the seven additional retired IDs. Tests cannot be edited under this shard’s file restrictions.
- Aggregate npm tests: initial race with generation briefly saw stale generated data; rerun after generation leaves only the expected Worker retired-count assertion (74 vs 67). See final execution report for totals.
- Build: `Total Upload: 8024.02 KiB / gzip: 2995.21 KiB`; d9f96cf baseline measured `2993.75 KiB`; standalone delta **+1.46 KiB**, within +1.5 KiB. Module-only gzip sizes in the audit are diagnostic and are not additive Worker estimates.

No UI surface was changed or visually tested. No PR, merge or deploy.
