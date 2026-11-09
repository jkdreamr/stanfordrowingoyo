# First constrained replacement batch

All 25 selected specs are active. Normal regeneration produces 64 days with 228
constrained prompts and 92 broad prompts. There is no staging mechanism or change
to the frozen pre-cutover order. The 50 retired constrained specs stay retired.

## Theme plan

| Theme     | Existing constrained | Approved replacement target | This batch | Remaining target |
| --------- | -------------------: | --------------------------: | ---------: | ---------------: |
| art       |                    0 |                           5 |          4 |                1 |
| books     |                   10 |                           8 |          3 |                5 |
| everyday  |                   10 |                          13 |          6 |                7 |
| film      |                   21 |                           7 |          0 |                7 |
| food      |                    3 |                          12 |          3 |                9 |
| games     |                    6 |                           2 |          0 |                2 |
| geography |                   34 |                          13 |          0 |               13 |
| history   |                   20 |                           5 |          0 |                5 |
| music     |                   11 |                          12 |          5 |                7 |
| nature    |                   16 |                          10 |          0 |               10 |
| science   |                   24 |                          12 |          0 |               12 |
| sports    |                   23 |                          10 |          0 |               10 |
| tv        |                    8 |                           5 |          4 |                1 |
| words     |                   17 |                           3 |          0 |                3 |
| **Total** |              **203** |                     **117** |     **25** |           **92** |

The final approved geography target is 13, resolving the earlier one-slot
surplus. The replacement targets now total 117, for 320 constrained prompts
without broad fillers at the end of the content pass.

Theme totals alone are not a final scheduling proof. Daily themes and nonempty
clusters must be unique, and each day must not be entirely tiny or entirely large.
Keep distinct future clusters across the 14 themes; no final theme/cluster can
exceed 64 prompts. Current new clusters are painters, architecture, museums,
beer, cookies, eating-contests, cards, calendar, cars, colors, disney, toys,
entertainment-awards, festivals, bands, musicals, artist-albums, tolkien, oz,
horror-books, star-trek and reality. This batch supplies 16 tiny, eight medium
and one large set; three reality prompts and two architecture prompts must be
separated across days. The real regenerated schedule validates these constraints.
Future ENABLE sets remain limited to 2–3 clever patterns, at most 2,000 answers
each; none is included here.

## Recall audit

Guesses were written before source/generated-data inspection. The selected
corpus has 864 guesses, 35 reviewed-invalid, and 829 valid submissions. All raw
guesses are retained. Six invalid annotations followed initial source review:
Raspberry Rally, Savannah Smiles and Thanks A Lot were not sold in 2025;
Imperial Hotel and Johnson Wax Building are not in Wright's UNESCO inscription;
Section 31 is a film, not a series. The Nathan substitute subsequently added
four independently invalid guesses, including one mistaken given name. Other
invalid annotations were made before evaluating the selected batch. Invalid
status is based on membership/scope, never lack of generated data.

The same final denominator gives **590/829 (71.17%) before alias review** and
**829/829 (100%) afterward**, with every individual prompt at 100%. This tests a
single independent brainstorm, not player telemetry or proof of exhaustive
English aliases. The historical baseline corpus remains byte-identical, SHA-256
`03c5d365f1f14a5dc0e2013b71fe1f0c153d89e41c5c818f537af0334004405c`.
The audit JSON preserves individual misses, exclusions and sizes. Before/after
full-cycle reports persist under `$HOME/work/dive-batch1/` for this handoff;
the tracked artifact preserves the batch-only comparison.

**Existing product limitation:** these are answer-data recall rates, not an
end-to-end input acceptance claim. `routes/dive.ts` and the web input cap answers
at 40 characters. One valid brainstorm submission, "National Museum of African
American History and Culture" (55 characters), is in the data but cannot be
submitted in full. Short forms and NMAAHC work. Counting that submission as
unusable yields 828/829 (99.88%) for the batch and 34/35 (97.14%) for Smithsonian.
The protected route/UI files were not changed; lifting the cap needs separate
authorization. No guess was marked invalid because of this product limit.

## Sources and scope

The pinned Wikipedia revisions, exact reviewed members and expected counts live
in each spec's `sources`. Snapshots were acquired and compared with reviewed
members. All canonical rows survive generation, including the two deliberately
shortened display names (African American History Museum and Hamilton's finale).
Their full source names remain accepted through normalization/aliases.
This describes data lookup, subject to the existing input limit noted above.

- **Art:** Vermeer includes all 37 surviving accepted/disputed paintings, including
  Girl with a Flute; alternative English titles are aliases. Pritzker splits joint
  laureates into people (55). Smithsonian accepts the 20 listed institutions and
  both additional museums authorized in 2020 even before opening (22); Asian Art
  Museum is an umbrella alias. Wright includes all eight UNESCO components.
- **Food:** all 14 listed current/former Trappist breweries, including non-ATP
  Mont des Cats/Cardeña, because the prompt does not claim current certification;
  all 12 Girl Scout cookie varieties in the February 2025 revision, with equivalent
  bakery names merged; all 36 identifiable Nathan's champions, including women,
  ties and documented early/challenge events, excluding the unknown 1973 winner
  and the debunked 1916 origin story.
- **Everyday:** 22 Major Arcana cards with common Marseille/Thoth names; 11 annual
  federal holidays (not quadrennial Inauguration Day); all 17 vehicle brands named
  in Volkswagen's passenger and Traton truck/bus portfolios; 148 named CSS colors;
  12 operating Disney theme parks (not water/unopened parks); 20 standard Magic 8
  Ball responses, including natural short forms.
- **Music:** competitive and honorary EGOT winners (28); all 32 billed Woodstock
  musical acts (not the opening speaker); all ten current/former Wu-Tang members,
  with birth names/personas; all 47 Hamilton stage numbers, including reprises and
  the Laurens interlude absent from the album; all 12 Eminem solo studio albums,
  excluding compilations/soundtracks. Performer surnames and common act names
  remain accepted.
- **Books:** all 13 company dwarves, 14 Baum Oz novels and 62 original Goosebumps
  books. Short titles, article variants and Roman/Arabic sequel numbers accepted.
- **TV:** all 13 Star Trek television series; every named US Survivor, main US
  Drag Race and US Top Chef winner in the pinned tables. Placeholder `TBA` rows
  are excluded, not treated as people. Main Drag Race excludes All Stars and
  international franchises explicitly. Repeated winners are deduplicated.

Rejected source candidates remain in the raw brainstorms: Dow Jones lacked a
clean component extraction; French cheeses mixed AOC/PDO/PGI/LR; the DOCG wine
page claimed 77 but enumerated only 76 appellations, so the candidate was dropped
rather than calling a demonstrably incomplete list complete. Top Chef, Magic 8
Ball and Nathan's contest replaced them.

## CSS dataset attribution

Pinned dataset:
`https://raw.githubusercontent.com/bahamas10/css-color-names/c41f2d98d6b018226f3505d6e0238bd7e2d7e611/css-color-names.json`

SHA-256: `d1ea4c9cfb8462cac4fe1cb62929696daa95b9fa5f6fc4cac5e8798afc44eeb7`.
All 148 entries are included, with spaced versions of multiword colors accepted.
`transparent`/`currentColor` are special keywords, not named sRGB colors.

Copyright 2018 Dave Eddy <dave@daveeddy.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in the
Software without restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
