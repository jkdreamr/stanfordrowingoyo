# Dive shard S3 review: sports, history and games

Scope: the 49 existing constrained prompts in sports, history and games. No prompts were added or removed, and `bases`, `surface`, `too_clever` and `pearl` are unchanged.

## Corpus

`shard-S3-raw.json` is a frozen brainstorm of 2229 guesses (at least 25 per prompt), written before any answer data was opened. `shard-S3-selected.json` keeps every guess and marks 175 as genuinely wrong, each with a reason. Most of those are deliberate near-miss traps: non-winners, former teams, future hosts, rival claimants, spin-off games and Roman names for Greek gods. `corpus.json` is untouched.

## Changes

- Added 648 aliases and 0 canonical answers. No pinned source's `reviewed`/`members` or `expect` values changed, because every miss was an alias of an existing member.
- `popes-modern` accepts Arabic numerals (`Leo 13`, `John Paul 2`), a `Pope ` prefix, `Saint ` for canonized popes and birth names.
- `english-monarchs` accepts Arabic numerals and epithets (`William the Conqueror`, `Richard the Lionheart`, `Bloody Mary`, `Lady Jane Grey`, `King John`, `Edgar Atheling`).
- `uk-prime-ministers` accepts peerage titles (`Lord Palmerston`, `Duke of Wellington`, `Lord Salisbury`, `Lord North`, `Pitt the Younger` and others).
- People sets accept forms without middle initials (`Harry Truman`, `William Seward`) plus nicknames (`FDR`, `JFK`, `LBJ`, `Ike`, `RBG`, `Shaq`, `Giannis`, `RG3`, `Malala`).
- Team sets accept common short names (`Sixers`, `Niners`, `Habs`, `Leafs`, `Cavs`, `Nats`, `A's`), `LA` forms and recent former names of the same franchise (`Oakland Raiders`, `Washington Redskins`, `Cleveland Indians`, `Utah Hockey Club`).
- Places and teams accept native and historical spellings (`Byelorussia`, `Moldavia`, `Kirghizia`, `Italia`, `España`, `Korea Republic`, `Saint Moritz`, `Milano Cortina`, `Peking`).
- Other prompts accept transliterations and variants: Muses (`Kalliope`, `Klio`), plagues (Hebrew names, `Water turned to blood`), Ennead (`Atum-Ra`, `Ra`), Eight Immortals (Wade-Giles and spaced pinyin), Zelda (`BOTW`, `TOTK`, `OoT`, `Four Swords`) and Pokémon types (`Fire type`, `Fire-type`).

## Recall

|                        | Before            | After             |
| ---------------------- | ----------------- | ----------------- |
| Frozen baseline corpus | 1353/1497 (90.4%) | 1475/1497 (98.5%) |
| S3 selected corpus     | 1778/2054 (86.6%) | 2052/2054 (99.9%) |

