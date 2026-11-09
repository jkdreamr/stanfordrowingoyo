# refine-R1 sports replacement audit

## Result

Five plain sports slots are retired (`"active": false`) and each one is replaced by a constrained prompt inserted right after it. Every replacement keeps the `sports` theme and its old size band. Each membership is extracted from a pinned Wikipedia revision and checked member by member (`constrained.py --verify-sources` passes). Exact normalized recall on the frozen brainstorm is **216/217 (99.54%)**, and every prompt is at or above 95%.

| Old slot (count)          | New prompt                                                     | Count / band | Recall         |
| ------------------------- | -------------------------------------------------------------- | ------------ | -------------- |
| nba-teams (30)            | Name a No. 1 overall NBA draft pick through 2026.              | 80 / medium  | 66/66 (100%)   |
| nfl-teams (32)            | Name a former team name of a current NFL franchise.            | 29 / medium  | 30/31 (96.77%) |
| mlb-teams (30)            | Name a player with a 50-home-run MLB season through 2025.      | 34 / medium  | 41/41 (100%)   |
| nhl-teams (32)            | Name a player with 500 career NHL goals through 2025–26.       | 50 / medium  | 56/56 (100%)   |
| summer-olympic-hosts (23) | Name an Olympian with at least eight gold medals through 2026. | 19 / tiny    | 23/23 (100%)   |

## Frozen guesses and reproduction

`refine-R1-raw.json` was committed on its own (398bc98) before any answer data was opened. SHA-256 `a2d851508f03160b74d376d021e2fc338b0b69ecdc2c349a9cd6a1ce573712bd`. Each prompt has at least 40 distinct guesses. The key `nba-former-names-backup` is an unused backup brainstorm and is not in the selected file. `refine-R1-selected.json` keeps the raw order and text exactly. 60 guesses that are actually wrong are marked invalid, each with a reason. Before = canonical keys only, before aliases were reviewed.

```sh
source ~/.nvm/nvm.sh
~/work/dive-venv/bin/python scripts/dive/constrained.py --verify-sources
~/work/dive-venv/bin/python scripts/dive/generate.py
node scripts/dive/recall.mjs
```

## Membership and boundaries

- **nba-first-overall-picks**: the pinned table has 80 rows, from the 1947 BAA draft through the 2026 draft (AJ Dybantsa). The next draft is in June 2027, after the cycle ends; the wording is still bounded with "through 2026". The source's Lew Alcindor becomes canonical Kareem Abdul-Jabbar. Invalid guesses: Jordan, Durant, Doncic, Kobe, Darko, Bowie, Parker, Embiid and Darryn Peterson, none of whom went No. 1.
- **nfl-former-names**: 15 pinned team pages. Membership is the infobox team-history names plus the Packers' historical-name nicknames (Indian Packers, Acme Packers). It includes the pre-NFL Cardinals names and the WWII Steagles and Card-Pitt mergers. It excludes names still in use, even ones also used earlier (Los Angeles Rams, Los Angeles Chargers), and the defunct Boston Yanks. Bare "Oilers" and "Redskins" credit the long-running Houston and Washington names. Bare "Staleys" is equally Decatur or Chicago, so it is left ambiguous: this is the only miss.
- **mlb-50-homer-seasons**: the pinned table has 54 season rows through 2025, deduplicated to 34 players. The table has no 2026 rows, so the wording is bounded through 2025.
- **nhl-500-goal-club**: the pinned list is after the 2025–26 season and has 50 players, including the tied Mats Sundin row. The bound "through 2025–26" covers anyone who reaches 500 during the cycle.
- **olympic-eight-golds**: the pinned all-time table, filtered to 8 or more golds, gives 19 athletes through Milano Cortina 2026. The next Games are in 2028. Invalid gold counts are quoted from the same table (for example, Martin Fourcade 6).

## Overlap

Overlap is measured on canonical names against every active spec, counting the other prompt's aliases:

- nba-first-overall-picks vs nba-mvp: 11/37 (29.7%)
- nba-first-overall-picks vs nba-75-team: 15/76 (19.7%)
- nfl-former-names vs super-bowl-winners: 5/20 (25%), via the old-name aliases on that prompt
- mlb-50-homer-seasons vs baseball-hall-of-fame: 12/34 (35.3%)
- olympic-eight-golds vs olympic-100m-champions: 2/19 (10.5%)
- nhl-500-goal-club: no overlap

olympic-capitals and both-season-olympics are unchanged.

## Exceptions

- `test_constrained.py` fails 2 tests: its hard-coded prompt count (387, now 392) and its hard-coded retired-ID set no longer match after these five retirements. This is the same kind of failure as the expected `divePrompts.test.ts` retired-count failure. The file is outside this shard's edit scope and is left for the merge.

## Worker gzip

Wrangler dry run: 2993.75 KiB at d9f96cf and 2994.98 KiB with this shard, a delta of +1.23 KiB (budget +1.5 KiB).
