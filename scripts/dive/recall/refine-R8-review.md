# R8 everyday prompt refinement

Base: `d9f96cfed310ad709dd8cb89084c1eedfacf3118`. Only the seven requested old specs are retired; all their other fields are unchanged. Each new spec immediately follows its predecessor. Historical generated artifacts are restored before commit as requested; regeneration is needed to materialize the prospective cycle.

## Recall and set sizes

Before means canonical-only exact normalized membership against the same reviewed denominator; after includes reviewed aliases. No fuzzy matching. Every selected guess is copied in its original order, with only genuinely out-of-scope guesses annotated. The audit records frozen and selected SHA-256, tiers, alias counts, invalid reasons and overlaps. This is one model's regression sample, not player-survey evidence.

| Prompt                   | Members (band) | Before → after | Invalid |
| ------------------------ | -------------- | -------------- | ------- |
| le-mans-winning-makes    | 25 (standard)  | 23/30 → 30/30  | 9       |
| a380-airlines            | 16 (tiny)      | 15/26 → 26/26  | 10      |
| spiel-des-jahres-winners | 48 (standard)  | 34/37 → 37/37  | 7       |
| video-game-hall-of-fame  | 53 (standard)  | 41/52 → 52/52  | 19      |
| generic-trademarks       | 205 (huge)     | 63/64 → 64/64  | 15      |
| toy-hall-of-fame         | 95 (standard)  | 67/74 → 74/74  | 6       |
| monopoly-tokens          | 15 (tiny)      | 16/29 → 29/29  | 5       |

## Frozen brainstorm disclosure

The three raw files were supplied already frozen. Their SHA-256s match `~/work/R8-raw.sha`; none was edited. Source review happened after those brainstorms, with one disclosed exception: **the A380 member list was seen in the review attachment before the brainstorm was written**. That corpus is not an independent blind membership test. No guesses were added, removed, reordered or rewritten to improve recall.

Rejected candidates remain in the raw files untouched: **chess-openings-places** has a huge/obscure source list; **cereal-mascots** mixes mascots and non-mascots with messy scope; **boeing-7x7-jetliners** is a closed nine-number family that is trivially enumerable.

## Replacement map and pinned scopes

### star-alliance → le-mans-winning-makes

