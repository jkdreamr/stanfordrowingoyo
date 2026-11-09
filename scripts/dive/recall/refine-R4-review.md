# Refine R4: six bounded film replacements

Base: `d9f96cf`. Scope: six retired specs and their immediate successors; all replacements use theme `film`. Facts bounded to the requested periods, reviewed as of 9 November 2026. No Oscar predicates.

## Frozen recall corpus

Brainstormed and froze `refine-R4-raw.json` before inspecting/extracting answer data. Its 225 guesses are unchanged, including spelling mistakes, nicknames, near misses and wrong answers. The selected file retains exactly the same text and order, annotating 47 genuinely invalid guesses with reasons. There are 177 hits out of 178 valid guesses; every prompt exceeds 95%.

- Raw SHA-256: `bb2c36fc96eff00ae9a5632e96ad4e68a829b8477986b868ae380a3d0e16e973`.
- Selected SHA-256: `cd6a779f6b19dc694ea49f9eddac1b14ac19ed358aacc385b9f0ef1a6c9854d3`.
- Bond `Lee` remains a valid-intent miss rather than being marked invalid: Christopher Lee and Will Yun Lee make it ambiguous. Unambiguous surnames are generated for people prompts; accents, articles, abbreviations, remake years and sequel-number variants have explicit aliases where needed.

## Replacement slots

### `bond-films` → `bond-villain-actors`

- Retired: **Name a James Bond film.** (26 canonical answers; preserved, with `active: false`).
- New: **Name an actor who played a main villain in an official Eon James Bond film.**
- 36 canonical answers; **medium** band. Recall **30/31 (96.77%)** from 38 raw guesses (7 invalid).
- Surface: Javier Bardem; Rami Malek; Mads Mikkelsen; Christoph Waltz; Christopher Walken.
- Too Clever: Eric Pohlmann.
- Pearl: Vladek Sheybal.

Sources:

