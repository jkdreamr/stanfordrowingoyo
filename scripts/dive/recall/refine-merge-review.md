# Integrated Dive refinement review

Reference: base refinement `b68cb02`, itself based on `d9f96cf`. Review date: **9 November 2026**. Cutover remains **2026-11-23**. All nine shards were merged normally, with no force or rebase; all shard prompt blocks were retained. No matcher/routes/web/shared-type/registry-flag edits. Only the allowed retired-count assertion was changed in the Worker test.

## Merged shard heads

| Shard | Head                                       |
| ----- | ------------------------------------------ |
| R1    | `c5795178458207f89437de94e1ae9cbe4c4630be` |
| R2    | `4c353020719e0876878f7e6de1d0565447a2a99e` |
| R3    | `dd29129d7933b6ceb062b28cd5f08c152f678dee` |
| R4    | `4053544d41d917d64f36e28acd7ccab19b7ea774` |
| R5    | `d910a0dadf21f401f4b432f2f72ebe406c9d0b1a` |
| R6    | `73e766e8caa0fa5185ae7f69b0afc6980388dd9b` |
| R7    | `d282fc89c00a271fc302e43c6e69d76de83b23e8` |
| R8    | `003a58f74d5b173c80985af6db2ef7683de85fa7` |
| R9    | `f9d251401397544e975009b0ed920f42b0d327aa` |

## Problems found and fixed

