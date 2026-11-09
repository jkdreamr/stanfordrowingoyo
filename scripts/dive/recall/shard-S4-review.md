# Shard S4 completeness audit: film, TV and music

40 existing constrained prompts; no prompts added, removed or reordered, and `bases` untouched. `shard-S4-raw.json` is a frozen brainstorm of 1547 guesses (≥25 per prompt) written before inspecting answer data. `shard-S4-selected.json` keeps every raw string and annotates 211 genuinely wrong guesses with reasons.

**Added: 4 canonicals, 250 aliases.** Worker gzip 2946.24 → 2947.8 KiB (+1.56 KiB).

Baseline corpus: 1079/1192 (90.5%) → 1175/1192 (98.6%). Shard corpus: 1250/1336 (93.6%) → 1334/1336 (99.9%).

## Flagged

- `emmy-animated`: Baseline 18/30 (60%). The remaining 12 baseline misses are genuinely not Primetime Outstanding Animated Program winners (A Charlie Brown Christmas / Great Pumpkin / Thanksgiving won other Emmy categories; The Snowman and The Pink Panther Show were nominees; Adventure Time won juried/short-format; Kung Fu Panda: Legends of Awesomeness won Daytime Emmys; "Garfield"/"A Garfield Christmas" are ambiguous across four winning Garfield specials or a nominee). corpus.json is frozen, so the merger should annotate them invalid there. Shard corpus 14/14.
- `kubrick-films`: Baseline 18/19 (94.7%), shard 20/21 (95.2%). The only miss is the 66-character full title of Dr. Strangelove, which exceeds the 40-character input limit and cannot be typed; Dr. Strangelove, Doctor Strangelove and Strangelove are accepted.
- `disney-princesses`: Duplicates batch-3 disney-princess-lineup (same 13 official members); dull/plain and redundant. Merger may want to retire one.

## Source and alias decisions