- [List of James Bond villains](https://en.wikipedia.org/w/index.php?title=List_of_James_Bond_villains&oldid=1383256511) — 34 reviewed members; exact `expect` bounds.
- [Ernst Stavro Blofeld](https://en.wikipedia.org/w/index.php?title=Ernst_Stavro_Blofeld&oldid=1384588655) — 2 reviewed members; exact `expect` bounds.

All main-table performers count, including voice and uncredited Blofeld portrayals. Supplement with For Your Eyes Only's John Hollis (body) and Peter Marinker (voice). Non-Eon Max von Sydow and henchmen-only roles are excluded. Lee alone is ambiguous between Christopher Lee and Will Yun Lee and is not accepted.

### `spielberg-films` → `national-film-registry-1989`

- Retired: **Name a feature film directed by Steven Spielberg.** (37 canonical answers; preserved, with `active: false`).
- New: **Name a film selected for the National Film Registry in its inaugural year, 1989.**
- 25 canonical answers; **medium** band. Recall **24/24 (100.00%)** from 35 raw guesses (11 invalid).
- Surface: Star Wars; The Wizard of Oz; Casablanca; Citizen Kane; Snow White and the Seven Dwarfs.
- Too Clever: none; no defensible separate trick answer.
- Pearl: The Learning Tree.

Sources:

- [National Film Registry](https://en.wikipedia.org/w/index.php?title=National_Film_Registry&oldid=1384519422) — 25 reviewed members; exact `expect` bounds.

The inaugural 25 only. Star Wars is the 1977 film, Episode IV / A New Hope; Snow White is the 1937 animated film. Short and full Dr. Strangelove titles and Sunrise subtitle variants count.

### `hitchcock-films` → `stephen-king-theatrical-films`

- Retired: **Name a feature film directed by Alfred Hitchcock.** (53 canonical answers; preserved, with `active: false`).
- New: **Name a theatrically released feature film adapted from a Stephen King story, by 2025.**
- 46 canonical answers; **medium** band. Recall **41/41 (100.00%)** from 44 raw guesses (3 invalid).
- Surface: The Shining; The Shawshank Redemption; The Green Mile; It; Carrie.
- Too Clever: 'Salem's Lot.
- Pearl: Julie Ganapathi.

Sources:

- [List of adaptations of works by Stephen King](https://en.wikipedia.org/w/index.php?title=List_of_adaptations_of_works_by_Stephen_King&oldid=1384004791) — 46 reviewed members; exact `expect` bounds.

Includes Richard Bachman works, Indian adaptations and anthology films containing a King-adapted segment. Same-title remakes collapse: Carrie 1976/2013, Pet Sematary 1989/2019, Firestarter 1984/2022, Children of the Corn 1984/2020 (wide release 2023), The Running Man 1987/2025. It 2017 and It Chapter Two 2019 remain distinct. 'Salem's Lot 2024 qualifies via UK/Ireland theaters despite its US Max debut; The Night Flier received a theatrical run after HBO. Exclude TV films/miniseries; Disciples of the Crow (short); Dolan's Cadillac and Mercy (direct-to-video); Gerald's Game, 1922, In the Tall Grass and Mr. Harrigan's Phone (streaming/festival-only). Exclude derivative sequels with no King source material whether theatrical or direct-to-video: Pet Sematary Two, The Rage: Carrie 2, Children of the Corn sequels. Creepshow 2 adapts The Raft and qualifies. The Lawnmower Man is not an adaptation of King's story.

### `nolan-films` → `live-action-batman-actors`

- Retired: **Name a feature film directed by Christopher Nolan.** (13 canonical answers; preserved, with `active: false`).
- New: **Name an actor who played Batman in a live-action theatrical film or serial, by 2025.**
- 9 canonical answers; **tiny** band. Recall **22/22 (100.00%)** from 32 raw guesses (10 invalid).
- Surface: Christian Bale; Michael Keaton; Ben Affleck; Robert Pattinson.
- Too Clever: none; no defensible separate trick answer.
- Pearl: Robert Lowery.

Sources:

- [Batman in film](https://en.wikipedia.org/w/index.php?title=Batman_in_film&oldid=1379246665) — 9 reviewed members; exact `expect` bounds.

Include Lewis Wilson (1943 serial), Robert Lowery (1949 serial) and Adam West (1966 feature). Exclude TV-only Batman (David Mazouz, Iain Glen), animated voice-only roles (Kevin Conroy, Will Arnett, Jensen Ackles) and stand-ins. Returning actors count once. Four explicit Surface anchors leave enough non-anchor answers for all required ordinary tiers in this nine-member set.

### `tarantino-films` → `worldwide-box-office-record-films`

- Retired: **Name a feature film directed by Quentin Tarantino.** (10 canonical answers; preserved, with `active: false`).
- New: **Name a film that has held the all-time worldwide box-office record, by 2025.**
- 11 canonical answers; **tiny** band. Recall **20/20 (100.00%)** from 34 raw guesses (14 invalid).
- Surface: Avatar; Titanic; Avengers: Endgame; Star Wars; Jurassic Park.
- Too Clever: none; no defensible separate trick answer.
- Pearl: The Birth of a Nation.

Sources:

- [List of highest-grossing films](https://en.wikipedia.org/w/index.php?title=List_of_highest-grossing_films&oldid=1384541318) — 11 reviewed members; exact `expect` bounds.

Worldwide unadjusted timeline-table members only, not current highest grossers or inflation-adjusted leaders. Re-releases do not create new answers. Exclude speculative holders discussed only in prose: Ben-Hur, The Ten Commandments, Snow White and Deep Throat. Ignore 2026 entries.

### `pixar-films` → `annual-worldwide-box-office-1990-2025`

- Retired: **Name a Pixar feature film.** (31 canonical answers; preserved, with `active: false`).
- New: **Name the top-grossing film worldwide of its release year, for any year in 1990–2025.**
- 38 canonical answers; **medium** band. Recall **40/40 (100.00%)** from 42 raw guesses (2 invalid).
- Surface: Titanic; Avatar; Avengers: Endgame; Barbie; Inside Out 2.
- Too Clever: Die Hard with a Vengeance.
- Pearl: Demon Slayer: Mugen Train.

Sources:

- [List of highest-grossing films](https://en.wikipedia.org/w/index.php?title=List_of_highest-grossing_films&oldid=1384541318) — 38 reviewed members; exact `expect` bounds.

Lifetime worldwide grosses including re-releases, not calendar-year receipts. Accept every listed leader in a year: both Toy Story and Die Hard with a Vengeance in 1995, and both Harry Potter and the Goblet of Fire and Revenge of the Sith in 2005. These are re-release/first-run alternatives, not numerical ties. No other year in the range has multiple entries; any listed tied leaders would all count. Exclude 2026 and later.

## Membership verification

Each canonical member was compared against the appropriate pinned source table (not a popularity-based subset). `sources.py`'s existing `members` / `reviewed` convention stores the complete reviewed list, extraction recipe and exact expected counts; no helper changes were needed. The six answer counts are 36 / 25 / 46 / 9 / 11 / 38.

- **Bond:** the main-villain table contributes 34 distinct credited/voice/uncredited performers, so no henchman expansion was needed. Donald Pleasence, Telly Savalas, Charles Gray, Anthony Dawson, Eric Pohlmann and Christoph Waltz are retained where the pinned Eon table lists them; John Hollis and Peter Marinker are the two additional uncredited body/voice Blofeld performers for _For Your Eyes Only_, verified on the pinned Blofeld page. Max von Sydow is excluded because his Blofeld was in non-Eon _Never Say Never Again_. User explicitly approved all 36 including the Blofeld supplement. This is a table-defined scope, not an attempt to classify every antagonist actor.

- **Registry:** selected only rows whose induction year is 1989: 25, not films released in 1989. _Dr. Strangelove_ uses the short display name for the generator's 40-UTF-16-unit limit, with the complete title accepted as an alias. _Star Wars_, Episode IV and _A New Hope_ share one canonical entry.

- **Batman:** nine distinct live-action theatrical performers; Lewis Wilson and Robert Lowery qualify through serials, Adam West through the 1966 feature. No Kevin Conroy, Will Arnett, animated performances or television-only Batman. There are **four**, rather than five, Surface anchors: with only nine total answers, one Pearl plus the four required remaining ordinary rows are needed to populate School/Rare/Deep/Pearl. A fifth Surface anchor makes the existing generator reject the tier distribution.

- **Record timeline:** exactly 11 distinct film titles from the named timeline's rows through 2025, deduplicated across re-release rows. Disputed candidates mentioned only in adjacent prose are not silently added. _The Birth of a Nation_ is retained because the source table lists it. No post-2025 rows.

- **Annual leaders:** all 36 release years 1990–2025, with both table-listed titles in **1995** (_Toy Story_, _Die Hard with a Vengeance_) and **2005** (_Harry Potter and the Goblet of Fire_, _Star Wars: Episode III – Revenge of the Sith_): **38 canonical titles**. This deliberately follows the pinned table's lifetime/re-release accounting rather than calendar-year domestic grosses, original-run-only grosses, or present-day guesses about what 'won' a year. Both dual-entry decisions were explicitly approved by the user.

### Stephen King: member-by-member

Reviewed the pinned adaptation film table first, then checked each film article for a King source and a commercial theatrical release. Article revision numbers below identify the additional release evidence (`https://en.wikipedia.org/w/index.php?oldid=REVISION`). Festival-only, streaming-only and direct-to-video distribution do not qualify. A later genuine theatrical release does qualify; a US theatrical release is not required. Anthologies qualify when a segment adapts King. Richard Bachman works qualify. Same-title remakes collapse to one canonical answer with year aliases; differently titled follow-ups adapting the original work remain separate. The 46 canonical answers below represent 51 qualifying film versions.

| Canonical answer                   | Qualifying version / theatrical year   | King source work                              | Additional film-article oldid(s)                                                                                                         |
| ---------------------------------- | -------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Creepshow                          | 1982                                   | Weeds; The Crate                              | [1383815490](https://en.wikipedia.org/w/index.php?oldid=1383815490)                                                                      |
| Cat's Eye                          | 1985                                   | Quitters, Inc.; The Ledge                     | [1384582081](https://en.wikipedia.org/w/index.php?oldid=1384582081)                                                                      |
| Silver Bullet                      | 1985                                   | Cycle of the Werewolf                         | [1383816540](https://en.wikipedia.org/w/index.php?oldid=1383816540)                                                                      |
| Maximum Overdrive                  | 1986                                   | Trucks                                        | [1383751968](https://en.wikipedia.org/w/index.php?oldid=1383751968)                                                                      |
| Creepshow 2                        | 1987                                   | The Raft                                      | [1359789437](https://en.wikipedia.org/w/index.php?oldid=1359789437)                                                                      |
| Pet Sematary                       | 1989 / 2019                            | Pet Sematary                                  | [1384160001](https://en.wikipedia.org/w/index.php?oldid=1384160001), [1384220703](https://en.wikipedia.org/w/index.php?oldid=1384220703) |
| Thinner                            | 1996                                   | Thinner, published as Richard Bachman         | [1382938691](https://en.wikipedia.org/w/index.php?oldid=1382938691)                                                                      |
| A Good Marriage                    | 2014                                   | A Good Marriage                               | [1373988706](https://en.wikipedia.org/w/index.php?oldid=1373988706)                                                                      |
| Cell                               | 2016                                   | Cell                                          | [1384069985](https://en.wikipedia.org/w/index.php?oldid=1384069985)                                                                      |
| It Chapter Two                     | 2019                                   | It, adult portions                            | [1384475202](https://en.wikipedia.org/w/index.php?oldid=1384475202)                                                                      |
| Carrie                             | 1976 / 2013                            | Carrie                                        | [1383966918](https://en.wikipedia.org/w/index.php?oldid=1383966918), [1384324497](https://en.wikipedia.org/w/index.php?oldid=1384324497) |
| The Shining                        | 1980                                   | The Shining                                   | [1383904140](https://en.wikipedia.org/w/index.php?oldid=1383904140)                                                                      |
| Cujo                               | 1983                                   | Cujo                                          | [1380049679](https://en.wikipedia.org/w/index.php?oldid=1380049679)                                                                      |
| The Dead Zone                      | 1983                                   | The Dead Zone                                 | [1379473477](https://en.wikipedia.org/w/index.php?oldid=1379473477)                                                                      |
| Christine                          | 1983                                   | Christine                                     | [1383815697](https://en.wikipedia.org/w/index.php?oldid=1383815697)                                                                      |
| Children of the Corn               | 1984 / 2020; wide 2023                 | Children of the Corn                          | [1383751492](https://en.wikipedia.org/w/index.php?oldid=1383751492), [1384478162](https://en.wikipedia.org/w/index.php?oldid=1384478162) |
| Firestarter                        | 1984 / 2022                            | Firestarter                                   | [1379473518](https://en.wikipedia.org/w/index.php?oldid=1379473518), [1374005025](https://en.wikipedia.org/w/index.php?oldid=1374005025) |
| Stand by Me                        | 1986                                   | The Body                                      | [1384419583](https://en.wikipedia.org/w/index.php?oldid=1384419583)                                                                      |
| The Running Man                    | 1987 / 2025                            | The Running Man, published as Richard Bachman | [1383817469](https://en.wikipedia.org/w/index.php?oldid=1383817469), [1383344249](https://en.wikipedia.org/w/index.php?oldid=1383344249) |
| Tales from the Darkside: The Movie | 1990                                   | The Cat from Hell                             | [1384583519](https://en.wikipedia.org/w/index.php?oldid=1384583519)                                                                      |
| Graveyard Shift                    | 1990                                   | Graveyard Shift                               | [1377601992](https://en.wikipedia.org/w/index.php?oldid=1377601992)                                                                      |
| Misery                             | 1990                                   | Misery                                        | [1384509099](https://en.wikipedia.org/w/index.php?oldid=1384509099)                                                                      |
| The Dark Half                      | 1993                                   | The Dark Half                                 | [1383821548](https://en.wikipedia.org/w/index.php?oldid=1383821548)                                                                      |
| Needful Things                     | 1993                                   | Needful Things                                | [1384388791](https://en.wikipedia.org/w/index.php?oldid=1384388791)                                                                      |
| The Shawshank Redemption           | 1994                                   | Rita Hayworth and Shawshank Redemption        | [1384690640](https://en.wikipedia.org/w/index.php?oldid=1384690640)                                                                      |
| The Mangler                        | 1995                                   | The Mangler                                   | [1375938067](https://en.wikipedia.org/w/index.php?oldid=1375938067)                                                                      |
| Dolores Claiborne                  | 1995                                   | Dolores Claiborne                             | [1378834299](https://en.wikipedia.org/w/index.php?oldid=1378834299)                                                                      |
| The Night Flier                    | 1997; US theaters 1998                 | The Night Flier                               | [1377285054](https://en.wikipedia.org/w/index.php?oldid=1377285054)                                                                      |
| Apt Pupil                          | 1998                                   | Apt Pupil                                     | [1374311160](https://en.wikipedia.org/w/index.php?oldid=1374311160)                                                                      |
| The Green Mile                     | 1999                                   | The Green Mile                                | [1383987197](https://en.wikipedia.org/w/index.php?oldid=1383987197)                                                                      |
| Hearts in Atlantis                 | 2001                                   | Low Men in Yellow Coats                       | [1377660508](https://en.wikipedia.org/w/index.php?oldid=1377660508)                                                                      |
| Dreamcatcher                       | 2003                                   | Dreamcatcher                                  | [1376227234](https://en.wikipedia.org/w/index.php?oldid=1376227234)                                                                      |
| Julie Ganapathi                    | 2003                                   | Misery                                        | [1382968031](https://en.wikipedia.org/w/index.php?oldid=1382968031)                                                                      |
| Secret Window                      | 2004                                   | Secret Window, Secret Garden                  | [1382548972](https://en.wikipedia.org/w/index.php?oldid=1382548972)                                                                      |
| Riding the Bullet                  | 2004                                   | Riding the Bullet                             | [1379814302](https://en.wikipedia.org/w/index.php?oldid=1379814302)                                                                      |
| 1408                               | 2007                                   | 1408                                          | [1384481874](https://en.wikipedia.org/w/index.php?oldid=1384481874)                                                                      |
| No Smoking                         | 2007                                   | Quitters, Inc.                                | [1380359833](https://en.wikipedia.org/w/index.php?oldid=1380359833)                                                                      |
| The Mist                           | 2007                                   | The Mist                                      | [1384535090](https://en.wikipedia.org/w/index.php?oldid=1384535090)                                                                      |
| The Dark Tower                     | 2017                                   | The Dark Tower series                         | [1383327559](https://en.wikipedia.org/w/index.php?oldid=1383327559)                                                                      |
| It                                 | 2017                                   | It, childhood portions                        | [1383537406](https://en.wikipedia.org/w/index.php?oldid=1383537406)                                                                      |
| Doctor Sleep                       | 2019                                   | Doctor Sleep                                  | [1379065224](https://en.wikipedia.org/w/index.php?oldid=1379065224)                                                                      |
| The Boogeyman                      | 2023                                   | The Boogeyman                                 | [1383261071](https://en.wikipedia.org/w/index.php?oldid=1383261071)                                                                      |
| The Life of Chuck                  | 2025 commercial release; 2024 festival | The Life of Chuck                             | [1379065347](https://en.wikipedia.org/w/index.php?oldid=1379065347)                                                                      |
| 'Salem's Lot                       | 2024 UK/Ireland theaters               | 'Salem's Lot                                  | [1382308026](https://en.wikipedia.org/w/index.php?oldid=1382308026)                                                                      |
| The Monkey                         | 2025                                   | The Monkey                                    | [1384651715](https://en.wikipedia.org/w/index.php?oldid=1384651715)                                                                      |
| The Long Walk                      | 2025                                   | The Long Walk, published as Richard Bachman   | [1383210841](https://en.wikipedia.org/w/index.php?oldid=1383210841)                                                                      |

Boundary decisions checked separately:

- **Include _The Night Flier_**: prior HBO broadcast does not negate its later 1998 US theatrical run.
- **Include 2024 _'Salem's Lot_**: streaming in the US, but commercial theatrical distribution in the UK and Ireland. Exclude the 1979 and 2004 TV miniseries.
- **Include _The Life of Chuck_**: 2024 festival premiere, commercial theatrical release in 2025; _The Long Walk_ and the 2025 _The Running Man_ also released within the bounded year.
- **Include _Children of the Corn_ (2020/2023)** alongside the 1984 version under the same canonical title: limited 2020 release followed by the wider 2023 theatrical run.
- **Exclude _Gerald's Game_, _1922_, _In the Tall Grass_ and _Mr. Harrigan's Phone_**: streaming/festival-only, without an identified qualifying commercial theatrical run.
- **Exclude _Dolan's Cadillac_ and _Mercy_**: direct-to-video; also exclude _Trucks_, _Quicksilver Highway_, _Big Driver_, _Desperation_, _Bag of Bones_, _Rose Red_ and other TV/miniseries titles. Do not treat nonexistent theatrical box-office data as positive evidence; the direct-to-video classification is the decisive evidence for _Dolan's Cadillac_.
- **Exclude derivative sequels without King source material**: e.g. _The Rage: Carrie 2_, _A Return to Salem's Lot_, _Pet Sematary Two_, _Children of the Corn_ sequel entries, _The Mangler 2_ and _The Lawnmower Man_ (its King-title rights/credit do not make its unrelated plot an adaptation). _It Chapter Two_ is included because it adapts the adult portion of _It_.

Direct Python MediaWiki API access returned `HTTP Error 403: Forbidden`. Pinned rendered pages were inspected through webfetch instead; `generate.py --verify-sources` was **not run**. Some individual webfetch requests were rate-limited and retried. This is a manually reviewed, pinned-members recipe, not a claim that live API verification passed.

## Overlap

Compared each replacement against every active constrained prompt, including the other replacements: **320 active prompts, 1,899 unique pairs, including 15 new/new pairs**. Primary metric is `|A ∩ B| / min(|A|, |B|)` over normalized canonical strings. A second, conservative identity screen uses canonical+alias keys and maximum one-to-one row matching (never counts multiple aliases as multiple members). This catches e.g. alternate Star Wars titles without artificially increasing the denominator. No primary or alias-aware pair reaches 50%.

Highest screen overlap: `worldwide-box-office-record-films` vs `best-visual-effects`: **5/11 = 45.45%**. Shared surnames can overestimate actor/film cross-prompt identity in the secondary screen; none crosses the threshold even with that conservative treatment. Per-new-prompt maxima and all new/new pairs are in the audit JSON.

Reproduce the comparison after generation (imports the same normalized member keys used by the generator):

```python
import sys
sys.path.insert(0, 'scripts/dive')
from constrained import read_specs, normalize

new = {
    'bond-villain-actors', 'national-film-registry-1989',
    'stephen-king-theatrical-films', 'live-action-batman-actors',
    'worldwide-box-office-record-films', 'annual-worldwide-box-office-1990-2025',
}
prompts = [p for p in read_specs() if p.get('active', True)]
seen = set()
for a in prompts:
    if a['id'] not in new:
        continue
    for b in prompts:
        pair = tuple(sorted((a['id'], b['id'])))
        if a['id'] == b['id'] or pair in seen:
            continue
        seen.add(pair)
        x = {normalize(r['name']) for r in a['rows']}
        y = {normalize(r['name']) for r in b['rows']}
        ratio = len(x & y) / min(len(x), len(y))
        if ratio >= .5:
            print(pair, ratio)
print('unique pairs:', len(seen))
```

## Checks and size budget

Generated and built locally only; no deployment and no PR. Same-environment Wrangler gzip comparison: **2993.75 KiB baseline → 2994.82 KiB new = +1.07 KiB**, within the +1.5 KiB budget. The full upload sizes were 8016.30 KiB baseline and 8022.49 KiB new.

- `python scripts/dive/generate.py`: completed successfully; generated 320 active constrained prompts and the 64-day schedule.
- `python -m unittest` in `scripts/dive`: **30 tests, 2 failures**. Both are stale catalog-fixture assertions: `393 != 387`, and the fixed retired-ID set missing exactly the six requested retirements. Tests are out of allowed edit scope, so left unchanged. Independently checked the six replacement texts against the test's short-text assertions; all pass.
- `node --test scripts/dive/recall.test.mjs`: **15 passed, 0 failed**.
- `node scripts/dive/recall.mjs`: all six replacements above 95%; entire constrained cycle **8736/8766** valid guesses matched.
- `npm run build`: successful Worker dry run, gzip above.
- Structural comparison with `d9f96cf`: existing catalog semantically identical except six `active: false` flags; exactly six new specs, each immediately following its old spec. Only six catalog diff hunks.
- Generated Worker data and both generated reports are restored before commit, as requested; regenerate locally to activate this catalog. The separate Worker retired-count test was not run (explicitly waived by the task).
- No UI components were changed; visual rendering was not checked.

Relevant result excerpts:

```text
Ran 30 tests in 15.132s
FAILED (failures=2)

ℹ tests 15
ℹ pass 15
ℹ fail 0

| bond-villain-actors | 30/31 | 96.77% | Lee |
| national-film-registry-1989 | 24/24 | 100.00% |  |
| stephen-king-theatrical-films | 41/41 | 100.00% |  |
| live-action-batman-actors | 22/22 | 100.00% |  |
| worldwide-box-office-record-films | 20/20 | 100.00% |  |
| annual-worldwide-box-office-1990-2025 | 40/40 | 100.00% |  |

Total Upload: 8022.49 KiB / gzip: 2994.82 KiB
--dry-run: exiting now.
```

### Wording follow-up

Updated the five quoted replacement texts above; membership and frozen recall guesses are unchanged. Bond uses the requested wording verbatim. The existing text validator caps the full `Name ….` sentence at 85 characters and rejects `through YYYY`: King, Batman and record-holder prompts therefore use `by 2025`; the annual prompt ends `for any year in 1990–2025`. Final full lengths are 75, 85, 84, 76 and 84 characters respectively. All five satisfy those assertions independently of the stale retired-ID assertion that stops the test early.

Reran generation, unittest, recall unit tests, recall evaluation and build after the wording update; results above reflect that rerun. An initial generation attempt lacked Node on PATH and stopped before writing the new runtime modules; loading NVM fixed the environment, and successful regeneration preceded the final recall/build runs. The only remaining test failures are the same two fixed catalog assertions; tests were not changed.