- Coherently combine every disjoint R1–R8 corpus, append base and territory refinements, then apply the R9 selected-corpus override. No shard registration was dropped.
- Maintain exact catalog assertions: **432 constrained specs; 320 active; 112 retired**. Historical recall still checks original raw order, invalid annotations and floors, but no longer imports six deliberately retired/unreachable sets. New tests prove those six retirements and missing modules, and test every new shard corpus, invalid rejection and >=95% per-prompt exact recall.
- Replace unreachable NBA alias and president suggestion fixtures with reachable equivalent-strength fixtures; no thresholds were lowered. Only scripts/dive tests, plus the allowed Worker retired-count assertion, changed.
- Remove the new Sodium alias **Na**: the protected matcher reserves normalized `na` as a stopword. Sodium stays valid. The frozen Na guess remains a valid exact miss, **35/36 (97.22%)**, not an invalid relabelling.
- Remove internal full stops from NBA/Hot 100 question wording to satisfy the existing one-sentence text policy. Shorten China-compass, US census-capital and Grammy/VMA wording to the existing 85-character cap. China's Chinese-name direction rule and the 2020 Census city-proper comparison remain intact.
- Bound both Hot 100 questions **before November 2026**. Direct Billboard check of [the November 7, 2026 chart](https://www.billboard.com/charts/hot-100/2026-11-07/) showed **Choosin' Texas, No. 1, 26 weeks at No. 1**. Do not rely on the old claim that a new qualifying record is implausible: later runs/covers are explicitly excluded.
- Make sports-record bounds visible: NBA before 2027, MLB before 2026, NHL at end of 2025–26 and Olympic medals before 2027. These match the existing pinned member sets. No next draft/Olympics can occur during the cycle.
- Make Live Aid scope visibly the two stadium running orders, with credited guests and named finale acts; this is not every unbilled individual participant or satellite performance.
- Bound A380 operators before November 2026, Le Mans and Spiel/Video Game Hall winners before 2027, and Monopoly standard tokens to 1943–October 2026. Source membership is unchanged. Next scheduled annual events/classes fall after this cycle.
- **Editorial scope decision:** generic trademarks formerly claimed broad real-world generic usage while labelling 15 guesses invalid merely because absent from the source. The visible question now explicitly asks for Wikipedia's generic-trademarks list **as of 9 November 2026**. Those exclusions are now genuinely outside the named source-defined question, not claims that those words can never be generic in any language. This is an intentional narrowing, not fabricated recall improvement. No brainstorm guess was removed.
- Macbeth includes approved novellas, so say **novel or novella** and quote/title match rather than requiring an author's stated origin. **Brief Candles** was labelled invalid as Huxley's collection, but normalizes to the newly included valid novel **Brief Candle**. The raw spelling has ambiguous intent and is now conservatively a valid accepted guess; it cannot be labelled an exact reject while the qualifying novel is accepted. No matcher change. This updates the shard's earlier annotation, not the frozen raw text.
- Mediterranean **24 → 23**: remove UK and its aliases. Make France's already documented overseas-border exception visible in the question. Correct island-country acceptance notes that contradicted the pinned source by claiming continental Australia counts. See the complete **44-prompt territory review** in [refine-territory-review.md](refine-territory-review.md), including member-by-member exception cases and source revisions.
- R8's three raw files needed Prettier layout changes. Parsed JSON values/order were compared with `003a58f` and remain identical; the old raw-byte hashes in the historical shard audit describe its pre-format files. No guess was added, deleted, reordered or rewritten.

### Pearl corrections

| Prompt                          | Before                             | After                  |
| ------------------------------- | ---------------------------------- | ---------------------- |
| oscar-five-wins-no-best-picture | Mary Poppins                       | Wilson                 |
| oscar-song-and-score-films      | Butch Cassidy and the Sundance Kid | Born Free              |
| oscar-costume-and-design-films  | The Grand Budapest Hotel           | Nicholas and Alexandra |
| oscar-supporting-pair-films     | A Streetcar Named Desire           | Sayonara               |
| le-mans-winning-makes           | Mazda                              | Chenard & Walcker      |
| spiel-des-jahres-winners        | Hanabi                             | Drunter und Drüber     |
| monopoly-tokens                 | Penguin                            | Horse and rider        |
| generic-trademarks              | Escalator                          | Connollising           |

These are relative editorial difficulty judgments, not empirical player familiarity measurements. All replacements are source members. Other Surface/Too Clever picks were retained after review.

## All 45 new questions

Read each new spec and R1–R8 review; R9's current Michelin/LEGO checks and time-bound updates remain included. Counts and exact recall below use the generated runtime sets and frozen selected corpora, not canonical-only alias-free approximations. The first source is linked here; full source graphs and all revision IDs remain in constrained.json and the shard audits.

| ID                                      | Question                                                                              | Theme     | Members | Exact recall | Primary pinned source                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------- | --------- | ------: | ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `national-film-registry-1989`           | Name a film selected for the National Film Registry in its inaugural year, 1989.      | film      |      25 | 24/24        | [National Film Registry](https://en.wikipedia.org/w/index.php?oldid=1384519422)                                        |
| `stephen-king-theatrical-films`         | Name a theatrically released feature film adapted from a Stephen King story, by 2025. | film      |      46 | 41/41        | [List of adaptations of works by Stephen King](https://en.wikipedia.org/w/index.php?oldid=1384004791)                  |
| `oscar-five-wins-no-best-picture`       | Name a film that won at least five competitive Oscars but not Best Picture.           | film      |      16 | 20/20        | [List of Academy Award–winning films](https://en.wikipedia.org/w/index.php?oldid=1365065191)                           |
| `live-action-batman-actors`             | Name an actor who played Batman in a live-action theatrical film or serial, by 2025.  | film      |       9 | 22/22        | [Batman in film](https://en.wikipedia.org/w/index.php?oldid=1379246665)                                                |
| `worldwide-box-office-record-films`     | Name a film that has held the all-time worldwide box-office record, by 2025.          | film      |      11 | 20/20        | [List of highest-grossing films](https://en.wikipedia.org/w/index.php?oldid=1384541318)                                |
| `oscar-song-and-score-films`            | Name a film that won Oscars for both a song and its score.                            | film      |      20 | 25/25        | [Academy Award for Best Original Song](https://en.wikipedia.org/w/index.php?oldid=1380826630)                          |
| `annual-worldwide-box-office-1990-2025` | Name the top-grossing film worldwide of its release year, for any year in 1990–2025.  | film      |      38 | 40/40        | [List of highest-grossing films](https://en.wikipedia.org/w/index.php?oldid=1384541318)                                |
| `bond-villain-actors`                   | Name an actor who played a main villain in an official Eon James Bond film.           | film      |      36 | 30/31        | [List of James Bond villains](https://en.wikipedia.org/w/index.php?oldid=1383256511)                                   |
| `nba-first-overall-picks`               | Name a first overall NBA draft pick before 2027.                                      | sports    |      80 | 66/66        | [List of first overall NBA draft picks](https://en.wikipedia.org/w/index.php?oldid=1384376407)                         |
| `nfl-former-names`                      | Name a former team name of a current NFL franchise.                                   | sports    |      29 | 30/31        | [Arizona Cardinals](https://en.wikipedia.org/w/index.php?oldid=1384178060)                                             |
| `mlb-50-homer-seasons`                  | Name a player with a 50-home-run MLB season before 2026.                              | sports    |      34 | 41/41        | [50 home run club](https://en.wikipedia.org/w/index.php?oldid=1382671764)                                              |
| `nhl-500-goal-club`                     | Name a player with 500 career NHL goals by the end of the 2025–26 season.             | sports    |      50 | 56/56        | [List of NHL players with 500 goals](https://en.wikipedia.org/w/index.php?oldid=1366079374)                            |
| `presidents-ex-congress`                | Name a US president who served in the US Congress before becoming president.          | history   |      26 | 26/26        | [List of presidents of the United States by other offices held](https://en.wikipedia.org/w/index.php?oldid=1374388644) |
| `vps-never-president`                   | Name a former US vice president who never became president.                           | history   |      34 | 33/33        | [List of vice presidents of the United States](https://en.wikipedia.org/w/index.php?oldid=1368745602)                  |
| `pms-two-queens`                        | Name a British prime minister who served under Queen Victoria or Queen Elizabeth II.  | history   |      25 | 26/26        | [List of prime ministers of the United Kingdom](https://en.wikipedia.org/w/index.php?oldid=1378424861)                 |
| `japan-same-name-capitals`              | Name a Japanese prefecture whose capital is a city of the same name.                  | geography |      29 | 33/33        | [Prefectures of Japan](https://en.wikipedia.org/w/index.php?oldid=1384359576)                                          |
| `alpine-four-thousanders`               | Name one of the 82 official four-thousand-metre peaks of the Alps.                    | geography |      82 | 46/46        | [List of mountains of the Alps over 4000 metres](https://en.wikipedia.org/w/index.php?oldid=1375970569)                |
| `rivers-3000-km`                        | Name a river or river system more than 3,000 kilometres long.                         | geography |      28 | 39/39        | [List of river systems by length](https://en.wikipedia.org/w/index.php?oldid=1384635915)                               |
| `us-capitals-not-largest`               | Name a US state capital that wasn't its state's largest city in the 2020 census.      | geography |      33 | 35/35        | [List of capitals in the United States](https://en.wikipedia.org/w/index.php?oldid=1381021740)                         |
| `islands-50000-km2`                     | Name an island with an area of more than 50,000 square kilometres.                    | geography |      28 | 30/30        | [List of islands by area](https://en.wikipedia.org/w/index.php?oldid=1384175972)                                       |
| `china-compass-names`                   | Name a Chinese province-level division with a compass direction in its Chinese name.  | geography |      14 | 27/27        | [Provincial-level divisions of China](https://en.wikipedia.org/w/index.php?oldid=1376622017)                           |
| `element-symbol-words`                  | Name an element whose chemical symbol is also a two-letter English word.              | science   |      26 | 35/36        | [List of chemical elements](https://en.wikipedia.org/w/index.php?oldid=1377683963)                                     |
| `le-mans-winning-makes`                 | Name a car make that won the 24 Hours of Le Mans outright before 2027.                | everyday  |      25 | 30/30        | [List of 24 Hours of Le Mans winners](https://en.wikipedia.org/w/index.php?oldid=1381313577)                           |
| `a380-airlines`                         | Name an airline that had flown the Airbus A380 before November 2026.                  | everyday  |      16 | 26/26        | [List of Airbus A380 operators](https://en.wikipedia.org/w/index.php?oldid=1375046227)                                 |
| `justices-thirty-years`                 | Name a US Supreme Court justice who served at least 30 years on the Court.            | history   |      16 | 14/14        | [List of justices of the Supreme Court of the United States](https://en.wikipedia.org/w/index.php?oldid=1382428803)    |
| `video-game-hall-of-fame`               | Name a game inducted into the World Video Game Hall of Fame before 2027.              | everyday  |      53 | 52/52        | [World Video Game Hall of Fame](https://en.wikipedia.org/w/index.php?oldid=1384356911)                                 |
| `spiel-des-jahres-winners`              | Name a winner of Germany's Spiel des Jahres board-game award before 2027.             | everyday  |      48 | 37/37        | [Spiel des Jahres](https://en.wikipedia.org/w/index.php?oldid=1383909119)                                              |
| `books-sold-100m`                       | Name a book with 100M+ estimated sales, excluding religious and political texts.      | books     |       8 | 9/9          | [List of best-selling books](https://en.wikipedia.org/w/index.php?oldid=1384375148)                                    |
| `ala-challenged-2010s`                  | Name a book on any ALA annual top 10 most challenged list, 2010–2019.                 | books     |      56 | 38/38        | [ALA annual Top 10 archive, 2010–2019](https://www.ala.org/bbooks/frequentlychallengedbooks/top10/archive)             |
| `big-read-top-21`                       | Name a book in the final top 21 of the BBC's 2003 Big Read poll.                      | books     |      21 | 22/22        | [The Big Read](https://en.wikipedia.org/w/index.php?oldid=1364480637)                                                  |
| `riaa-20x-platinum-albums`              | Name an album the RIAA had certified 20× Platinum or higher before November 2026.     | music     |      14 | 20/20        | [List of best-selling albums in the United States](https://en.wikipedia.org/w/index.php?oldid=1382900965)              |
| `lakes-10000-km2`                       | Name a lake with a surface area of more than 10,000 square kilometres.                | geography |      17 | 28/28        | [List of lakes by area](https://en.wikipedia.org/w/index.php?oldid=1377951139)                                         |
| `monopoly-tokens`                       | Name a token used in the standard Monopoly set between 1943 and October 2026.         | everyday  |      15 | 29/29        | [Monopoly (game)](https://en.wikipedia.org/w/index.php?oldid=1383315669)                                               |
| `beatles-name-songs`                    | Name a Beatles song released 1962–1970 with a person's name in its title.             | music     |      27 | 42/42        | [List of songs recorded by the Beatles](https://en.wikipedia.org/w/index.php?oldid=1383601980)                         |
| `live-aid-1985-performers`              | Name an act in Live Aid's 1985 Wembley or Philadelphia running order.                 | music     |      78 | 54/54        | [Live Aid](https://en.wikipedia.org/w/index.php?oldid=1384245974)                                                      |
| `hot100-number-one-two-versions`        | Name a song with Hot 100 number-one versions by two artists before November 2026.     | music     |       9 | 12/12        | [List of Billboard Hot 100 chart achievements and milestones](https://en.wikipedia.org/w/index.php?oldid=1383964879)   |
| `olympic-eight-golds`                   | Name an Olympian with at least eight gold medals before 2027.                         | sports    |      19 | 23/23        | [List of multiple Olympic gold medalists](https://en.wikipedia.org/w/index.php?oldid=1371311121)                       |
| `hot100-14-week-number-ones`            | Name a song with 14+ weeks at number one on the Hot 100 before November 2026.         | music     |      15 | 17/17        | [List of Billboard Hot 100 chart achievements and milestones](https://en.wikipedia.org/w/index.php?oldid=1383964879)   |
| `macbeth-phrase-novels`                 | Name a novel or novella whose title quotes a phrase from Macbeth.                     | books     |      46 | 28/28        | [List of works titled after Shakespeare](https://en.wikipedia.org/w/index.php?oldid=1378451720)                        |
| `generic-trademarks`                    | Name a brand in Wikipedia's generic-trademarks list as of 9 November 2026.            | everyday  |     205 | 64/64        | [List of generic and genericized trademarks](https://en.wikipedia.org/w/index.php?oldid=1383147456)                    |
| `toy-hall-of-fame-originals`            | Name a toy among the National Toy Hall of Fame's original inductees.                  | everyday  |      17 | 21/21        | [National Toy Hall of Fame](https://en.wikipedia.org/w/index.php?oldid=1384122714)                                     |
| `oscar-costume-and-design-films`        | Name a film that won Oscars for both Costume Design and Production Design.            | film      |      46 | 33/33        | [Academy Award for Best Costume Design](https://en.wikipedia.org/w/index.php?oldid=1374921507)                         |
| `vma-grammy-video-double`               | Name a video that won both MTV Video of the Year and the Best Music Video Grammy.     | music     |       9 | 8/8          | [MTV Video Music Award for Video of the Year](https://en.wikipedia.org/w/index.php?oldid=1383431892)                   |
| `oscar-supporting-pair-films`           | Name a film that won both supporting-acting Oscars.                                   | film      |       9 | 11/11        | [Academy Award for Best Supporting Actor](https://en.wikipedia.org/w/index.php?oldid=1378698429)                       |
| `jupiter-spacecraft`                    | Name a spacecraft that has flown past or orbited Jupiter.                             | science   |       9 | 21/21        | [Exploration of Jupiter](https://en.wikipedia.org/w/index.php?oldid=1376446589)                                        |

### Further recall/completeness corrections

- Add the full **The Lord of the Rings: The Return of the King** alias in both Oscar intersections. The frozen full-title misses now hit exactly: Song+Score **25/25**, Costume+Design **33/33**. No guess was added.
- Correct R6's omission of **Lake Michigan–Huron**, taking the lake set **16 → 17** and recall **27/28 → 28/28**. Independently opened [revision 1382712580](https://en.wikipedia.org/w/index.php?oldid=1382712580): the introduction identifies one hydrological lake and the infobox gives **117,300 km²**. The source explicitly compares its area with the separately named conventional lakes. That is a genuine qualifying member, not an invalid guess or an overlap-based exclusion. Add this positive revision as a second source; its one-member expect guard is separate from the original 16-row table.
- Annual box-office membership is 38 across 36 years deliberately: original-run and rerelease-adjusted leaders are both represented in the pinned table for 1995 and 2005.

## Immutable-source audit

Audited **429 distinct pins across all bases and prompts, including retired specs**. Of the **20 distinct dataset URLs**, eleven were mutable R7 pages: ALA archive; seven Open Library book/ISBN JSON records; the Caluen and Gueron author pages; Angus & Robertson's Larsen book page. Every one was re-fetched and matched the original SHA-256 **exactly**, then copied byte-for-byte to a content-addressed `scripts/dive/snapshots/<sha256>.raw` file. Original URLs remain attribution in `original_url`; generation reads only the local snapshots. No source bytes or hashes were substituted.

The remaining nine datasets already use full commit-pinned GitHub URLs or a Wiktionary oldid. All non-dataset sources use positive integer Wikipedia revisions. New validation rejects mutable dataset URLs, branch-name raw URLs and nonpositive/noninteger Wikipedia revisions. Tests re-extract every local snapshot with network access disabled, cover original CRLF preservation/checksums, title parsing, missing titles, and incomplete/duplicate ALA years. See snapshots/README.md. Legacy acquisition and files were not changed.

## Informational overlap and topics

Across all 320 scheduled prompts, actual shared-normalized canonical intersection divided by the smaller answer set yields **58 pairs >=50%**. **Zero involve a new prompt**. Full pairs and canonical intersections are in [refine-merge-audit.json](refine-merge-audit.json). Aliases are excluded from this comparison. No prompt was altered merely for overlap.

New same-topic families (different questions, not same-question duplicates):

- Four Oscar film intersections and the pre-existing Oscar film sets: five wins without Picture; Song+Score; Costume+Production Design; both supporting-acting wins.
- Hot 100 14-week leaders vs songs reaching No. 1 in two artists' versions; RIAA albums and Grammy/VMA video intersection are other music-achievement questions, not duplicates.
- Worldwide box-office record breakers vs annual worldwide leaders 1990–2025.
- Toy Hall originals vs Monopoly tokens vs generic trademarks: shared toy/brand names, distinct predicates.
- President/ex-Congress vs former VP never President; period-specific monarchs/PMs and long-serving justices remain distinct.
- Olympic eight-gold athletes vs existing Olympic champions; both-season Olympic countries vs Olympic-capital cities have different answer entity types and predicates.
- Geography thresholds: the conventional Michigan/Huron names and the hydrologically combined lake are all accepted; overlapping water bodies do not invalidate a qualifying answer. River/island/Alpine peak thresholds differ from country-peak and eight-thousander questions.
- Macbeth-title novels, ALA challenged books, BBC top-21 and sales threshold are different literary intersections/rankings.

## Schedule and legacy

| Metric                                | Before b68cb02 |     Integrated |
| ------------------------------------- | -------------: | -------------: |
| Days / slots / unique IDs             | 64 / 320 / 320 | 64 / 320 / 320 |
| Tiny / medium / large                 | 183 / 124 / 13 | 181 / 126 / 13 |
| Minimum daily distinct themes         |              5 |              5 |
| Days with a repeated nonempty cluster |              0 |              0 |
| Minimum daily size-band diversity     |              2 |              2 |
| Three-band days                       |             12 |             13 |
| One-band days                         |              0 |              0 |
| Maximum tiny / large per day          |          4 / 1 |          4 / 1 |

Initial integrated greedy scheduling had only ten three-band days. Among equally filled compatible days, the scheduler now prefers adding a missing size band before its deterministic seeded tie-break; no theme/cluster constraint is relaxed. The resulting mix is at least as healthy as the baseline. A catalog regression test requires >=12 three-band days and >=2 bands every day.

**All 331 legacy files are byte-identical to d9f96cf**; the committed independent manifest/legacy-identity tests still cover all supported dates before November 23, the full 66-day residue cycle, and before/at/after-cutover boundaries. Cutover bump procedure remains one edit to `DIVE_SCHEDULE_CUTOVER` in generate.py, then regenerate; require cutover >= merge date + 2 days, with legacy order before it. No registry-flag edit.

## Recall

Overall/constrained: **8863/8894 (99.65%)**, 320 prompts; broad 0/0; no missing corpus, data or metadata. New prompts all >=95%. Worst ten:

| Prompt                | Hits / total |   Rate | Misses                       |
| --------------------- | -----------: | -----: | ---------------------------- |
| declaration-signers   |        31/34 | 91.18% | Adams; Lee; Morris           |
| heisman               |        32/35 | 91.43% | Williams; Smith; Jackson     |
| baseball-hall-of-fame |        34/37 | 91.89% | Williams; Robinson; Martinez |
| masters-champions     |        34/37 | 91.89% | Woods; Watson; Johnson       |
| super-bowl-mvp        |        31/33 | 93.94% | Manning; Smith               |
| f1-champions          |        32/34 | 94.12% | Rosberg; Hill                |
| nobel-physics         |        33/35 | 94.29% | Curie; Bohr                  |
| us-first-ladies       |        44/46 | 95.65% | Adams; Harrison              |
| constitution-signers  |        24/25 | 96.00% | Morris                       |
| us-banknote-portraits |        26/27 | 96.30% | Washington                   |

Seven old prompts remain below 95% because shared surnames must not be assigned to one valid person: declaration-signers (Adams/Lee/Morris), Heisman (Williams/Smith/Jackson), Baseball Hall (Williams/Robinson/Martinez), Masters (Woods/Watson/Johnson), Super Bowl MVP (Manning/Smith), F1 champions (Rosberg/Hill), Nobel physics (Curie/Bohr). These are valid ambiguous misses, not invalid guesses. Only Masters Woods was newly removed by the requested base ambiguity work; the other cases predate these merges. Washington in banknotes is also an intentional valid miss at 96.30%.

## Checks

Actual final result lines (full logs: /home/ubuntu/work/refine-merge-*.log):

```text
All matched files use Prettier code style!
lint: exit 0
typecheck: exit 0
Test Files  114 passed (114)
Tests  1030 passed (1030)
Test Files  30 passed (30)
Tests  446 passed (446)
Ran 35 tests
OK
ℹ tests 20
ℹ pass 20
ℹ fail 0
Schedule enabled from 2026-11-23; 64 days, 320 constrained, 0 broad; earlier legacy 330 prompts / 66 days unchanged.
650 runtime data modules; 133 unreachable candidate sets omitted.
Total Upload: 8042.43 KiB / gzip: 3002.32 KiB
--dry-run: exiting now.
PASS: 24 built web assets contain none of 5 Worker-only Pearl strings (Nyckelharpa, Casu marzu, Rotokas, Gamboge, Parasaurolophus).
overall: 8863/8894 99.65% (320 prompts)
constrained: 8863/8894 99.65% (320 prompts)
broad: 0/0 n/a (0 prompts)
Missing corpus: none
Missing data: none
Missing metadata: none
```

Gzip: **3002.32 KiB**, +8.56 KiB versus the measured base refinement 2993.76; **4.68 KiB below 3007**. Vendored sources add repository bytes only, not Worker/web payload.

No browser/visual or deployment check was performed (data-only change). No remote CI watch or PR creation was requested in this merge phase. Source reviews rely on the complete pinned source tables, not independently audited primary records for every historical member. R4's direct API verification limitation remains documented in its review; rendered pinned pages were used. The original brainstorm limitations of R8's A380 and narrowed toy corpus remain disclosed; formatting did not make those samples independently blind. Broader editorial refinement of unchanged old plain standard-list questions is not claimed by this 45-slot merge.
