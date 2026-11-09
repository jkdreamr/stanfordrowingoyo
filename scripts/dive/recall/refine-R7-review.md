# Dive refinement R7

Frozen brainstorms are preserved verbatim and in order in the selected corpus; exclusions have individual reasons. The raw SHA-256 is recorded in the audit. Sources and member-level evidence are in `refine-R7-audit.json`.

## Scope

- **macbeth-phrase-novels**: 35 titles, medium. The source-group draft was corrected by excluding Rolt’s short story _Hear Not My Steps_ and including Mallory’s novel _Fire Burn and Cauldron Bubble_. Same-title novels (including punctuation-only differences) are one answer. Brown’s _The Weird Sisters_ is the sole independently pinned frozen-guess supplement; it is distinct from Pratchett’s _Wyrd Sisters_. _Brief Candles_ is a collection, not a novel, despite containing a novella.
- **ala-challenged-2010s**: 56 title/series entries, medium, from 101 annual entries. Include all eleven ALA entries for 2018. Series remain as listed; do not add their individual books. Melissa/George is one book. Remove series suffixes only for title deduplication. The approved raw HTML SHA-256 is used; Wayback returned HTTP 429 and is not required. Preserve CRLF bytes when checking this source. Display titles longer than 40 code units are shortened with their complete titles accepted as aliases.
- **big-read-top-21**: the final 21 ranked books/series of the BBC’s 2003 poll, tiny. Lower-ranked books are not members. 1984, LOTR and natural series shorthand are accepted.
- **books-sold-100m**: the eight individual-book entries in revision 1384375148’s table, tiny. “At least” intentionally includes exactly 100 million. Estimates and membership are bounded to that revision; religious/political texts and series are excluded. The tiny eight-answer set has only two surface anchors so school/rare/deep tiers remain populated.

## Recall exception

Macbeth scores **16/27 (59.26%)**, below the 95% target. Eleven known or plausible novel/novella guesses lack the specifically approved Wikipedia title-origin pin and remain valid denominator entries, not reviewed-invalid guesses. They include _Instruments of Darkness_, _Toil and Trouble_, _Screw Your Courage_, _Lay On, Macduff_, _Brief Candle_, _Out, Damned Spot_, _Poor Player_, _Strut and Fret_, _Vaulting Ambition_, _The Be-All and End-All_ and the uncertain graphic-fiction candidate _Eye of Newt_. Publisher/author/review evidence and the remaining pin gaps are recorded individually in the audit. Only Brown’s novel had the required independent Wikipedia statement. No supplements were sought beyond the frozen brainstorm.

ALA scores **38/38**, Big Read **22/22**, and bestsellers **9/9**. Frozen raw guesses and their ordering remain unchanged.

## Overlap

Checked every active constrained prompt and all other Appendix B proposal lists in the supplied review, including aliases and normalized titles. No pair reaches 50% of the smaller canonical set. Per-prompt nonzero intersections are recorded in the audit.

## Delivery checks

Final recall, gzip and command results are recorded in the audit after generation. Generated Worker data and generated reports are deliberately excluded from the commit. This is a data/source-tooling change; no browser visual verification was performed.

## Final results

Worker gzip: **2994.31 KiB**, versus **2993.75 KiB** baseline: **+0.56 KiB (about 573 bytes)**, under +1.5 KiB. New canonicals: 120; retired: 123.

Source acquisition, five throwaway parser fixture tests, 15 recall regression tests, formatting, lint, typecheck and build passed. Root Vitest passed 112 files / 1025 tests. Worker Vitest has the expected retirement-count failure (71 versus 67); its other 445 tests passed. Python ran 30 tests with two failures: fixed catalog count 387 versus 391, and a fixed retirement set missing these four IDs. No tests were edited because the allowed scope excludes them. The Python test’s later 85-character wording limit also needs parent accommodation for the exact approved ALA (97) and bestseller (106) texts; that assertion is currently masked by its retirement-set failure.
