# R5 Oscar-intersection replacements

## Scope and independence

Four director prompts are retired in place; their replacements immediately follow them. Theme `film`, cluster `oscars`. Wording is unchanged from the requested text. Scope is fixed through the 98th Academy Awards (March 2026), as of 9 November 2026. No bases, legacy permutation, matcher, routes, shared contract or web code changed. The regenerated schedule remains **64 days, 320 constrained, 0 broad**.

The brainstorm author had seen the parent review’s provisional lists. These are frozen regression guesses, not fully blind independent recall or player data. Raw SHA-256: `ecc225396a21d6d3dd72d55022faf134fda581913a35dbfa389370fc4ca6bd7e`. Selected preserves every raw guess in its original order and text; only genuinely incorrect predicates receive reviewed-invalid reasons. The historical corpus is unchanged.

All canonical player-facing names and aliases are at most 40 characters. The canonical **The Return of the King** and its short aliases fit; the frozen 45-character full LOTR title remains valid but is an exact-recall miss in two prompts, rather than marking it invalid or adding an untypeable alias. Article removal and punctuation normalization supply article/no-article variants. No normalized key belongs to two answers within a prompt.

## Source verification and borderline calls

Fetched pinned MediaWiki `action=parse&oldid=...&prop=text&format=json` responses and inspected the winner rows. Each category page includes the 2025 eligibility-year winners from the 98th ceremony: Costume/Design **Frankenstein**, Song **KPop Demon Hunters**, Score **Sinners**, Supporting Actor **One Battle After Another**, Supporting Actress **Weapons**. The winning-films list also includes these results despite not spelling out “98th”. Best Picture revision 1384180534 includes One Battle After Another. No candidate pin needed replacement.

Competitive totals use the integer before parentheses in the winning-films source, whose lead explicitly separates honorary/special-achievement/juvenile awards into brackets; bold shaded rows are Best Picture winners. Star Wars is **6 competitive + 1 special**, not seven competitive wins. Raiders of the Lost Ark is four competitive plus a special award, so excluded. Poor Things and Sinners each won four; Frankenstein won three. Mary Poppins won five and qualifies. No 2026 result adds a five-win non-Best-Picture member.

For intersections, expanded rowspans, selected winner highlighting only, and joined **award eligibility year + film identity** (including linked article). Checked for differing display titles across matching article/year pairs: none. Years below are source award eligibility labels, not necessarily release dates (e.g. Samson and Delilah 1950, Tess 1980, A Room with a View 1986). Both category winner records were checked for every member, not just bare title presence. Committed source mechanisms remain the existing reviewed-members lists; no sources.py changes.

- Costume/Design: **47 film identities / 46 canonical answers**. Moulin Rouge (1952) and Moulin Rouge! (2001) each independently won both and normalize to one answer. Hamlet is 1948; West Side Story is 1961; Alice in Wonderland is 2010; Great Gatsby is 2013 (1974 won Costume only). Little Women is excluded: Design 1949 versus Costume 2019. Pride and Prejudice 1940 won Design before Costume existed. Gone with the Wind likewise predates Costume. Gladiator, Dune, Marie Antoinette, Sweeney Todd, Elizabeth, Hugo, Pan’s Labyrinth, Lincoln, Phantom Thread, Les Misérables, Anna Karenina, Cabaret, Dick Tracy, Bram Stoker’s Dracula and Mank did not win both. Frankenstein 2025 did.
- Song/Score: all historical scoring categories are eligible, including Scoring of a Musical (Gigi) and Original Musical or Comedy Score (Pocahontas). Frozen/Coco/Tarzan won Song but not Score; The Sound of Music/Purple Rain won a scoring category but not Original Song. La La Land won both; no 2026 addition.
- Supporting pair: exactly nine, matching the same film and ceremony. West Side Story 1961 qualifies, 2021 does not. Lead-acting wins do not count: e.g. Network, Kramer vs. Kramer, Mystic River and Million Dollar Baby do not supply a supporting pair. 2026 supporting winners were different films.

## Per-prompt results and film-by-film membership