- [List of 24 Hours of Le Mans winners, oldid 1381313577](https://en.wikipedia.org/w/index.php?oldid=1381313577): wikitable 7, column 0; exact count 25. All distinct manufacturer rows, including separate Mercedes-Benz and Sauber-Mercedes. Table 4 overall winning cars cross-checked; Toyota includes 2026. Mazda won with a rotary in 1991.

### oneworld-airlines → a380-airlines

- [List of Airbus A380 operators, oldid 1375046227](https://en.wikipedia.org/w/index.php?oldid=1375046227): wikitable 0 + 1, column 0; exact count 16. Union of 11 current and five former operators; no unfulfilled orders. Member list was seen in the review attachment before the frozen brainstorm was written.

### monopoly-uk → spiel-des-jahres-winners

- [Spiel des Jahres, oldid 1383909119](https://en.wikipedia.org/w/index.php?oldid=1383909119): wikitable 95, column 1; exact count 48. Main Game of the Year winners only, 1979–2026 inclusive; excludes nominees, Kennerspiel, Kinderspiel and special awards. Full cell text includes unlinked winners. JinxO is also Dito!.

### monopoly-us → video-game-hall-of-fame

- [World Video Game Hall of Fame, oldid 1384356911](https://en.wikipedia.org/w/index.php?oldid=1384356911): wikitable 1, column 1; exact count 53. Exactly one trailing asterisk marks an inducted game; double asterisk marks a finalist inducted in a later year and is excluded here. Union through class 2026; next class May 2027.

### css-named-colors → generic-trademarks

- [List of generic and genericized trademarks, oldid 1383147456](https://en.wikipedia.org/w/index.php?oldid=1383147456): reviewed members; exact count 39. All dt names in both definition-list sections: 26 former genericized and 13 lost for other reasons. Sellotape overlaps the protected-mark table; deduplicate the union.
- [List of generic and genericized trademarks, oldid 1383147456](https://en.wikipedia.org/w/index.php?oldid=1383147456): wikitable 0, column 0; exact count 167. All 167 protected marks used generically. Strip interwiki language labels from display names; comma-separated spelling variants become aliases, not extra members.

### magic-eight-ball-responses → toy-hall-of-fame

- [National Toy Hall of Fame, oldid 1384122714](https://en.wikipedia.org/w/index.php?oldid=1384122714): reviewed members; exact count 95. First inducted-toys list under each class heading, not subsequent finalists; original inductees plus classes 2000–2026. All 95 rows checked; final four are Bingo, Care Bears, Pokémon Trading Card Game and Slide. Clean display labels preserve each identity.

### london-tube-lines → monopoly-tokens

- [Monopoly (game), oldid 1383315669](https://en.wikipedia.org/w/index.php?oldid=1383315669): reviewed members; exact count 15. Classic Tokens prose: ten present by 1943 plus money bag (1999), cat (2013), penguin, Tyrannosaurus rex and rubber duck (2017). Includes later-retired pieces; excludes pre-1943-only, special-edition and voting candidates.

All sources were fetched using the pinned parse API and extracted member-by-member. `generate.py --verify-sources --check` passed for the complete bank. No changes to `sources.py` were needed. Spiel uses full cell text because two winners have no ordinary /wiki link. Hall of Fame's single-asterisk predicate is `(?<!\\*)\\*(?!\\*)$`, excluding double-asterisk finalists; 53 distinct inductees remain through 2026.

The generic-mark sources have 39 definition terms (26 + 13) and 167 table rows, **206 rows but 205 unique members**, because Sellotape occurs in both. Yo-Yo appears only in the definition terms. Language tags are removed from Aqua and Doll Instant Noodle displays. Plexiglass and HardiePlank become aliases of Plexiglas and Hardie Board; no comma-separated extra canonicals are introduced. **15 frozen trademark guesses miss this source-defined set**; Laundromat and Polaroid are present and accepted.

The toy list uses the first inductee list per class, never the subsequent finalists. Literal source forms are preserved in source members; cleaned displays include Stick, Baby doll, Skateboard, Slime, My Little Pony, Transformers and Crayola crayons. Magic: The Gathering remains distinct from Magic 8 Ball. The 2026 final four bring the set to 95, matching the page statement.

Mercedes-Benz and Sauber-Mercedes remain separate source rows: Mercedes belongs only to Mercedes-Benz, Sauber only to Sauber-Mercedes. Matra, Renault/Alpine, Talbot and Chenard-Walcker identify their requested source makes. Table 4 winning cars were separately checked before excluding the nine unsuccessful makes. Bugatti Type 57 is a winning-model identification of Bugatti, not a new make. Ordinary unaccented/punctuation variants already handled by normalization are not duplicated in alias arrays.

## Invalid review

- **le-mans-winning-makes (9):** Cadillac; Chevrolet; Corvette; Lancia; Lotus; Nissan; Honda; Dodge; Delage. No overall-winning make in pinned manufacturer table; checked winning cars in table 4.
- **a380-airlines (10):** Cathay Pacific; Delta Air Lines; United Airlines; American Airlines; Virgin Atlantic; Air India; Turkish Airlines; Japan Airlines; Saudia; Air China. Not a current or former A380 operator on the pinned list. Ordered A380s but cancelled; never operated the type.
- **spiel-des-jahres-winners (7):** Cartagena; Pandemic; 7 Wonders; Splendor; Wingspan; The Crew; Labyrinth. Not a main Spiel des Jahres winner in the pinned all-winners table.
- **video-game-hall-of-fame (19):** Frogger; Galaga; Guitar Hero; Candy Crush Saga; Metroid; Super Mario 64; Pokémon Go; Zork; Rogue; Half-Life; Call of Duty; Fortnite; Minesweeper; Breakout; Final Fantasy; Mega Man; Castlevania; Elder Scrolls V: Skyrim; Skyrim. Not inducted through the pinned 2026 class; finalists alone do not qualify.
- **generic-trademarks (15):** Kitty Litter; Teflon; Windbreaker; Weed eater; Breathalyzer; Granola; Novocain; Tabasco; Spandex; Lycra; Bic; Pilates; Crayola; Scotchgard; Sheetrock. not on the pinned list
- **toy-hall-of-fame (6):** Spirograph; Furby; Tickle Me Elmo; Operation; Pogo stick; Sled. Not inducted through the pinned 2026 class; finalists alone do not qualify.
- **monopoly-tokens (5):** Lantern; Purse; Rocking horse; Howitzer; Train. Not a standard-set token since 1943; pre-1943-only or special-edition pieces do not qualify.

No generic-mark exclusion claims the brand is never generic in ordinary speech; “not on the pinned list” is deliberately the source-defined boundary. Monopoly's Howitzer is not treated as a synonym for Cannon: it is not the named standard-set token. Train belongs to special editions. Pre-1943-only Lantern/Purse/Rocking horse are excluded. The main Spiel award excludes Kennerspiel, Kinderspiel, nominees and special awards; Barbarossa is a main winner and stays valid.

## Canonical-overlap scan

Every new normalized canonical set was compared with every other active scheduled set (320 total). Fraction of the smaller set is the conservative duplicate threshold; no pair reaches 50%. Homographs count as overlaps, even across themes.

| New prompt               | Maximum partner         | Intersection | Fraction of new set | Fraction of smaller set |
| ------------------------ | ----------------------- | ------------ | ------------------- | ----------------------- |
| le-mans-winning-makes    | volkswagen-group-brands | 3            | 12.00%              | 17.65%                  |
| a380-airlines            | skyteam-airlines        | 2            | 12.50%              | 12.50%                  |
| spiel-des-jahres-winners | iba-cocktails           | 1            | 2.08%               | 2.08%                   |
| video-game-hall-of-fame  | smash-64-fighters       | 1            | 1.89%               | 8.33%                   |
| generic-trademarks       | stellantis-brands       | 1            | 0.49%               | 7.14%                   |
| toy-hall-of-fame         | monopoly-tokens         | 2            | 2.11%               | 13.33%                  |
| monopoly-tokens          | toy-hall-of-fame        | 2            | 13.33%              | 13.33%                  |

Global maximum: **17.65%**, Le Mans makes versus Volkswagen group brands, 3/17 (3/25 of the new set).

## Checks and budget

- Generator passed: 650 runtime modules, 95 unreachable candidates omitted; 64 days, 320 constrained scheduled prompts.
- Source verification/check passed against every pinned source, not just the seven additions.
- Exact recall: all seven meet 100%. Overall recall command exits 1 because other historical prompts remain below its 95% threshold (e.g. declaration-signers 31/34); overall 8840/8869, 99.67%. No unrelated alias edits made.
- Python: 30 tests, two failures. Fixed-count expectation 387 now sees 394; fixed retired-ID expectation lacks these seven retirements. Tests were not edited outside permitted scope.
- Node recall tests: 15 tests, 14 pass, one fails because the original replacement-batch test imports the now-retired css-named-colors runtime module removed by generation. Historical specs remain intact; requested generated-output restore restores that file after measuring.
- Build passed. Measured clean base Worker gzip **2993.75 KiB**, prospective Worker gzip **2996.53 KiB**, delta **+2.78 KiB**. This **exceeds +1.5 KiB by 1.28 KiB**; no members were cut to hide the overage. Both build logs live in `~/work/R8-build-{before,after}.log`.
- An initial generator invocation lacked Node on PATH; loading `~/.nvm/nvm.sh` resolved the environment and the generator then passed. No dependency or shared-config changes.

Formatting passes for the edited manifest, evaluator and three authored review artifacts. The three supplied frozen raw files fail Prettier's style check. They are intentionally preserved byte-for-byte rather than reformatted, honoring the explicit frozen SHA-256 requirement; a repository-wide format check will report them.

This is data-only; no UI visual check was requested or performed.