- `emmy-animated`: the pinned revision bolds four winners whose program cell is unlinked plain text (King of the Hill, Samurai Jack, Camp Lazlo, Foster's Home for Imaginary Friends); link-based extraction missed them. Added via a reviewed `members` source on the same revision; expect 33 → 37.
- `tarantino-films`: "Kill Bill" and "Kill Bill: The Whole Bloody Affair" map to Volume 1 (an alias cannot point at both volumes); "Grindhouse" maps to Death Proof. Four Rooms (anthology segment), Sin City (guest scene), and written/produced-only credits are invalid.
- `emmy-limited`: "American Crime Story" maps to The People v. O. J. Simpson (both winning seasons are ACS; one canonical had to be chosen).
- `eurovision-winners`: "Ell & Nikki" maps to Ell (the source splits the duo into two rows).
- `stranger-things-s1`: "Chapter One"…"Chapter Eight" / "Chapter 1"…"Chapter 8" and "Chapter N: Title" forms are accepted; season-1 chapter numbers are unambiguous within this prompt.
- `beatles-albums`: "Let It Be... Naked" accepted as a Let It Be variant; compilations/remixes stay invalid.
- Surname-only guesses that are ambiguous within a prompt (Hoffman, Hepburn, Davis) stay unaccepted. Titles over 40 characters (full Dr. Strangelove and Ziggy Stardust titles) cannot be aliases.

## Per-prompt recall (hits/valid)

| ID                            | Size | +Canon | +Alias | Baseline before → after | Shard before → after |
| ----------------------------- | ---: | -----: | -----: | ----------------------- | -------------------- |
| `american-idol-winners`       |   24 |      0 |      2 | 40/41 → 41/41           | 25/27 → 27/27        |
| `bake-off-winners`            |   16 |      0 |     19 | 24/41 → 41/41           | 14/19 → 19/19        |
| `beatles-albums`              |   20 |      0 |      1 | 18/18 → 18/18           | 23/24 → 24/24        |
| `best-actor`                  |   87 |      0 |      6 | 28/30 → 29/30           | 47/49 → 49/49        |
| `best-actress`                |   81 |      0 |      0 | 29/30 → 29/30           | 45/45 → 45/45        |
| `best-animated-feature`       |   25 |      0 |      9 | 27/31 → 31/31           | 26/30 → 30/30        |
| `best-director`               |   75 |      0 |     13 | 28/30 → 30/30           | 44/50 → 50/50        |
| `best-original-song`          |   92 |      0 |      8 | 26/30 → 30/30           | 42/44 → 44/44        |
| `best-picture`                |   98 |      0 |      5 | 34/34 → 34/34           | 56/58 → 58/58        |
| `best-supporting-actor`       |   81 |      0 |      3 | 30/31 → 31/31           | 37/38 → 38/38        |
| `best-supporting-actress`     |   88 |      0 |      4 | 28/30 → 29/30           | 37/38 → 38/38        |
| `best-visual-effects`         |   87 |      0 |     12 | 27/31 → 31/31           | 45/48 → 48/48        |
| `bond-films`                  |   26 |      0 |      4 | 30/32 → 32/32           | 26/29 → 29/29        |
| `bowie-albums`                |   26 |      0 |      7 | 29/32 → 31/32           | 29/32 → 31/32        |
| `burton-films`                |   20 |      0 |      6 | 19/21 → 21/21           | 20/25 → 25/25        |
| `disney-canon`                |   64 |      0 |      6 | 31/32 → 32/32           | 57/60 → 60/60        |
| `disney-princesses`           |   13 |      0 |     12 | 14/14 → 14/14           | 14/18 → 18/18        |
| `emmy-animated`               |   37 |      4 |      2 | 16/30 → 18/30           | 12/14 → 14/14        |
| `emmy-comedy`                 |   45 |      0 |      4 | 32/34 → 34/34           | 27/28 → 28/28        |
| `emmy-drama`                  |   53 |      0 |      3 | 29/30 → 30/30           | 25/25 → 25/25        |
| `emmy-limited`                |   54 |      0 |      3 | 29/32 → 32/32           | 18/19 → 19/19        |
| `eurovision-winners`          |   75 |      0 |     27 | 30/43 → 43/43           | 46/47 → 47/47        |
| `ghibli-films`                |   25 |      0 |      8 | 27/32 → 32/32           | 27/30 → 30/30        |
| `grammy-album`                |   68 |      0 |      0 | 32/32 → 32/32           | 33/33 → 33/33        |
| `grammy-new-artist`           |   66 |      0 |      5 | 37/39 → 39/39           | 37/37 → 37/37        |
| `grammy-record`               |   68 |      0 |      2 | 31/33 → 33/33           | 38/38 → 38/38        |
| `grammy-song`                 |   69 |      0 |      2 | 34/35 → 35/35           | 41/42 → 42/42        |
| `hitchcock-films`             |   53 |      0 |      1 | 32/32 → 32/32           | 39/40 → 40/40        |
| `international-feature-oscar` |   78 |      0 |      0 | 38/38 → 38/38           | 42/42 → 42/42        |
| `kubrick-films`               |   13 |      0 |      4 | 16/19 → 18/19           | 17/21 → 20/21        |
| `mcu-films`                   |   38 |      0 |     19 | 32/38 → 38/38           | 40/47 → 47/47        |
| `nolan-films`                 |   13 |      0 |      0 | 15/15 → 15/15           | 17/17 → 17/17        |
| `pink-floyd-albums`           |   15 |      0 |      3 | 24/26 → 26/26           | 22/22 → 22/22        |
| `pixar-films`                 |   31 |      0 |      0 | 32/32 → 32/32           | 31/31 → 31/31        |
| `queen-albums`                |   16 |      0 |      1 | 21/21 → 21/21           | 18/19 → 19/19        |
| `spielberg-films`             |   37 |      0 |      9 | 31/35 → 35/35           | 38/42 → 42/42        |
| `star-trek-original-episodes` |   79 |      0 |      0 | 36/36 → 36/36           | 46/46 → 46/46        |
| `stranger-things-s1`          |    8 |      0 |     25 | 15/23 → 23/23           | 16/20 → 20/20        |
| `swift-albums`                |   12 |      0 |      5 | 15/15 → 15/15           | 19/22 → 22/22        |
| `tarantino-films`             |   10 |      0 |     10 | 13/14 → 14/14           | 14/20 → 20/20        |
