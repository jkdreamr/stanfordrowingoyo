# Third constrained replacement batch

29 active prompts replace 29 broad slots. The prospective schedule is **64 days,
287 constrained / 33 broad**. No staging, deployment or push.

## Frozen brainstorms and recall

`batch-3-raw.json` preserves 35 candidates and 1078 independently brainstormed
guesses. The original 32 candidate lists preceded their source inspection; three
food substitutions were brainstormed before inspecting their own sources.
`batch-3-selected.json` preserves the exact original strings for 29 selected
prompts and only annotates genuinely invalid guesses with explicit reasons.

Selected corpus: **874 guesses, 165 reviewed-invalid, 709 valid**.
Exact normalized-key recall: **510/709 (71.93%) → 709/709 (100%)**.
Every selected prompt has at least 25 raw guesses and 100% valid-guess recall;
reviewed-invalid guesses must not hit. These are model brainstorms, not a
representative player sample or proof of completeness.

The before measurement uses the first generated sets without audited aliases,
then applies the same final invalid review and denominator to both sides. The
Super Bowl scope was broadened to headliners **or special guests** rather than
invalidating genuine guest appearances. Source-derived new members were not
added as extra brainstorm observations. `batch-3-audit.json` records the hashes,
per-prompt before/after observations, tiers, aliases and standalone gzip sizes.

| ID                                | Prompt                                                                      | Size | Gzip KiB | Recall before → after |
| --------------------------------- | --------------------------------------------------------------------------- | ---: | -------: | --------------------- |
| `beyonce-studio-albums`           | Name a Beyoncé solo studio album.                                           |    8 |     0.47 | 10/16 → 16/16         |
| `big-brother-us-winners`          | Name a winner of the main US Big Brother series.                            |   28 |     0.96 | 24/29 → 29/29         |
| `bond-theme-songs`                | Name a main theme song from an official James Bond film.                    |   26 |     0.92 | 24/28 → 28/28         |
| `celebrations-chocolates`         | Name a chocolate in the standard UK Celebrations assortment.                |    8 |     0.46 | 8/19 → 19/19          |
| `christie-poirot-novels`          | Name an Agatha Christie novel or novella featuring Hercule Poirot.          |   34 |     1.25 | 38/39 → 39/39         |
| `crayola-retired-1990`            | Name a Crayola crayon color retired in 1990.                                |    8 |     0.39 | 15/17 → 17/17         |
| `disney-princess-lineup`          | Name a member of the official Disney Princess lineup.                       |   13 |     0.55 | 13/23 → 23/23         |
| `eevee-evolutions`                | Name a Pokémon that Eevee evolves into.                                     |    8 |     0.35 | 16/16 → 16/16         |
| `fellowship-members`              | Name one of the nine members of the Fellowship of the Ring.                 |    9 |     0.57 | 9/23 → 23/23          |
| `headphone-jack-iphones`          | Name an iPhone model with a built-in headphone jack.                        |   13 |     0.51 | 13/26 → 26/26         |
| `hemingway-novels`                | Name a novel or novella by Ernest Hemingway.                                |   11 |     0.58 | 16/19 → 19/19         |
| `heroes-chocolates`               | Name a chocolate in the standard British Cadbury Heroes assortment.         |    9 |     0.49 | 10/23 → 23/23         |
| `iba-bloody-mary-ingredients`     | Name an ingredient or garnish in the IBA's Bloody Mary recipe.              |   10 |     0.48 | 10/20 → 20/20         |
| `iba-singapore-sling-ingredients` | Name an ingredient or garnish in the IBA's Singapore Sling recipe.          |   11 |     0.54 | 10/22 → 22/22         |
| `lego-ideas-sets`                 | Name a numbered LEGO Ideas set released for sale.                           |   81 |     2.39 | 24/40 → 40/40         |
| `leonardo-paintings`              | Name a painting attributed to Leonardo da Vinci.                            |   37 |     1.28 | 27/32 → 32/32         |
| `lloyd-webber-musicals`           | Name a stage musical composed by Andrew Lloyd Webber.                       |   21 |     0.81 | 23/26 → 26/26         |
| `masterchef-us-winners`           | Name a winner of the main US MasterChef series.                             |   17 |     0.77 | 13/27 → 27/27         |
| `original-care-bears`             | Name one of the original ten Care Bears.                                    |   10 |     0.49 | 10/20 → 20/20         |
| `quality-street-chocolates`       | Name a current in-tin Quality Street sweet.                                 |   12 |     0.56 | 14/23 → 23/23         |
| `radiohead-studio-albums`         | Name a Radiohead studio album.                                              |    9 |     0.48 | 12/15 → 15/15         |
| `rock-hall-multiple-inductees`    | Name an artist inducted into the Rock and Roll Hall of Fame more than once. |   29 |     0.94 | 26/27 → 27/27         |
| `smash-64-fighters`               | Name a playable fighter in the original Nintendo 64 Super Smash Bros.       |   12 |     0.49 | 12/17 → 17/17         |
| `super-bowl-halftime-leads`       | Name a headliner or special guest in a Super Bowl halftime show since 1993. |  124 |     3.27 | 48/51 → 51/51         |
| `u2-studio-albums`                | Name a U2 studio album.                                                     |   17 |     0.68 | 17/21 → 21/21         |
| `uk-childrens-laureates`          | Name a UK Children's Laureate.                                              |   14 |     0.62 | 26/27 → 27/27         |
| `uk-three-michelin-stars`         | Name a restaurant currently holding three Michelin stars in the UK.         |   15 |     0.75 | 15/24 → 24/24         |
| `world-cheese-champions`          | Name a cheese variety named World Cheese Awards champion.                   |   26 |     1.17 | 12/21 → 21/21         |
| `worlds-best-restaurants`         | Name a restaurant ranked first in The World's 50 Best Restaurants.          |   13 |     0.53 | 15/18 → 18/18         |

