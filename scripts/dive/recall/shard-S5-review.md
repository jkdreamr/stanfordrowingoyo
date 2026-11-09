# S5 constrained-content completeness audit

## Result

All 23 existing prompts reach **100% exact normalized recall** on both frozen baseline and shard corpora. Added **0 canonical answers and 185 alias strings**. Existing memberships, pinned source lists/counts, text, Surface/Too Clever/Pearl picks and bases are unchanged. The existing reviewed enumerations supplied the complete bounded membership; this pass repairs typing coverage rather than adding speculative members. Recall is a regression sample, not a proof of exhaustive natural-language coverage.

## Independent guesses and reproduction

The 678 raw guesses were frozen before opening answer data; SHA-256 `1d2f30c61f7dcb6c44c9151c928d30ef810f7fd0822cc434d3524995976f4721`. Each of 23 prompts has at least 25 distinct guesses. Selected preserves their order/text exactly; 21 genuinely incorrect guesses have explicit reasons. Raw was never reformatted or rewritten.

Before results use the original generated modules from base commit `6b96adde72f6b65904eab39ad3ba61b2c2fa4a9c`. Shard corpus is `{...corpus.json, ...shard-S5-selected.json}`: shard guesses replace, rather than append to, baseline guesses for these IDs. Both before/after use the same selected annotations. Historical corpus.json is unchanged.

```sh
source ~/.nvm/nvm.sh
node --input-type=module - <<'JS'
import {readFileSync, writeFileSync} from 'node:fs';
const read = name => JSON.parse(readFileSync(`scripts/dive/recall/${name}.json`, 'utf8'));
writeFileSync(`${process.env.HOME}/work/S5-corpus.json`, JSON.stringify({...read('corpus'), ...read('shard-S5-selected')}));
JS
~/work/dive-venv/bin/python scripts/dive/generate.py
node scripts/dive/recall.mjs
node scripts/dive/recall.mjs --corpus "$HOME/work/S5-corpus.json" --report "$HOME/work/S5-shard-after.json"
```

## Per-prompt recall

Fractions retain the valid denominator; every after rate is 100%.

| Prompt                | Baseline before → after        | Shard before → after           | Aliases added |
| --------------------- | ------------------------------ | ------------------------------ | ------------: |
| birthstones           | 21/21 (100.00%) → 21/21 (100%) | 24/26 (92.31%) → 26/26 (100%)  |             2 |
| booker-winners        | 34/34 (100.00%) → 34/34 (100%) | 26/27 (96.30%) → 27/27 (100%)  |             2 |
| chinese-cuisines      | 18/18 (100.00%) → 18/18 (100%) | 26/26 (100.00%) → 26/26 (100%) |             0 |
| dahl-novels           | 25/26 (96.15%) → 26/26 (100%)  | 26/29 (89.66%) → 29/29 (100%)  |             3 |
| dickens-books         | 28/29 (96.55%) → 29/29 (100%)  | 24/27 (88.89%) → 27/27 (100%)  |             3 |
| discworld-novels      | 37/37 (100.00%) → 37/37 (100%) | 31/32 (96.88%) → 32/32 (100%)  |             1 |
| eightfold-path        | 13/13 (100.00%) → 13/13 (100%) | 13/30 (43.33%) → 30/30 (100%)  |            21 |
| eu-food-allergens     | 24/27 (88.89%) → 27/27 (100%)  | 24/29 (82.76%) → 29/29 (100%)  |             9 |
| hugo-novels           | 35/35 (100.00%) → 35/35 (100%) | 24/26 (92.31%) → 26/26 (100%)  |             4 |
| iba-cocktails         | 34/36 (94.44%) → 36/36 (100%)  | 26/29 (89.66%) → 29/29 (100%)  |             8 |
| london-tube-lines     | 22/22 (100.00%) → 22/22 (100%) | 24/24 (100.00%) → 24/24 (100%) |             0 |
| monopoly-uk           | 29/29 (100.00%) → 29/29 (100%) | 30/31 (96.77%) → 31/31 (100%)  |             4 |
| monopoly-us           | 29/29 (100.00%) → 29/29 (100%) | 28/30 (93.33%) → 30/30 (100%)  |             6 |
| newbery-winners       | 36/36 (100.00%) → 36/36 (100%) | 27/27 (100.00%) → 27/27 (100%) |             0 |
| nobel-literature      | 29/30 (96.67%) → 30/30 (100%)  | 27/29 (93.10%) → 29/29 (100%)  |             2 |
| oneworld-airlines     | 17/19 (89.47%) → 19/19 (100%)  | 17/30 (56.67%) → 30/30 (100%)  |            22 |
| pantone-coty          | 28/29 (96.55%) → 29/29 (100%)  | 31/31 (100.00%) → 31/31 (100%) |             1 |
| pulitzer-fiction      | 35/36 (97.22%) → 36/36 (100%)  | 26/28 (92.86%) → 28/28 (100%)  |             2 |
| shakespeare-plays     | 36/36 (100.00%) → 36/36 (100%) | 27/30 (90.00%) → 30/30 (100%)  |            11 |
| sherlock-holmes-books | 21/21 (100.00%) → 21/21 (100%) | 21/26 (80.77%) → 26/26 (100%)  |             6 |
| skyteam-airlines      | 20/25 (80.00%) → 25/25 (100%)  | 17/32 (53.12%) → 32/32 (100%)  |            27 |
| star-alliance         | 27/34 (79.41%) → 34/34 (100%)  | 19/32 (59.38%) → 32/32 (100%)  |            45 |
| stellantis-brands     | 16/17 (94.12%) → 17/17 (100%)  | 20/26 (76.92%) → 26/26 (100%)  |             6 |

