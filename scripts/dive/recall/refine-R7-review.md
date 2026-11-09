# Dive refinement R7

Frozen brainstorm bytes and ordering remain unchanged. The selected corpus preserves every frozen guess; the follow-up does not invalidate any additional guess. Source snapshots, per-member evidence, recall and overlap are recorded in `refine-R7-audit.json`.

## Final prompts

| ID                    | Exact wording                                                                    | Count | Band   | Recall |
| --------------------- | -------------------------------------------------------------------------------- | ----: | ------ | -----: |
| macbeth-phrase-novels | Name a novel whose title comes from a phrase in Macbeth.                         |    46 | medium |  27/27 |
| ala-challenged-2010s  | Name a book on any ALA annual top 10 most challenged list, 2010–2019.            |    56 | medium |  38/38 |
| big-read-top-21       | Name a book in the final top 21 of the BBC's 2003 Big Read poll.                 |    21 | tiny   |  22/22 |
| books-sold-100m       | Name a book with 100M+ estimated sales, excluding religious and political texts. |     8 | tiny   |    9/9 |

The wording lengths are 56, 69, 64 and 80 characters respectively. **100M+ means at least 100 million**, intentionally including exactly 100 million.

## Macbeth follow-up

The approved rule is a published novel or novella whose title is a verbatim or near-verbatim Macbeth phrase. An explicit statement explaining its title's origin is no longer required. All eleven previously missed frozen guesses identify published qualifying works:

- _Brief Candle_, Kate Pennington (2005).
- _Out, Damned Spot!_, F. J. McQueen (2016).
- _Toil and Trouble_, H. P. Mallory (2010), a novel distinct from the original source group's comic.
- _Poor Player_, Lesley Krueger (1993).
- _Struts and Frets_, Jon Skovron (2009); accept frozen “Strut and Fret” as a natural near-verbatim variant.
- _Lay On, Mac Duff!_, Charlotte Armstrong (1942); accept modern spacing “Lay On, Macduff”.
- _Screw Your Courage_, Alexandra Y. Caluen (2022), a novella.
- _Vaulting Ambition_, Debi Gueron/Barnett Greenman (2023).
- _The Be All and End All_, Patti Larsen (2024), a published 31,990-word fictional work, qualifying as a novella.
- _Eye of Newt_, Denise Dietz (2004), the 344-page prose mystery, not Michael Hague's graphic work.
- _The Instruments of Darkness_, John Connolly (2024).

Seven use checksummed Open Library edition JSON; three use checksummed author/retailer HTML records; Armstrong uses Wikipedia revision 1371549314. The audit records every source URL, checksum, publication evidence, Macbeth phrase and act/scene. All eleven phrases were checked against a checksummed Project Gutenberg Macbeth text. No titles were sought beyond the eleven missed frozen guesses.

The earlier 35-title set remains intact: 34 from the pinned source group/disambiguation links and Brown's independently pinned _The Weird Sisters_, distinct from Pratchett's _Wyrd Sisters_. The source-group draft excludes Rolt's short story _Hear Not My Steps_ and includes Mallory's novel _Fire Burn and Cauldron Bubble_. Identical normalized titles across authors count once. _Brief Candles_ remains an invalid collection, distinct from Pennington's qualifying _Brief Candle_.

## Other source scopes

ALA is the 56-title/series union of 101 annual entries, including all eleven entries listed in 2018. Series are not expanded; Melissa/George is one book. The approved original-byte SHA-256 pin is retained without Wayback (HTTP 429). Long titles have full-title aliases of shorter canonical display labels.

Big Read uses the stable BBC 2003 final top 21, retaining series as listed. The eight bestsellers are bounded to revision 1384375148's individual-book table; estimates, rather than audited sales totals, determine membership. Religious/political texts and series are excluded. Only two surface anchors fit the eight-book set while keeping all required difficulty tiers populated.

## Checks and size

All four prompts now have **100% frozen-corpus recall**. All new source pins re-acquired and matched exactly. Five throwaway source-parser fixture tests and 15 recall regression tests passed. Lint, typecheck and build passed. No overlap reaches 50% against any active constrained prompt or the 36 other-shard proposal lists.

Python ran 30 tests with only the two parent-owned catalog/retirement failures: 391 versus 387 total prompts, and the retired set missing these four old IDs. A throwaway harness bypassed only those two equality assertions and passed all 30 tests, including every wording/length assertion. Repository tests were not edited. Root Vitest passed 112 files / 1025 tests. Worker passed 29 files / 445 tests; only its expected retirement-count assertion fails (71 versus 67).

Worker gzip is **2994.46 KiB**, versus **2993.75 KiB** baseline: **+0.71 KiB (about 727 bytes)**, under +1.5 KiB. This follow-up adds +0.15 KiB over the preceding commit. New canonicals: 131; retired: 123.

Generated Worker data and generated reports are reverted before committing. No browser visual check was performed; these are data/source-tooling changes.