New content: **633 canonicals, 565 aliases**; **21 tiny, seven medium, one
large** set. Standalone module gzip (Node v24.22.2, zlib 1.3.2.1, level 6) totals
**23.74 KiB**; it is not additive whole-Worker marginal size.

## Source completeness and editorial decisions

All 29 prompts have exact expected counts and pinned Wikipedia provenance:
30 source snapshots, including a separate Captain Falcon source. Reviewed
members were checked against their pinned source bodies during authoring.

- **Chocolate assortments:** current standard UK Celebrations (8), Heroes (9)
  and Quality Street (12), not historical/discontinued contents or special mixes.
  Galaxy/Dove, Milky Way/Mars regional names and common short product names are
  reviewed aliases, not extra canonicals.
- **Food substitutions:** the original Baskin-Robbins 31 and current Jelly Belly
  flavors were not completely enumerable from the available sources; state
  desserts mixed arbitrary dessert/category filtering. World Cheese Awards
  winners and two explicit IBA recipes replaced those concepts.
- **Restaurant awards:** the 15 current UK three-star Michelin restaurants and
  all 13 distinct first-place World's 50 Best restaurants come from the pinned
  result tables. Former UK three-star restaurants are outside the current scope.
- **MasterChef:** 17 named US main-series winners, including the joint-winner
  season; Junior, Celebrity and other international versions are excluded.
- **Cheese:** all 38 dated World Cheese Awards champion rows were reviewed,
  including linked product/producer text, and consolidated into 26 named cheese
  varieties. Commercial winner names and familiar style names (Gouda, Stilton,
  Camembert, Gruyere, etc.) remain accepted aliases. Ostegården's separate page
  was checked to disambiguate its Fanaost winner.
- **IBA recipes:** Bloody Mary has ten ingredients/garnishes; Singapore Sling
  has eleven, including ice and both named garnishes. Generic cocktail variants
  (e.g. horseradish in a Bloody Mary) are not members of the explicitly IBA scope.
- **Everyday:** a historical Care Bears revision explicitly enumerates the ten
  original bears. iPhones include all 13 models with a headphone jack, including
  first-generation SE. Crayola uses the eight 1990 retirements, not later renames.
  Disney Princess means the 13 official franchise members, not all royal Disney
  characters (Anna/Elsa, Alice and Megara are outside that lineup).
- **LEGO Ideas:** all 81 numbered sets already released for sale at the pinned
  revision, including the early Cuusoo sets. Approved/unreleased projects and
  promotional extras are outside the scope. Common display-title variants
  (WALL-E, Big Bang Theory, Beatles, Snoopy, Steamboat Willie, etc.) are aliases.
- **Music:** nine Radiohead and eight Beyoncé studio albums; compilations,
  remixes, live albums and EPs are excluded. U2 has 17 named studio albums: 16 released albums,
  including the U2/Eno Passengers project `Original Soundtracks 1`, plus the
  confirmed upcoming `Carnaval de Luz` (13 November 2026). The named imminent
  release is accepted proactively so it cannot become a post-cutover valid-answer
  gap; it is not an unnamed/TBA placeholder.
  Radiohead reissue names, album numerals and self-titled forms are accepted
  aliases where they identify an eligible original album.
- **Andrew Lloyd Webber:** all 21 enumerated stage musicals, including early,
  withdrawn and unsuccessful work. Movie-only scores and revues are excluded.
  Multiple Rock Hall inductees includes all 29 named multiple honorees, including
  the explicitly discussed legacy double honors.
- **Super Bowl:** all named headliner and special-guest credits from 1993 through
  the pinned current show: 124 people/groups/credited character or ensemble acts.
  Band/choir labels and unlinked credits were reviewed rather than only taking
  links from the headliner column. Guest-only Sting/ZZ Top/etc. are valid, while
  pre-1993 New Kids on the Block/Chubby Checker remain outside the prompt.
  Band members are not silently expanded into individually billed acts.
- **Aliases:** common stage/real names and nicknames (Macca, Ozzy, Queen Bey,
  The Boss, Slim Shady, etc.) are accepted. Unambiguous surnames were reviewed
  separately for human Super Bowl credits rather than treating every band's
  final word as a surname. The existing normalizer collapses `Williams` and
  `will.i.am`; the surname alias was not allowed to overwrite that canonical.