| Prompt                       | Baseline before | Baseline after | Shard before | Shard after  | Aliases added |
| ---------------------------- | --------------- | -------------- | ------------ | ------------ | ------------- |
| `baseball-hall-of-fame`      | 34/37 (92%)     | 34/37 (92%)    | 71/72 (99%)  | 72/72 (100%) | 1             |
| `declaration-signers`        | 27/34 (79%)     | 31/34 (91%)    | 60/65 (92%)  | 65/65 (100%) | 6             |
| `early-roman-emperors`       | 27/31 (87%)     | 31/31 (100%)   | 27/33 (82%)  | 33/33 (100%) | 10            |
| `egypt-plagues`              | 15/19 (79%)     | 19/19 (100%)   | 23/38 (61%)  | 38/38 (100%) | 25            |
| `egyptian-ennead`            | 11/12 (92%)     | 12/12 (100%)   | 11/21 (52%)  | 21/21 (100%) | 10            |
| `eight-immortals`            | 10/17 (59%)     | 17/17 (100%)   | 14/26 (54%)  | 26/26 (100%) | 17            |
| `english-football-champions` | 40/40 (100%)    | 40/40 (100%)   | 40/42 (95%)  | 42/42 (100%) | 13            |
| `english-monarchs`           | 42/46 (91%)     | 46/46 (100%)   | 45/64 (70%)  | 64/64 (100%) | 70            |
| `f1-champions`               | 32/34 (94%)     | 32/34 (94%)    | 46/47 (98%)  | 47/47 (100%) | 1             |
| `former-soviet`              | 16/20 (80%)     | 20/20 (100%)   | 16/24 (67%)  | 24/24 (100%) | 13            |
| `greek-muses`                | 10/13 (77%)     | 13/13 (100%)   | 10/17 (59%)  | 17/17 (100%) | 9             |
| `heisman`                    | 31/35 (89%)     | 32/35 (91%)    | 56/60 (93%)  | 60/60 (100%) | 5             |
| `masters-champions`          | 34/37 (92%)     | 35/37 (95%)    | 42/43 (98%)  | 43/43 (100%) | 2             |
| `mlb-teams`                  | 32/33 (97%)     | 33/33 (100%)   | 42/51 (82%)  | 51/51 (100%) | 20            |
| `moonwalkers`                | 24/32 (75%)     | 32/32 (100%)   | 16/23 (70%)  | 23/23 (100%) | 9             |
| `nba-mvp`                    | 26/32 (81%)     | 31/32 (97%)    | 39/44 (89%)  | 44/44 (100%) | 14            |
| `nba-teams`                  | 31/33 (94%)     | 33/33 (100%)   | 32/40 (80%)  | 40/40 (100%) | 15            |
| `nfl-teams`                  | 32/33 (97%)     | 33/33 (100%)   | 36/42 (86%)  | 42/42 (100%) | 15            |
| `nhl-teams`                  | 32/33 (97%)     | 33/33 (100%)   | 40/51 (78%)  | 51/51 (100%) | 15            |
| `nobel-peace`                | 29/37 (78%)     | 37/37 (100%)   | 61/64 (95%)  | 64/64 (100%) | 12            |
| `olympian-gods`              | 13/15 (87%)     | 15/15 (100%)   | 14/18 (78%)  | 18/18 (100%) | 5             |
| `pokemon-fire`               | 32/32 (100%)    | 32/32 (100%)   | 81/81 (100%) | 81/81 (100%) | 0             |
| `pokemon-gen1`               | 32/32 (100%)    | 32/32 (100%)   | 57/59 (97%)  | 57/59 (97%)  | 0             |
| `pokemon-legendary`          | 32/32 (100%)    | 32/32 (100%)   | 93/93 (100%) | 93/93 (100%) | 0             |
| `pokemon-types`              | 18/18 (100%)    | 18/18 (100%)   | 19/22 (86%)  | 22/22 (100%) | 19            |
| `pokemon-water`              | 32/32 (100%)    | 32/32 (100%)   | 84/84 (100%) | 84/84 (100%) | 0             |
| `popes-modern`               | 12/24 (50%)     | 24/24 (100%)   | 12/43 (28%)  | 43/43 (100%) | 56            |
| `secretaries-of-state`       | 43/46 (93%)     | 45/46 (98%)    | 43/51 (84%)  | 51/51 (100%) | 23            |
| `states-thirteen`            | 13/13 (100%)    | 13/13 (100%)   | 13/22 (59%)  | 22/22 (100%) | 24            |
| `summer-olympic-hosts`       | 26/27 (96%)     | 27/27 (100%)   | 27/30 (90%)  | 30/30 (100%) | 8             |
| `super-bowl-mvp`             | 31/33 (94%)     | 31/33 (94%)    | 51/51 (100%) | 51/51 (100%) | 0             |
| `super-bowl-winners`         | 40/41 (98%)     | 41/41 (100%)   | 35/36 (97%)  | 36/36 (100%) | 1             |
| `supreme-court-since-1981`   | 28/31 (90%)     | 31/31 (100%)   | 26/29 (90%)  | 29/29 (100%) | 11            |
| `tour-de-france`             | 36/36 (100%)    | 36/36 (100%)   | 41/41 (100%) | 41/41 (100%) | 0             |
| `triple-crown-horses`        | 13/13 (100%)    | 13/13 (100%)   | 13/16 (81%)  | 16/16 (100%) | 3             |
| `ucl-winners`                | 30/39 (77%)     | 39/39 (100%)   | 31/41 (76%)  | 41/41 (100%) | 22            |
| `uk-prime-ministers`         | 31/39 (79%)     | 38/39 (97%)    | 38/53 (72%)  | 53/53 (100%) | 61            |
| `un-secretaries-general`     | 20/21 (95%)     | 21/21 (100%)   | 22/24 (92%)  | 24/24 (100%) | 2             |
| `us-first-ladies`            | 42/46 (91%)     | 44/46 (96%)    | 46/47 (98%)  | 47/47 (100%) | 9             |
| `us-presidents`              | 29/35 (83%)     | 34/35 (97%)    | 52/62 (84%)  | 62/62 (100%) | 38            |
| `us-vice-presidents`         | 38/43 (88%)     | 42/43 (98%)    | 45/56 (80%)  | 56/56 (100%) | 29            |
| `wimbledon-men`              | 42/42 (100%)    | 42/42 (100%)   | 31/32 (97%)  | 32/32 (100%) | 3             |
| `wimbledon-women`            | 46/48 (96%)     | 48/48 (100%)   | 36/40 (90%)  | 40/40 (100%) | 7             |
| `winter-2026-disciplines`    | 20/20 (100%)    | 20/20 (100%)   | 21/22 (95%)  | 22/22 (100%) | 5             |
| `winter-olympic-hosts`       | 24/28 (86%)     | 28/28 (100%)   | 25/30 (83%)  | 30/30 (100%) | 10            |
| `world-chess-champions`      | 35/37 (95%)     | 37/37 (100%)   | 32/32 (100%) | 32/32 (100%) | 6             |
| `world-cup-hosts`            | 22/23 (96%)     | 23/23 (100%)   | 23/23 (100%) | 23/23 (100%) | 2             |
| `world-cup-winners`          | 10/12 (83%)     | 12/12 (100%)   | 10/13 (77%)  | 13/13 (100%) | 5             |
| `zelda-games`                | 28/31 (90%)     | 31/31 (100%)   | 30/36 (83%)  | 36/36 (100%) | 17            |