| Prompt                            | Answers | Band   |    Exact recall |
| --------------------------------- | ------: | ------ | --------------: |
| `oscar-five-wins-no-best-picture` |      16 | tiny   | 20/20 (100.00%) |
| `oscar-song-and-score-films`      |      20 | tiny   |  24/25 (96.00%) |
| `oscar-costume-and-design-films`  |      46 | medium |  32/33 (96.97%) |
| `oscar-supporting-pair-films`     |       9 | tiny   | 11/11 (100.00%) |

### `oscar-five-wins-no-best-picture`

a film that won at least five competitive Oscars but not Best Picture

Surface: Cabaret; Star Wars; Mad Max: Fury Road; Gravity. Too Clever: none. Pearl: **Mary Poppins**.

Sources:

- [List of Academy Award–winning films](https://en.wikipedia.org/w/index.php?oldid=1365065191).
- [Best Picture exclusion cross-check](https://en.wikipedia.org/w/index.php?oldid=1384180534).

| Film                            | Source award year | Verification                                                           |
| ------------------------------- | ----------------: | ---------------------------------------------------------------------- |
| Dune                            |              2021 | 6 competitive wins; not Best Picture                                   |
| La La Land                      |              2016 | 6 competitive wins; not Best Picture                                   |
| Mad Max: Fury Road              |              2015 | 6 competitive wins; not Best Picture                                   |
| Gravity                         |              2013 | 7 competitive wins; not Best Picture                                   |
| Hugo                            |              2011 | 5 competitive wins; not Best Picture                                   |
| The Aviator                     |              2004 | 5 competitive wins; not Best Picture                                   |
| Saving Private Ryan             |              1998 | 5 competitive wins; not Best Picture                                   |
| Star Wars                       |              1977 | 6 competitive + 1 excluded special; competitive wins; not Best Picture |
| Cabaret                         |              1972 | 8 competitive wins; not Best Picture                                   |
| Who's Afraid of Virginia Woolf? |              1966 | 5 competitive wins; not Best Picture                                   |
| Doctor Zhivago                  |              1965 | 5 competitive wins; not Best Picture                                   |
| The Bad and the Beautiful       |              1952 | 5 competitive wins; not Best Picture                                   |
| The King and I                  |              1956 | 5 competitive wins; not Best Picture                                   |
| Mary Poppins                    |              1964 | 5 competitive wins; not Best Picture                                   |
| A Place in the Sun              |              1951 | 6 competitive wins; not Best Picture                                   |
| Wilson                          |              1944 | 5 competitive wins; not Best Picture                                   |

### `oscar-song-and-score-films`

a film that won Oscars for both a song and its score

Surface: Titanic; The Lion King; Aladdin; La La Land. Too Clever: none. Pearl: **Butch Cassidy and the Sundance Kid**.

Sources:

- [Academy Award for Best Original Song](https://en.wikipedia.org/w/index.php?oldid=1380826630).
- [Academy Award for Best Original Score](https://en.wikipedia.org/w/index.php?oldid=1384231617).

| Film                                          | Source award year | Verification                                                             |
| --------------------------------------------- | ----------------: | ------------------------------------------------------------------------ |
| The Wizard of Oz                              |              1939 | Both category winner rows; The Wizard of Oz                              |
| Pinocchio                                     |              1940 | Both category winner rows; Pinocchio (1940 film)                         |
| High Noon                                     |              1952 | Both category winner rows; High Noon                                     |
| Love Is a Many-Splendored Thing               |              1955 | Both category winner rows; Love Is a Many-Splendored Thing (film)        |
| Gigi                                          |              1958 | Both category winner rows; Gigi (1958 film)                              |
| Breakfast at Tiffany's                        |              1961 | Both category winner rows; Breakfast at Tiffany's (film)                 |
| Mary Poppins                                  |              1964 | Both category winner rows; Mary Poppins (film)                           |
| Born Free                                     |              1966 | Both category winner rows; Born Free                                     |
| Butch Cassidy and the Sundance Kid            |              1969 | Both category winner rows; Butch Cassidy and the Sundance Kid            |
| The Way We Were                               |              1973 | Both category winner rows; The Way We Were                               |
| Fame                                          |              1980 | Both category winner rows; Fame (1980 film)                              |
| The Little Mermaid                            |              1989 | Both category winner rows; The Little Mermaid (1989 film)                |
| Beauty and the Beast                          |              1991 | Both category winner rows; Beauty and the Beast (1991 film)              |
| Aladdin                                       |              1992 | Both category winner rows; Aladdin (1992 Disney film)                    |
| The Lion King                                 |              1994 | Both category winner rows; The Lion King                                 |
| Pocahontas                                    |              1995 | Both category winner rows; Pocahontas (1995 film)                        |
| Titanic                                       |              1997 | Both category winner rows; Titanic (1997 film)                           |
| The Lord of the Rings: The Return of the King |              2003 | Both category winner rows; The Lord of the Rings: The Return of the King |
| Slumdog Millionaire                           |              2008 | Both category winner rows; Slumdog Millionaire                           |
| La La Land                                    |              2016 | Both category winner rows; La La Land                                    |

### `oscar-costume-and-design-films`

a film that won Oscars for both Costume Design and Production Design

Surface: Titanic; Moulin Rouge; Black Panther; Wicked. Too Clever: none. Pearl: **The Grand Budapest Hotel**.

Sources:

- [Academy Award for Best Costume Design](https://en.wikipedia.org/w/index.php?oldid=1374921507).
- [Academy Award for Best Production Design](https://en.wikipedia.org/w/index.php?oldid=1374921434).

| Film                                          | Source award year | Verification                                                             |
| --------------------------------------------- | ----------------: | ------------------------------------------------------------------------ |
| Hamlet                                        |              1948 | Both category winner rows; Hamlet (1948 film)                            |
| The Heiress                                   |              1949 | Both category winner rows; The Heiress (film)                            |
| Samson and Delilah                            |              1950 | Both category winner rows; Samson and Delilah (1949 film)                |
| An American in Paris                          |              1951 | Both category winner rows; An American in Paris (film)                   |
| The Bad and the Beautiful                     |              1952 | Both category winner rows; The Bad and the Beautiful                     |
| Moulin Rouge                                  |              1952 | Both category winner rows; Moulin Rouge (1952 film)                      |
| The Robe                                      |              1953 | Both category winner rows; The Robe (film)                               |
| The King and I                                |              1956 | Both category winner rows; The King and I (1956 film)                    |
| Gigi                                          |              1958 | Both category winner rows; Gigi (1958 film)                              |
| Ben-Hur                                       |              1959 | Both category winner rows; Ben-Hur (1959 film)                           |
| Spartacus                                     |              1960 | Both category winner rows; Spartacus (film)                              |
| West Side Story                               |              1961 | Both category winner rows; West Side Story (1961 film)                   |
| Cleopatra                                     |              1963 | Both category winner rows; Cleopatra (1963 film)                         |
| My Fair Lady                                  |              1964 | Both category winner rows; My Fair Lady (film)                           |
| Doctor Zhivago                                |              1965 | Both category winner rows; Doctor Zhivago (film)                         |
| Who's Afraid of Virginia Woolf?               |              1966 | Both category winner rows; Who's Afraid of Virginia Woolf? (film)        |
| Camelot                                       |              1967 | Both category winner rows; Camelot (film)                                |
| Nicholas and Alexandra                        |              1971 | Both category winner rows; Nicholas and Alexandra                        |
| The Sting                                     |              1973 | Both category winner rows; The Sting                                     |
| Barry Lyndon                                  |              1975 | Both category winner rows; Barry Lyndon                                  |
| Star Wars                                     |              1977 | Both category winner rows; Star Wars (film)                              |
| All That Jazz                                 |              1979 | Both category winner rows; All That Jazz (film)                          |
| Tess                                          |              1980 | Both category winner rows; Tess (1979 film)                              |
| Gandhi                                        |              1982 | Both category winner rows; Gandhi (film)                                 |
| Fanny and Alexander                           |              1983 | Both category winner rows; Fanny and Alexander                           |
| Amadeus                                       |              1984 | Both category winner rows; Amadeus (film)                                |
| A Room with a View                            |              1986 | Both category winner rows; A Room with a View (1985 film)                |
| The Last Emperor                              |              1987 | Both category winner rows; The Last Emperor                              |
| Dangerous Liaisons                            |              1988 | Both category winner rows; Dangerous Liaisons                            |
| Bugsy                                         |              1991 | Both category winner rows; Bugsy                                         |
| Restoration                                   |              1995 | Both category winner rows; Restoration (1995 film)                       |
| The English Patient                           |              1996 | Both category winner rows; The English Patient (film)                    |
| Titanic                                       |              1997 | Both category winner rows; Titanic (1997 film)                           |
| Shakespeare in Love                           |              1998 | Both category winner rows; Shakespeare in Love                           |
| Moulin Rouge!                                 |              2001 | Both category winner rows; Moulin Rouge!                                 |
| Chicago                                       |              2002 | Both category winner rows; Chicago (2002 film)                           |
| The Lord of the Rings: The Return of the King |              2003 | Both category winner rows; The Lord of the Rings: The Return of the King |
| The Aviator                                   |              2004 | Both category winner rows; The Aviator (2004 film)                       |
| Memoirs of a Geisha                           |              2005 | Both category winner rows; Memoirs of a Geisha (film)                    |
| Alice in Wonderland                           |              2010 | Both category winner rows; Alice in Wonderland (2010 film)               |
| The Great Gatsby                              |              2013 | Both category winner rows; The Great Gatsby (2013 film)                  |
| The Grand Budapest Hotel                      |              2014 | Both category winner rows; The Grand Budapest Hotel                      |
| Mad Max: Fury Road                            |              2015 | Both category winner rows; Mad Max: Fury Road                            |
| Black Panther                                 |              2018 | Both category winner rows; Black Panther (film)                          |
| Poor Things                                   |              2023 | Both category winner rows; Poor Things (film)                            |
| Wicked                                        |              2024 | Both category winner rows; Wicked (2024 film)                            |
| Frankenstein                                  |              2025 | Both category winner rows; Frankenstein (2025 film)                      |

### `oscar-supporting-pair-films`

a film that won both supporting-acting Oscars

Surface: Everything Everywhere All at Once; West Side Story; The Fighter. Too Clever: none. Pearl: **A Streetcar Named Desire**.

Sources:

- [Academy Award for Best Supporting Actor](https://en.wikipedia.org/w/index.php?oldid=1378698429).
- [Academy Award for Best Supporting Actress](https://en.wikipedia.org/w/index.php?oldid=1369073137).

| Film                              | Source award year | Verification                                                    |
| --------------------------------- | ----------------: | --------------------------------------------------------------- |
| A Streetcar Named Desire          |              1951 | Both category winner rows; A Streetcar Named Desire (1951 film) |
| From Here to Eternity             |              1953 | Both category winner rows; From Here to Eternity                |
| Sayonara                          |              1957 | Both category winner rows; Sayonara (1957 film)                 |
| West Side Story                   |              1961 | Both category winner rows; West Side Story (1961 film)          |
| The Last Picture Show             |              1971 | Both category winner rows; The Last Picture Show                |
| Julia                             |              1977 | Both category winner rows; Julia (1977 film)                    |
| Hannah and Her Sisters            |              1986 | Both category winner rows; Hannah and Her Sisters               |
| The Fighter                       |              2010 | Both category winner rows; The Fighter                          |
| Everything Everywhere All at Once |              2022 | Both category winner rows; Everything Everywhere All at Once    |

## Overlap gate

Normalized canonical answer keys, not alias counts; the long Return of the King title is mapped to the existing short canonical. Same-title remakes collapse. All 320 active constrained prompts are scheduled; compare the other 319 plus all four proposals. Both pair directions retained.

All pairs are below 50%. Top pairs (symmetric duplicates omitted):

| New prompt                        | Other prompt / proposal           | Intersection / smaller set | Overlap |
| --------------------------------- | --------------------------------- | -------------------------: | ------: |
| `oscar-costume-and-design-films`  | `oscar-five-wins-no-best-picture` |                       7/16 |  43.75% |
| `oscar-costume-and-design-films`  | `proposal-nolan`                  |                      12/28 |  42.86% |
| `oscar-supporting-pair-films`     | `best-picture`                    |                        3/9 |  33.33% |
| `oscar-supporting-pair-films`     | `proposal-nolan`                  |                        3/9 |  33.33% |
| `oscar-costume-and-design-films`  | `best-picture`                    |                      15/46 |  32.61% |
| `oscar-five-wins-no-best-picture` | `best-visual-effects`             |                       5/16 |  31.25% |
| `oscar-song-and-score-films`      | `best-original-song`              |                       6/20 |  30.00% |
| `oscar-song-and-score-films`      | `disney-canon`                    |                       6/20 |  30.00% |
| `oscar-song-and-score-films`      | `best-picture`                    |                       4/20 |  20.00% |
| `oscar-song-and-score-films`      | `proposal-nolan`                  |                       4/20 |  20.00% |
| `oscar-five-wins-no-best-picture` | `proposal-hitchcock`              |                       3/16 |  18.75% |
| `oscar-costume-and-design-films`  | `proposal-tarantino`              |                       2/11 |  18.18% |
| `oscar-costume-and-design-films`  | `oscar-song-and-score-films`      |                       3/20 |  15.00% |
| `oscar-song-and-score-films`      | `best-visual-effects`             |                       3/20 |  15.00% |
| `oscar-costume-and-design-films`  | `proposal-hitchcock`              |                       3/23 |  13.04% |
| `oscar-five-wins-no-best-picture` | `oscar-song-and-score-films`      |                       2/16 |  12.50% |
| `oscar-five-wins-no-best-picture` | `proposal-nolan`                  |                       2/16 |  12.50% |
| `oscar-costume-and-design-films`  | `oscar-supporting-pair-films`     |                        1/9 |  11.11% |
| `oscar-supporting-pair-films`     | `proposal-hitchcock`              |                        1/9 |  11.11% |
| `oscar-supporting-pair-films`     | `spielberg-films`                 |                        1/9 |  11.11% |
| `oscar-costume-and-design-films`  | `best-visual-effects`             |                       5/46 |  10.87% |
| `oscar-song-and-score-films`      | `proposal-spielberg`              |                       2/20 |  10.00% |

Full comparison rows, normalized intersections and all four proposal snapshots are in `refine-R5-audit.json`. NFR 1989 and AFI 2007-new use the supplied parent-review lists (25/23); seven-Oscar and box-office proposals have 28/11 keys.

## Build and checks

**Worker gzip:** clean d9f96cf before **2993.75 KiB**, regenerated after **2994.19 KiB**, net **+0.44 KiB** (approximately 451 bytes; Wrangler rounds to 0.01 KiB), below the +1.5 KiB budget. Generated Worker data, report.json and recall/report.json are restored before committing; new generated data files remain uncommitted as requested.

Commands: `source ~/.nvm/nvm.sh`; `~/work/dive-venv/bin/python scripts/dive/generate.py`; `~/work/dive-venv/bin/python scripts/dive/generate.py --verify-sources --check`; `(cd scripts/dive && ~/work/dive-venv/bin/python -m unittest discover -s . -p "test_*.py")`; `node scripts/dive/recall.mjs`; `node --test scripts/dive/recall.test.mjs`; `npm run build`.

- Generator and full pinned-source verification/check succeeded. Schedule: 64 days, 320 constrained, 0 broad; historical legacy unchanged.
- Python: 30 tests, OK. Updated total-spec and retired-set assertions for the four additions/retirements.
- Recall regression: 16 tests, 16 pass, 0 fail, including new R5 frozen-hash/order, >=95% per-prompt exact recall, reviewed-nonmember rejection and empty-input coverage. Older batch tests still verify their frozen guesses but evaluate only the not-R5-retired modules, which the generator deliberately omits from runtime output.
- Build succeeded; Worker/web data-leak checks passed. No deployment. No UI surface changed or visual verification performed.
- An initial generator invocation lacked Node on PATH; loading nvm fixed the environment. urllib requests initially returned 403; curl fetched the pins and the ordinary full source verifier subsequently succeeded.

Raw guesses were not edited. No new sources.py parser was necessary. Selected invalid annotations are scoped to actual nonmembers, not missing aliases. The two valid over-limit full-title misses remain explicit.