- **Books:** Fellowship means the nine members, not allied characters. Hemingway
  includes the eleven novels/novellas, including the posthumously published
  novel-length works, but not short-story collections or nonfiction memoirs.
  Poirot has all 34 novel/novella entries, including `The Greenshore Folly`.
  `Black Coffee` is Christie's play but its novelization is Charles Osborne's,
  so its raw guess remains
  correctly excluded from **Agatha Christie's** novels. All 14 UK Children's
  Laureates are included, with common names, accents and unambiguous surnames.
- **Art:** 37 Leonardo-attributed paintings from the main attribution catalog,
  including disputed/unfinished/lost paintings. Drawings such as Vitruvian Man
  and the separate speculative attribution appendix are excluded.
- **TV/games:** US Big Brother means 28 distinct main-series winners, not
  Celebrity/OTT/Reindeer editions. Smash means the twelve original N64 fighters;
  Eevee means its eight evolutions, not Eevee itself or later fan inventions.

All membership claims are bounded by their pinned snapshot and documented scope;
this is not a live-updating feed. Future releases/winners require a source refresh.

## Carryovers

The requested thematic mix summed to 32. This batch delivers food 9, everyday 5,
music 7, books 4, art 1, TV 1 and games 2: 29 prompts.

- Monopoly historical tokens were not proved by the available pinned histories
  (especially Lantern, Purse and Rocking Horse); carried over.
- Traditional anniversary gifts mixed US/UK/modern/historical lists; carried over.
- Dr Seuss bibliography mixed pen names, authorship and posthumous adaptations
  without a defensible complete subset; the fifth books slot is carried over.

Thus two everyday and one books quota remain; no incomplete set was activated.
Frozen brainstorms for all rejected candidates remain in the raw file.

## Scheduler correction

This batch exposed a generator failure: a fully constrained five-prompt day could
be all tiny (or all large). The filler loop correctly rejects such a mix when
adding broad prompts, but skips already-full days; final validation then raised
`Every day needs a difficulty mix` on the first attempt instead of trying the
existing next deterministic seed. `schedule.py` now retries those impossible
full-day layouts before filling. All existing rules, 200-seed limit and public
runtime selection behavior are unchanged. Regression tests cover a fully
constrained mixed bank and clean exhaustion for all-tiny/all-large banks.

The other authoring failure was the normalizer collision between the proposed
Williams surname alias and canonical will.i.am; rejecting that conflicting alias
preserves all 124 canonicals. No matcher or shared normalizer was changed.

## Budget and runtime limits

```text
Total Upload: 7837.36 KiB / gzip: 2946.24 KiB
--dry-run: exiting now.
```

- Post-pruning baseline: 2878.28 KiB; batch 2: 2926.87 KiB.
- Batch-3 actual marginal gzip: **19.37 KiB**; cumulative: **67.96 KiB**.
- Headroom: **53.76 KiB** to 3000; **125.76 KiB** to 3072.
- Reserve **3 KiB** for the gameplay branch plus **10 KiB** extra safety margin.
  Available authoring budget below the internal target after both: **40.76 KiB**.
- The gameplay branch is not merged/measured here; its 3 KiB is an estimate.
- Protected matcher, route, UI and shared-type files are unchanged. The existing
  40-character input cap still prevents submitting the valid full guess
  `Joseph and the Amazing Technicolor Dreamcoat` (44 characters); `Joseph` works.
  Answer-data recall is 709/709; cap-adjusted usable guesses are 708/709 (99.86%).
  The cap itself was deliberately not changed.

## Remaining replacement quotas

| Theme     |  Target | Batch 1 | Batch 2 | Batch 3 | Remaining |
| --------- | ------: | ------: | ------: | ------: | --------: |
| art       |       5 |       4 |       0 |       1 |         0 |
| books     |       8 |       3 |       0 |       4 |         1 |
| everyday  |      13 |       6 |       0 |       5 |         2 |
| film      |       7 |       0 |       2 |       0 |         5 |
| food      |      12 |       3 |       0 |       9 |         0 |
| games     |       2 |       0 |       0 |       2 |         0 |
| geography |      13 |       0 |       7 |       0 |         6 |
| history   |       5 |       0 |       2 |       0 |         3 |
| music     |      12 |       5 |       0 |       7 |         0 |
| nature    |      10 |       0 |       5 |       0 |         5 |
| science   |      12 |       0 |       6 |       0 |         6 |
| sports    |      10 |       0 |       5 |       0 |         5 |
| tv        |       5 |       4 |       0 |       1 |         0 |
| words     |       3 |       0 |       3 |       0 |         0 |
| **Total** | **117** |  **25** |  **30** |  **29** |    **33** |

Legacy order, all 330 legacy data modules, all preexisting specs/bases, the 50
retired constrained specs, and historical/frozen guesses remain unchanged.
The historical corpus SHA is
`03c5d365f1f14a5dc0e2013b71fe1f0c153d89e41c5c818f537af0334004405c`.
No visual UI verification was performed for this content-only change.
