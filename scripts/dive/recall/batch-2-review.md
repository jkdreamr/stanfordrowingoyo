# Constrained replacement batch 2

Batch 1 is checkpointed locally at `471d2ce`. This batch adds 30 active prompts without staging machinery. The prospective schedule is **64 days, 258 constrained and 62 broad**. The 330 legacy modules/order, protected paths, source bases and prior 278 specs remain unchanged; the same 50 constrained specs remain retired.

## Prompt inventory and exact recall

Gzip is standalone generated-module gzip level 6, in KiB. Both columns use the final reviewed-invalid denominator. Raw guesses were frozen before source retrieval or generated-set inspection; no guesses were added or removed after measurement.

| ID                            | Prompt                                                                    | Size | Gzip KiB | Before → after |
| ----------------------------- | ------------------------------------------------------------------------- | ---: | -------: | -------------: |
| `eight-thousanders`           | Name one of the fourteen eight-thousander mountains.                      |   14 |     0.57 |  14/25 → 25/25 |
| `borders-brazil`              | Name a country with a land border with Brazil.                            |   10 |     0.51 |  10/24 → 24/24 |
| `equator-countries`           | Name a country the equator passes through.                                |   13 |     0.56 |  15/22 → 22/22 |
| `euro-countries`              | Name a country that uses the euro.                                        |   27 |     0.63 |  27/27 → 27/27 |
| `capital-country-name`        | Name a country whose name appears in its capital's name.                  |   11 |     0.52 |  11/22 → 22/22 |
| `no-standing-army`            | Name a country without a standing army.                                   |   21 |     0.65 |  21/24 → 24/24 |
| `mediterranean-countries`     | Name a country with a Mediterranean coastline.                            |   24 |     0.65 |  22/25 → 25/25 |
| `large-solar-moons`           | Name a Solar System moon over 1,000 kilometres across.                    |   16 |     0.51 |  17/24 → 24/24 |
| `standard-model-particles`    | Name one of the 17 fundamental particle types in the Standard Model.      |   17 |     0.64 |  17/27 → 27/27 |
| `astronomical-elements`       | Name an element named after a celestial body.                             |    8 |     0.41 |   8/18 → 18/18 |
| `lunar-maria`                 | Name a named sea on the Moon.                                             |   23 |     0.91 |  26/30 → 30/30 |
| `moon-mars-rovers`            | Name a rover that operated on the Moon or Mars.                           |   15 |     0.59 |  14/24 → 24/24 |
| `shuttle-final-crews`         | Name a crew member on a Space Shuttle orbiter's final flight.             |   30 |     1.11 |  17/38 → 38/38 |
| `ballon-dor-winners`          | Name a winner of the men's or women's Ballon d'Or.                        |   54 |     1.56 |  31/32 → 32/32 |
| `indy-500-winners`            | Name a driver who won the Indianapolis 500.                               |   77 |     1.93 |  32/35 → 35/35 |
| `olympic-decathlon-champions` | Name an athlete awarded Olympic decathlon gold.                           |   24 |     0.87 |  30/31 → 31/31 |
| `olympic-100m-champions`      | Name a sprinter awarded Olympic 100 metres gold.                          |   47 |     1.45 |  35/36 → 36/36 |
| `davis-cup-countries`         | Name a country that has won the Davis Cup.                                |   16 |     0.61 |  16/26 → 26/26 |
| `nz-bird-year`                | Name a winner of New Zealand's Bird of the Year vote.                     |   19 |     0.81 |  11/22 → 22/22 |
| `dickin-medal-animals`        | Name an animal awarded the Dickin Medal.                                  |   75 |     1.33 |  26/30 → 30/30 |
| `westminster-winning-breeds`  | Name a dog breed that won Best in Show at Westminster.                    |   50 |     1.33 |  17/28 → 28/28 |
| `canadian-emblem-birds`       | Name an official Canadian provincial or territorial bird.                 |   14 |     0.61 |  12/26 → 26/26 |
| `us-state-butterflies`        | Name a butterfly that is an official US state symbol.                     |   20 |     0.96 |  11/20 → 20/20 |
| `constitution-signers`        | Name a signer of the US Constitution.                                     |   40 |     1.18 |  24/25 → 24/25 |
| `us-banknote-portraits`       | Name a person whose individual portrait appeared on a US dollar banknote. |   53 |     1.64 |  24/27 → 27/27 |
| `miyazaki-films`              | Name a feature film directed by Hayao Miyazaki.                           |   12 |     0.68 |  13/25 → 25/25 |
| `palme-dor-films`             | Name a feature film that won Cannes' Palme d'Or or its predecessor.       |  103 |     2.35 |  28/29 → 29/29 |
| `enable-semordnilaps`         | Name a familiar 4–9-letter word that makes a different word backwards.    |  217 |     2.09 |  27/30 → 30/30 |
| `enable-three-es`             | Name a familiar 6–9-letter word containing at least three Es.             |  356 |     3.74 |  26/29 → 29/29 |
| `enable-five-vowels`          | Name a familiar word containing all five vowels.                          |   91 |     1.34 |  20/30 → 30/30 |

