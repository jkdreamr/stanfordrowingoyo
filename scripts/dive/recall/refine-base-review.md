# Refinement base

Base: `d9f96cfed310ad709dd8cb89084c1eedfacf3118`. This branch does not replace
slots or edit the R1–R9 prompt blocks. Legacy files and metadata are frozen separately
in `../legacy-manifest.json`; the November 23 cutover does not change earlier dates.

## Aliases and ambiguity

The four common forms were identified in the read-only review before this phase;
`refine-base-selected.json` freezes those guesses. `recall.mjs` appends them to the
existing MCU corpus without modifying historical guesses or invalid annotations.

| Prompt                | Before                                    | After                                                        |
| --------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| mcu-films             | No exact Avengers 3 key                   | Avengers: Infinity War                                       |
| mcu-films             | No exact Avengers 4 key                   | Avengers: Endgame                                            |
| mcu-films             | No exact Spiderman Homecoming key         | Spider-Man: Homecoming                                       |
| mcu-films             | No exact Captain America 4 key            | Captain America: Brave New World                             |
| masters-champions     | Wood/Woods normalizes to Tiger Woods      | Neither bare key; Craig Wood, Tiger Woods and Tiger retained |
| us-banknote-portraits | Washington maps to George Washington      | No bare key; George/Martha Washington and Martha retained    |
| ballon-dor-winners    | Ronaldo is the canonical Brazilian player | Preserved; never assigned to Cristiano Ronaldo               |

The surname guard prunes explicitly supplied ambiguous aliases too, so automatic
regeneration cannot restore them. No matcher or normalizer changes. Existing bare
Washington/Woods guesses remain valid recall misses, not newly labelled invalid.
No new canonical members, so no fresh membership brainstorm is required.

Skipped aliases owned by other sessions: Golden State (`nba-teams`), Much Ado
(`shakespeare-plays`), Van Gogh (`lego-ideas-sets`).

## Pearls

All replacements are existing members with unchanged pinned provenance. Rarity is
an editorial judgment: these names are less immediately recognizable than the old
Pearls, not new disputed or invalid members.

| Prompt             | Old Pearl     | New Pearl                           |
| ------------------ | ------------- | ----------------------------------- |
| chinese-cuisines   | Cantonese     | Anhui                               |
| beaufort-winds     | Hurricane     | Light air                           |
| best-actor         | Nicolas Cage  | Emil Jannings                       |
| best-actress       | Michelle Yeoh | Luise Rainer                        |
| best-director      | Bong Joon-ho  | Frank Borzage                       |
| grammy-album       | Rumours       | The Button-Down Mind of Bob Newhart |
| best-original-song | Lose Yourself | The Continental                     |
| cloud-genera       | Cumulonimbus  | Cirrocumulus                        |

Skipped replacement-owned Pearl flags: `us-presidents` (Theodore Roosevelt),
`bond-films` (GoldenEye), `hitchcock-films` (Rear Window), `kubrick-films`
(Full Metal Jacket), `nolan-films` (The Prestige), `shakespeare-plays`
(A Midsummer Night's Dream). Michelin's Chez Nico belongs to R9.

## Too Clever

Removed the explicit Too Clever override; answers remain valid and use ordinary
familiarity-ranked tiers. All six are outside the exclusion list.

| Prompt                   | Former Too Clever pick  |
| ------------------------ | ----------------------- |
| nba-75-team              | Stephen Curry           |
| population-100m          | Indonesia               |
| test-cricket-teams       | New Zealand             |
| turing-award-winners     | Geoffrey Hinton         |
| mission-impossible-films | Mission: Impossible III |
| wizarding-world-films    | Prisoner of Azkaban     |