## Flagged prompts

These six prompts reach at least 95% on the shard corpus but stay below 95% on the frozen baseline. The only remaining misses are bare surnames shared by two or more members. Repo policy rules out arbitrary tie-breaks for ambiguous surnames, so these misses stay. The prompts are still complete and interesting, so I'd keep them; the merger decides.

- `baseball-hall-of-fame` (91.9%): Williams, Robinson, Martinez.
- `declaration-signers` (91.2%): Adams, Lee, Morris.
- `f1-champions` (94.1%): Rosberg (Keke and Nico), Hill (Graham and Damon).
- `heisman` (91.4%): Williams, Smith, Jackson.
- `masters-champions` (94.6%): Watson (Tom and Bubba), Johnson (Zach and Dustin).
- `super-bowl-mvp` (93.9%): Manning (Peyton and Eli), Smith.

Other notes:

- `pokemon-gen1`: a bare `Nidoran` (or `Nidoran♀`, which normalizes to the same key) is ambiguous between the female and male rows, so it stays a valid miss (57/59).
- `pokemon-types`: the spec counts 18 types plus Stellar. Shadow and ??? are marked invalid as special-case types. If the merger wants them, they need a scope decision, not just an alias.
- `secretaries-of-state`: John Jay is marked invalid because he only held the office ad interim. This is a judgment call.
- `uk-prime-ministers`: the pinned source runs through November 2026 and includes Andy Burnham. I didn't check that independently.
- None of the 49 prompts is dull enough to retire. The plainest are `us-presidents`, `nfl-teams`, `nba-teams`, `mlb-teams`, `nhl-teams` and `former-soviet`, but they are complete and fine as easy days.

## Size

The Worker gzip grows from 2946.24 KiB to 2949.85 KiB (+3.61 KiB, budget 4 KiB). Both figures are the `npm run build` "Total Upload" values, from this branch's generated output and the base branch's committed output.