**Batch: 887 guesses, 76 reviewed-invalid, 811 valid. Exact recall 602/811 (74.23%) → 810/811 (99.88%).** All 30 prompts meet 95%; 29 reach 100%. The sole retained valid miss is `Morris`: both Robert Morris and Gouverneur Morris signed. The existing unambiguous-surname policy is preserved rather than silently picking a scorer or marking the guess invalid. Constitution recall is 24/25 (96%).

The sets contain 1,497 canonicals and 701 aliases: 17 tiny, 11 medium, two large. Full-cycle exact recall is 8121/9026 (89.97%); constrained 6727/7166 (93.87%), broad 1394/1860 (74.95%). The original baseline corpus and its SHA remain unchanged.

## Source and scope review

- **40 pinned source snapshots** cover accepted members and reviewed aliases. Exact expected counts are recorded for every prompt/source. All five final Shuttle crews total 30 people; collapsed footnote/colour-key rows are not astronauts. The Indy table's starred years initially hid Frank Lockhart, Johnnie Parsons and Buddy Rice; the complete 77-driver pool now includes all three.
- Two candidates were replaced after source review: `one-land-neighbor` mixed causeways, constituent countries, dependent territories and post-Hans-Island borders, making the tempting prompt ambiguous; `akc-hounds` redirected to a broad hound list rather than an exhaustive AKC group. Their pre-source brainstorms remain in the raw file. Replacement brainstorms for `borders-brazil` and `westminster-winning-breeds` were frozen before retrieving those sources. Brazil's surprise neighbour is France through French Guiana.
- Equator countries include territorial waters (Maldives and Kiribati). Euro users include Bulgaria in 2026, four microstates, Kosovo and Montenegro. Mediterranean coasts include Northern Cyprus and the UK's overseas coastline. Capital-name membership requires the full common country name, not a shared prefix such as Tunis/Tunisia.
- The eight celestial-named elements exclude **Mercury**: the pinned etymology explicitly names the Roman god, not the planet. `Mercury` and `Hg` were genuinely invalidated on that evidence, not because of generated absence. San Marino was independently checked against [Sammarinese Armed Forces revision 1376753992](https://en.wikipedia.org/w/index.php?oldid=1376753992): it has an Army branch/full-time forces, so its raw guess is also reviewed-invalid. Before/after denominators apply these annotations equally.
- Standard Model wording explicitly asks for one of 17 fundamental types, not umbrella classes such as quark or neutrino. Antiparticles/W charges alias their corresponding species. Large moons use diameter >1,000 km. Lunar seas include Mare/Oceanus entries and Latin/English names. Successful lunar/Martian rovers include hopping LEV-1 and the crewed Lunar Roving Vehicle, but not failed/future missions or the Ingenuity helicopter.
- Olympic prompts deliberately say **awarded**: historically awarded Hugo Wieslander, Ben Johnson and Marion Jones remain accepted even where medals were later reassigned/stripped. Ballon d'Or includes both competitive sexes and honorary Pelé/Maradona, but not merely retrospective rankings. Leo Messi/La Pulga, CR7 and Ronaldinho Gaúcho have additional pinned individual-page provenance.
- Bird-of-the-Year includes the 2021 bat and the 2023 Bird of the Century edition; Māori and English names are accepted. Dickin shared awards are split into individual recipients. The frozen Appollo spelling is retained as a valid natural variant after checking its Wikipedia redirect to Apollo (dog), rather than being excluded as a typo. Canada's list includes official game birds. State butterflies include butterfly species designated state insects, not non-butterfly insects.
- Constitution signers include 39 delegates and attesting secretary William Jackson. Banknotes cover all 53 individual portraits, not reverse-side historical vignettes or proposed future portraits. Cannes includes predecessor top prizes and the Special Palme for The Image Book; Miyazaki is limited to feature films he directed.

## ENABLE editorial policy and limitations

ENABLE is pinned to commit `233d25a56b9ac8bef906916ccf091a976995cce0`, SHA-256 `3f16130220645692ed49c7134e24a18504c2ca55b3c012f7290e3e77c63b1a89`, 172,823 source lines. Credit Alan Beale and M. Cooper; the list is public domain. All predicates apply to original spellings, before shared normalization:

- Semordnilaps: 4–9 letters; reverse is a different ENABLE word; **217** canonical entries.
- Three Es: 6–9 letters; at least three Es; **356** entries.
- All five vowels: contains A/E/I/O/U in any order; **91** entries.

The default familiarity floor is `wordfreq==3.1.1` Zipf ≥3, with explicit familiar picks and source-reviewed valid brainstorm exceptions such as sequoia, abstemious, gateman and weekended. Frequency is also the generator's tiering signal. Classic puzzle answers are Too Clever; Pearl picks are deliver, beekeeper and housemaid. Slurs and proper-name-dominated frequency artifacts with obscure lexical senses were removed; ordinary technical/medical vocabulary is not treated as offensive.

One valid brainstorm word, **cautioner**, is absent from ENABLE. It is retained using a SHA-pinned JSON response for Wiktionary English revision `93683712`, defining a person who cautions (also a Scots-law surety). This one declared dictionary supplement avoids invalidating a genuine English word just because ENABLE lacks it.

The production data test found that **skips** normalizes to reserved `skip` and cannot score under the protected matcher. It also reverses to an ethnic slur. It is excluded from the edited pool; no matcher or shared-normalization changes were made. Shared plural folding can still accept nonmatching surface forms, e.g. three-letter `bat` via valid `bats`; this previously identified normalization limitation is unchanged. The 40-character route/UI cap is unchanged as instructed. Long aliases such as the full 41-character Uncle Boonmee title remain in the answer data with a submit-cap-safe short canonical.

## Budget

Actual dry run: **Total Upload: 7761.62 KiB / gzip: 2926.87 KiB**, exit 0. Batch 2 adds 28.44 KiB over 2898.43 KiB. Cumulative growth over the pruned baseline is 48.59 KiB. Remaining headroom: **73.13 KiB to 3000**, **145.13 KiB to 3072**. Batch 2 standalone gzip sums to **32.74 KiB**; batches 1+2 approximately **56.62 KiB** (not additive Worker compression).

## Replacement quotas

| Theme     | Approved target | Batch 1 | Batch 2 | Still needed |
| --------- | --------------: | ------: | ------: | -----------: |
| art       |               5 |       4 |       0 |            1 |
| books     |               8 |       3 |       0 |            5 |
| everyday  |              13 |       6 |       0 |            7 |
| film      |               7 |       0 |       2 |            5 |
| food      |              12 |       3 |       0 |            9 |
| games     |               2 |       0 |       0 |            2 |
| geography |              13 |       0 |       7 |            6 |
| history   |               5 |       0 |       2 |            3 |
| music     |              12 |       5 |       0 |            7 |
| nature    |              10 |       0 |       5 |            5 |
| science   |              12 |       0 |       6 |            6 |
| sports    |              10 |       0 |       5 |            5 |
| tv        |               5 |       4 |       0 |            1 |
| words     |               3 |       0 |       3 |            0 |
| **Total** |         **117** |  **25** |  **30** |       **62** |

## Checks

- Generator reproducibility: 258 constrained / 62 broad, 588 runtime modules, 71 unreachable candidates omitted.
- Python: 25 tests, OK. Recall harness: nine tests, nine pass. Root data tests: 29 pass. Worker selector tests: 11 pass.
- The initial combined root run found the reserved-word issue above; the shared tests passed within that run, and the corrected data suite was rerun independently rather than repeating unchanged shared tests.
- Legacy/protected/baseline preservation checks pass. No UI files changed; visual UI behavior was not checked.
- Full logs and original before/after reports persist under `/home/ubuntu/work/dive-batch2*`; checked-in audit JSON records per-prompt before/after misses, hashes, sizes, aliases, tiers and gzip.