## Sources and editorial decisions

Read the pinned Wikipedia references below through webfetch and compared the existing reviewed membership snapshots. Direct Python HTTP fetches returned 403, so those failed requests were not evidence; source-verification mode was not run. The pinned list scopes/counts were retained, not refreshed to a different date. This is an alias-only audit.

- `birthstones`: [Birthstone, revision 1372868697](https://en.wikipedia.org/w/index.php?title=Birthstone&oldid=1372868697).
- `booker-winners`: [Booker Prize, revision 1376317505](https://en.wikipedia.org/w/index.php?title=Booker%20Prize&oldid=1376317505).
- `chinese-cuisines`: [Chinese cuisine, revision 1384209878](https://en.wikipedia.org/w/index.php?title=Chinese%20cuisine&oldid=1384209878).
- `dahl-novels`: [Roald Dahl bibliography, revision 1378730847](https://en.wikipedia.org/w/index.php?title=Roald%20Dahl%20bibliography&oldid=1378730847).
- `dickens-books`: [Charles Dickens bibliography, revision 1377807335](https://en.wikipedia.org/w/index.php?title=Charles%20Dickens%20bibliography&oldid=1377807335).
- `discworld-novels`: [Discworld, revision 1384342121](https://en.wikipedia.org/w/index.php?title=Discworld&oldid=1384342121).
- `eightfold-path`: [Noble Eightfold Path, revision 1384332554](https://en.wikipedia.org/w/index.php?title=Noble%20Eightfold%20Path&oldid=1384332554).
- `eu-food-allergens`: [Food allergy, revision 1384112030](https://en.wikipedia.org/w/index.php?title=Food%20allergy&oldid=1384112030).
- `hugo-novels`: [Hugo Award for Best Novel, revision 1375530935](https://en.wikipedia.org/w/index.php?title=Hugo%20Award%20for%20Best%20Novel&oldid=1375530935).
- `iba-cocktails`: [List of IBA official cocktails, revision 1380310166](https://en.wikipedia.org/w/index.php?title=List%20of%20IBA%20official%20cocktails&oldid=1380310166).
- `london-tube-lines`: [London Underground, revision 1383922208](https://en.wikipedia.org/w/index.php?title=London%20Underground&oldid=1383922208).
- `monopoly-uk`: [Monopoly (game), revision 1383315669](https://en.wikipedia.org/w/index.php?title=Monopoly%20%28game%29&oldid=1383315669).
- `monopoly-us`: [Monopoly (game), revision 1383315669](https://en.wikipedia.org/w/index.php?title=Monopoly%20%28game%29&oldid=1383315669).
- `newbery-winners`: [Newbery Medal, revision 1383246761](https://en.wikipedia.org/w/index.php?title=Newbery%20Medal&oldid=1383246761).
- `nobel-literature`: [List of Nobel laureates in Literature, revision 1383683554](https://en.wikipedia.org/w/index.php?title=List%20of%20Nobel%20laureates%20in%20Literature&oldid=1383683554).
- `oneworld-airlines`: [Oneworld, revision 1384313389](https://en.wikipedia.org/w/index.php?title=Oneworld&oldid=1384313389).
- `pantone-coty`: [Pantone, revision 1379530883](https://en.wikipedia.org/w/index.php?title=Pantone&oldid=1379530883).
- `pulitzer-fiction`: [Pulitzer Prize for Fiction, revision 1378224915](https://en.wikipedia.org/w/index.php?title=Pulitzer%20Prize%20for%20Fiction&oldid=1378224915).
- `shakespeare-plays`: [Shakespeare's plays, revision 1384091829](https://en.wikipedia.org/w/index.php?title=Shakespeare%27s%20plays&oldid=1384091829).
- `sherlock-holmes-books`: [Sherlock Holmes, revision 1384029189](https://en.wikipedia.org/w/index.php?title=Sherlock%20Holmes&oldid=1384029189).
- `skyteam-airlines`: [SkyTeam, revision 1381760703](https://en.wikipedia.org/w/index.php?title=SkyTeam&oldid=1381760703).
- `star-alliance`: [Star Alliance, revision 1384314070](https://en.wikipedia.org/w/index.php?title=Star%20Alliance&oldid=1384314070).
- `stellantis-brands`: [Stellantis, revision 1382973422](https://en.wikipedia.org/w/index.php?title=Stellantis&oldid=1382973422).

Additional reference: [Stellantis official brands](https://www.stellantis.com/en/brands/our-brands). Airline two-letter codes and abbreviations identify the existing member airline, never an additional member. All 26 Star Alliance, 18 SkyTeam and 15 oneworld existing rows were considered, including code aliases outside both corpora.

- Existing normalization already accepts leading articles, accents, punctuation and `&`/`and`; redundant aliases were removed instead of paying bundle cost for them. Numeral history-title variants and American/British spellings are explicit where normalization does not cover them.
- Short book titles remain valid guesses: Haunted Man, Edwin Drood, Great Glass Elevator, Seven Moons, Goblet of Fire, Casebook and Return identify the existing row. Full Kavalier and Clay title maps to its existing shortened canonical.
- EU ingredient examples wheat/rye/barley/oats/spelt/kamut map to the existing gluten-cereal category. Dairy maps to milk. Shellfish is generously accepted under crustaceans; it overlaps molluscs, so the grouping is an acceptance convenience, not a claim that those biological groups are synonymous.
- Pink tourmaline and blue topaz are accepted specific forms of the existing birthstones. Fiat Professional maps to Fiat rather than adding a commercial sub-brand as a new car marque.
- Eightfold Path accepts equivalent Wise wording and unaccented Pali names. Han remains an automatic surname alias; Kang is additionally accepted as a natural player shortening of Han Kang.
- Tom Collins remains valid against the baseline: the IBA John Collins recipe permits the Old Tom gin variant. White Russian is historical, absent from the pinned current 102, and is reviewed-invalid. No former cocktails were silently introduced as current members.

## Invalid summary

Reasons are preserved individually in selected JSON: wrong award/category (Mirror and the Light, Foundation, Red Mars, All Systems Red, Charlotte's Web, Great Gatsby); non-novel forms (Boy, A Christmas Tree, A Scandal in Bohemia); nonmember cuisines (Beijing); non-Underground railways (Elizabeth, DLR, Overground); non-property board spaces (Go, Free Parking); suspended/former airline memberships (S7, Aeroflot, SAS in Star); non-laureate Murakami; independent Ferrari; and historical-not-current White Russian. Valid short names, subtypes and aliases were not excluded merely because they originally missed.

## Flags for future editorial work

No prompt falls below the requested recall threshold. Do not delete or rewrite these prompts as part of this shard.

- **birthstones**: traditional/modern membership spans multiple national traditions; wording does not expose those boundaries. Consider naming the traditions in a future wording pass.
- **dahl-novels**: the existing source includes very short illustrated narratives; “novel or novella” is not a clean bibliographic boundary for every entry. Clarify to narrative books in a coordinated wording change.
- **shakespeare-plays**: the existing generous scope includes lost/collaborative works and a Cardenio adaptation. The plain wording does not explain that convention.
- **eightfold-path / chinese-cuisines / london-tube-lines**: complete but tiny, easily exhausted lists (8/8/11). Limited depth and repeated variants should not be mistaken for many independent answers.
- **eu-food-allergens**: category versus ingredient granularity is unclear. Generous alias acceptance fixes recall but does not make the category names biologically interchangeable.
- **star-alliance / oneworld-airlines / skyteam-airlines**: live memberships change, and suspended/affiliate membership needs a date/scope in future wording. This pass retains the pinned active full-member scope.
- **iba-cocktails**: list membership is obscure and changes across editions; familiar former drinks can be valid in older lists but not the pinned current edition.
- **booker-winners / hugo-novels / newbery-winners / nobel-literature / pulitzer-fiction / pantone-coty**: all-years award/list prompts remain relatively broad and require refreshes as new winners are announced. Canonical future-looking entries in the supplied pinned sources were not independently re-awarded or removed.

## Verification and gzip

The unchanged API limits submissions to 40 characters. Exact answer-data recall does not apply that cap: the valid full Kavalier and Clay title exceeds it, while the existing short `Kavalier & Clay` works. No matcher or input-cap changes were made.

The one-off `~/work/S5-validate.py` imports `constrained.normalize`, `read_specs` and generator `prepare`. It enumerated all collisions across the 23 prompts and removed them in one pass (first occurrence/canonical wins). Final output:

```text
Alias violations: 0
All 23 S5 prompts pass generator prepare() alias validation.
```

Generation and `generate.py --check` both completed. Python unittest: 28 tests, OK. Node recall tests: 10 pass, 0 fail. Both recall runs: all 23 target prompts 100%; unrelated prompts retain their preexisting misses. Build succeeded without deployment.

```text
Before: Total Upload: 7837.36 KiB / gzip: 2946.24 KiB
After:  Total Upload: 7840.34 KiB / gzip: 2947.28 KiB
--dry-run: exiting now.
```

Worker gzip delta **+1.04 KiB ≈ +1,065 bytes**, below +4 KiB budget. Wrangler prints hundredths of KiB, so this conversion is approximate (roughly ±10 bytes), not an exact byte measurement. Generated outputs are restored before commit; re-run generation to reproduce the audited runtime data. No UI/runtime/shared-contract code changed; no visual verification performed.
