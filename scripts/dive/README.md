# Dive answer data

Build-time only. No fetch, Python, word-frequency lookup or external service runs in
the Worker or browser. Broad sets are **not exhaustive dictionaries of valid answers**;
constrained sets must enumerate the complete stated constraint at their pinned source date.
Maintain omissions in the reviewed source, never award points from a crowd.

## Regenerate

From the repository root, with Node 24+ and npm dependencies installed:

```sh
source ~/.nvm/nvm.sh
python3 -m venv ~/work/dive-venv
~/work/dive-venv/bin/pip install -r scripts/dive/requirements.txt
~/work/dive-venv/bin/python scripts/dive/generate.py
~/work/dive-venv/bin/python scripts/dive/generate.py --check
# Re-extract pinned lists/datasets (using the ignored raw cache); fail on counts or membership drift:
~/work/dive-venv/bin/python scripts/dive/generate.py --verify-sources --check
~/work/dive-venv/bin/python -m unittest discover -s scripts/dive -p 'test_*.py'
# To intentionally refresh missing 2025 Wikipedia entity signals:
~/work/dive-venv/bin/python scripts/dive/generate.py --fetch-pageviews
~/work/dive-venv/bin/python scripts/dive/sitelinks.py
# To refresh or add Wikidata-sourced sets (sequential, paced SPARQL; resumable cache):
~/work/dive-venv/bin/python scripts/dive/wikidata.py --missing   # or: wikidata.py <prompt-id> ...
```

For a long-running fetch that only updates its resumable snapshot (not generated modules):

```sh
nohup ~/work/dive-venv/bin/python -u scripts/dive/generate.py --fetch-pageviews --fetch-only > ~/work/dive-pageviews.log 2>&1 < /dev/null &
```

The venv is outside the repository. Raw URL responses are cached under the ignored
`scripts/dive/.cache/`; never commit them. To refresh a source, intentionally change its
pinned version, clear that cache, regenerate, review the diff and run the integrity tests.
Network/schema errors fail regeneration rather than silently yielding empty sets.
The generator uses the installed repository Prettier to make output byte-reproducible.
Pinned Python versions fix GeoNames, ISO lists and word-frequency behavior.

`overrides.py` is the reviewed manifest: prompt text/source, explicit aliases, forced
Surface anchors, Too Clever picks and one Pearl per prompt. Explicit corrections/exclusions
are also here. Alias targets are canonicalized and synonymous source rows are removed.
Normalized canonical collisions collapse to one row; alias ambiguity fails generation.
Inputs, canonicals and aliases use the same normalization in Python and TypeScript.

Entity familiarity combines English Wikipedia **2025 annual human pageviews**, summed
from the Wikimedia REST per-article monthly endpoint (all-access/user, Jan–Dec). Contextual
MediaWiki title search rejects unrelated titles; explicit article mappings disambiguate
homographs (Date palm, Orange (fruit), Carambola, etc.). `familiarity.json` commits derived
article titles/totals; full raw search/monthly responses remain ignored under `.cache/`.
All requests send both `User-Agent` and `Api-User-Agent` as
`StanfordOYO-DiveBuilder/1.0 (josdreamr@gmail.com)`. Fetching is bounded to four HTTP
requests/second per process, honors Retry-After, checkpoints progress atomically,
and resumes caches. Wikipedia may throttle it further; completing a new snapshot can take hours.
No runtime network dependency is introduced; ordinary regeneration/check uses the snapshot.

`sitelinks.py` resolves English article titles to QIDs in batches of 50 using MediaWiki
pageprops, follows redirects, then queries `wikibase:sitelinks` in SPARQL `VALUES ?item`
batches of at most 300 QIDs. Disambiguation items are rejected; city items must have the
correct `P17` country and unresolved film titles must be film items. `sitelinks.json` is
the derived snapshot; raw responses remain ignored cache files. The Wikidata property
measures breadth across Wikimedia sites (predominantly Wikipedia language editions),
not a strict Wikipedia-only count.

The candidate pool is twice the prospective Surface population (minimum 100 names), plus
all reviewed anchors/picks/title overrides. Resolved pageviews rank before conservative
unresolved/unqueried fallback names. When both signals exist, rank is
`0.6 * log1p(annual_views / 5000) + 0.4 * log1p(sitelinks)`. The scale aligns typical
annual traffic with language-edition breadth. Missing pageviews use sitelinks alone;
missing sitelinks use pageviews alone. Whole-name Zipf is a final tiebreak, or fallback
when neither entity signal exists.
Explicit multiword tier corrections prevent Blood Orange/Star Fruit from becoming Surface
through component words. Each prompt is ranked independently, lexical normalized-key
tiebreak. Rank fractions are Surface `<20%`, Midwater `<55%`, Rare `<80%`,
Deep Cut otherwise. Then overrides apply. Too Clever and Pearl are **only** explicit
overrides, never automatic low-frequency picks. Hand anchors ensure dog, cat, France,
apple and other obvious answers score Surface. The single Pearl is a recognizable fun
pick, not necessarily the rarest name. Points: 10 / 15 / 30 / 60 / 85 / 100; miss 0.

## Coverage and review

The **live** bank remains the exact 330-prompt legacy permutation (66 days at five/day).
`legacy.json` freezes its original ID order before the seeded shuffle; do not append,
reorder or remove entries. `DIVE_LEGACY_PROMPTS` resolves those IDs from both catalogs,
including retired prompts. Adding prompts or changing active flags cannot change old days.
Answer rows persist date and prompt index, **not prompt IDs**: reads and submissions resolve
IDs from the selector. A future cutover must therefore keep the legacy branch forever.

The bank has 529 active prompts (210 constrained, 319 broad) and 32 inactive
prompts with loadable data. `DIVE_PROMPTS` is the schedule's candidate bank, not the date selector.
`DIVE_INACTIVE_PROMPTS` retains small categories and broad overlaps. Phase 1 prospectively
retires `movies`, `directors`, `pokemon`, `manga`, `anime`, `japanese-films`, `oscar-actors`,
`monarchs`, `nobel-laureates`, `first-names`, and `objects`; legacy days still use them.
Every prompt has an editorial theme and optional cluster (`themes.py` for broad prompts).
Japan-related manga/anime/films/cities share `japan`, including inactive entries.
Generation requires at least 320 prospective active prompts; broad active sets still need
200 canonical answers, constrained sets need 8 and are **never trimmed** by broad-set caps.

## Complete constrained sets

`constrained.json` is the reviewed snapshot/spec: prompt, theme/cluster, Surface anchors,
optional Too Clever picks, one recognizable Pearl, exact canonical-count range, sources,
and canonical/alias rows. Each Wikipedia source pins a positive revision and extraction
recipe (semantic table column with rowspan/colspan support, winner marker, row filter,
selector or explicitly reviewed membership). `sources.py` requests MediaWiki
`action=parse&oldid=REVISION`, verifies both returned title and revision, removes footnotes,
and checks the source count. A revision URL is `https://en.wikipedia.org/w/index.php?oldid=REVISION`.
Reviewed extracted names are committed; HTML/JSON/CSV responses are only in `.cache/constrained/`.
PokéAPI CSVs pin commit `f38eb24b70f8462976154f534e79bf2bdd7af847` **and** each file's SHA-256.
Dataset verification supports CSV and JSON, verifies bytes/checksum and expected row count.
No moving HEAD, latest dataset or unpinned page is used.

Normal regeneration validates reviewed counts offline. `--verify-sources` additionally
re-extracts every pinned list and checks exact agreement with its reviewed source names;
dataset checksum/count mismatches, missing pages, changed schemas and network errors fail.
Intentional source changes require a new pin, rerunning extraction, reviewing membership
differences and updating both source and final canonical expectations; never widen an
expect range just to suppress a failure. Do not copy fetched nominees into winner sets.
The Oscar snapshots use winner rows (Visual Effects also includes historical special awards).
Repeated awards/terms/film remakes with the same title collapse to one canonical answer.
Alien/Aliens share a combined canonical in Visual Effects because the existing plural
normalizer gives both the same input key; both titles are accepted (88 source titles, 87 canonicals).
The snapshots explicitly merge Lew Alcindor into Kareem Abdul-Jabbar and John Russell into
Lord John Russell. English monarchs exclude the Cromwell protectors and include disputed
claimants; Olympians accept both Hades and Hestia. Feature-film constraints exclude shorts
and unfinished films; Spielberg explicitly accepts Duel and anthology segments. Ghibli
includes Nausicaä, Ocean Waves and co-productions. No first-wave prompt was dropped, but
these scopes are explicit rather than silently incomplete broad filmographies.

The complete sovereign-state base includes partially recognised states. `constrained.py`
derives all nine lexical-country prompts and four lexical-state prompts from reviewed bases.
Predicate membership uses the canonical **or common English names**, not arbitrary acronyms
or formal titles; all aliases then resolve to the qualifying canonical. For example Czechia
qualifies Czech Republic for a Z. Country common variants/former names are explicit.
Gen I Pokémon membership is cross-checked against its pinned Wikipedia list (151, excluding
MissingNo.). Pokémon type sets join species through all dataset Pokémon forms and deduplicate
species; item-driven Arceus/Silvally forms are accepted explicitly. Nidoran genders have
distinct canonical/alias names because the normalizer removes the gender symbols.

Unambiguous surnames are added within each people set (including reviewed East Asian family
names); ambiguous surnames are never arbitrary tie-breaks. Team prompts explicitly name
the 2026 or 2026–27 season: historical defunct teams are outside those constraints. Teams
accept nicknames, not ambiguous city-only aliases. Film title aliases include common short titles; the existing
leading-article normalization and typo tolerance remain unchanged. Long titles use recognizable
short canonicals within Dive's existing 40-character input limit. Constrained ranking reuses
same-theme entity familiarity/sitelink signals where available, then whole-name Zipf/lexical
fallback. Surface is explicitly anchored; unforced constrained answers rank into Midwater
(first 45%), Rare (next 30%), Deep Cut (last 25%) so even small sets keep all tiers. Too Clever
is optional and never manufactured. Every set has exactly one explicit Pearl.

## Schedule and cutover

`schedule.py` deterministically emits explicit days of five prompt IDs to Worker `schedule.ts`.
A valid cycle is at least 64 days, has no repeated IDs, uses every constrained prompt, has
at least three constrained prompts/day, unique themes and nonempty clusters/day, and never
has a day entirely tiny (≤24 answers) or huge (>120 answers). Broad prompts fill remaining
slots in reviewed preference order. Both Python and Worker validators fail invalid schedules.
Insufficient or unbalanced catalogs return an empty schedule with an explicit diagnostic,
not a relaxed-rule rotation; generation now fails rather than enable an invalid cutover.
Tests exercise the real schedule, a full 64-day/320-ID fixture and invalid banks.

**Cutover is 2026-11-10**. The 64-day/320-ID cycle uses all 210 constrained prompts
and 110 preferred broad fillers; earlier dates use the frozen legacy permutation exactly.
The Worker tests verify cutover-day selection, every scheduled day, wraparound, legacy
dates through November 9, loadable IDs, theme/cluster/difficulty rules, and coverage.
The 151 Phase 2 additions add no Pokémon or country/state letter predicates. The largest
constrained cluster is countries (21/210, 10%). Phase 2 retires no additional broad data.
Ship **before** the cutover; never backdate it or change a cycle that could resolve an
already-started day. See `phase2-review.md` for the added-prompt table and editorial drops.

Broad sets retain their existing canonical data and caps. `report.json` records each set's
size, active flag, constrained flag, theme/cluster, tier counts,
top eight Surface answers, pageview/sitelink/Wikidata coverage, alias count, Too Clever picks
and Pearl. The ceiling is the Worker bundle budget (Cloudflare's free gzip limit is 3 MB),
not the categories: Wikidata snapshots keep more rows than ship, and
per-set `cap` values in `wikidata_prompts.py` (default 450, largest-first when trimming)
choose how many of the highest-ranked rows are emitted; `MAX_SET` in `generate.py` (430)
caps broad sets, largest first, including the original corpora sets. Raise it when the
budget allows. GeoNames cities keep at most the 500 largest places per country by population
and Vega movies at most 1,000 per genre by IMDB votes before that cap.

The original 120 prompts come from the reviewed corpora/GeoNames/ISO/movie sources below.
220 further prompts and Wikidata rows appended to 55 reviewed prompts (most were under 200) come from Wikidata:
people by field and sport, fictional characters, films by decade/genre/country, TV, books,
music, art, games, brands, foods and dishes by country, animals and breeds, geography,
places, sports teams and everyday things, plus 11 more city-by-country prompts (city prompts
are 14% of the rotation). Each Wikidata prompt is a SPARQL membership pattern (class with
optional subclasses, occupation including subclasses, parent-taxon tree, genre, country) in
`wikidata_prompts.py` with its own Surface anchors, optional Too Clever picks and one Pearl.
`wikidata.py` filters junk (disambiguation/list/category items, QID or missing English labels,
labels over 40 characters or mostly parenthetical, Latin-only taxa, fictional duplicates for
real-world prompts) and adult or notorious entries by description. People must have an
English description naming the field, so secondary occupations (a president who painted) are
dropped. Aliases come from English/`mul` altLabels, P1813 short names, P1449 nicknames, P1843
taxon common names, scientific names, IATA codes and, for people, surnames; reviewed aliases
win, and an automatic alias equal to another canonical or claimed by two canonicals is
dropped. A Wikidata row whose label or alias already exists in a reviewed source is the same
entity and only lends its aliases. New sets rank by Wikidata sitelinks alone (the README's
fallback when pageviews are missing); no new pageview fetches were needed. Wikidata class
membership is editorially imperfect (genre tags, co-production countries); corrections go into
the manifest (`WD_EXCLUDE`, anchors, queries), never generated modules. No rowing, Stanford,
team or Krillion prompts/content are used; all lists, tiers and Pearls are independently sourced.

Hand-checked anchors (entity signals determine ordering, not word homographs):

- Animals: dog/cat are Surface; platypus/aardvark Too Clever; axolotl Pearl.
- Countries: France/US/China/India/Canada Surface; Tuvalu/Vatican City Too Clever; Bhutan Pearl.
- Fruits: apple/banana/orange/grape/strawberry Surface; durian/dragonfruit Too Clever; rambutan Pearl.

## Sources and attribution

- [dariusk/corpora](https://github.com/dariusk/corpora), pinned commit
  `1109305242d08d851a50f929792a0e7caa7a655b`: named category lists; CC0 dedication.
  `overrides.py` records individual JSON paths/fields; upstream JSON also records its
  original sources (often Wikipedia). Names only, not descriptions, are extracted.
- [Vega datasets](https://github.com/vega/vega-datasets), v2.9.0 `data/movies.json`,
  BSD-3-Clause collection, originally IMDB/Rotten Tomatoes: film names/genre classifications.
- [GeoNames](https://www.geonames.org/), CC BY 4.0, through `geonamescache` 3.0.2:
  English/local city and town names, population at least 15,000 in the source snapshot.
  Explicit anchors add familiar smaller towns. ASCII/English exonyms need aliases where
  they differ from GeoNames names; common examples are reviewed in the manifest.
- [pycountry](https://github.com/pycountry/pycountry), 26.2.16, LGPL-2.1-or-later package
  using Debian `iso-codes` (LGPL-2.1-or-later): language names and US subdivisions.
- [Astropy](https://github.com/astropy/astropy), v7.1.0, BSD-3-Clause:
  `astropy/coordinates/data/constellation_names.dat`, the 88 IAU constellation names.
- [wordfreq](https://github.com/rspeer/wordfreq), 3.1.1: Apache-2.0 code / CC BY-SA 4.0
  frequency data. Only relative familiarity ranks, not raw frequency data, are emitted.
- English Wikipedia / Wikimedia Analytics: contextual article titles and aggregate 2025
  human pageview statistics from `en.wikipedia.org/w/api.php` and
  `wikimedia.org/api/rest_v1/metrics/pageviews/per-article/`. Raw search snippets are not
  redistributed. Derived counts are provenance, not copyrighted article prose.

- [Wikidata](https://www.wikidata.org/), CC0 1.0 public-domain dedication, via the
  Wikidata Query Service (`query.wikidata.org`, SPARQL), queried November 2026: entity labels,
  aliases, class/occupation/taxon membership and `wikibase:sitelinks` counts. Derived
  snapshots are committed as `scripts/dive/wikidata/<id>.tsv` (`qid`, sitelinks, English
  label, aliases); raw responses stay in the ignored `.cache/wikidata/`.

These are independently sourced name lists, not a copy of another game's content or
tiers. Keep source/license attribution with redistributions of the generated data.

## Outputs and runtime

- `worker/src/games/dive/prompts.ts`: small ID/text catalog, no accepted answers.
- `worker/src/games/dive/data/<id>.ts`: sorted `normalized-key\tbase36-offset\n`
  normalized-length bucket strings, a shared `code\tcanonical\n` table, and
  constant Pearl/notable/size metadata. Offsets are UTF-16 code units, not UTF-8 bytes.
  Each canonical/alias key is stored exactly once, in its length bucket. Exact lookup
  searches that same bucket; there is no duplicate global index. Aliases point to the
  same canonical name/code.
  Codes `s,t,m,r,d,g` mean Surface, Too Clever, Midwater, Rare, Deep Cut, Pearl.
  Never import these from web code.
- `loaders.ts`: lazy per-prompt imports; `sets.ts`: direct module data, no parsed LRU.
  No request splits/parses a set or builds Maps. Exact lookup is native delimiter search;
  fuzzy lookup only scans the relevant bucket strings, uses a reusable submit-local DP
  workspace, trims common prefixes/suffixes and exits outside the allowed edit band.
- `report.json`: review summary, no raw caches.

## Checks and measurements

```sh
source ~/.nvm/nvm.sh
npx vitest run scripts/dive/data.test.ts shared/games/dive.test.ts
npm test -w worker -- src/dive.test.ts src/games.test.ts
node_modules/.bin/esbuild scripts/dive/measure-entry.ts --bundle --platform=node --format=esm --outfile="$HOME/work/dive-cpu-worker.mjs"
node scripts/dive/measure.mjs "$HOME/work/dive-cpu-worker.mjs"
npm run build
node scripts/dive/check-web.mjs
```

Measurements use 20 fresh Node processes per case, with no set/module cache or matcher
warm-up. The shared matcher/registry is loaded like the Worker request handler; timing
starts before the first lazy data-module initialization and includes lookup. The bundle
uses esbuild's monolithic Worker-style lazy module initializers, not Node-only split-file
filesystem imports. Both process CPU
and wall time are reported, separately from process bootstrap. Cases are exact, real alias,
fuzzy hit and the ten worst sampled fuzzy misses on the largest set. Miss candidates
include shared-prefix mutations, not just instant-rejection random strings.
This is not a proof of a theoretical worst-case bound or a production workerd CPU profile.
The Worker test logs seven-request end-to-end HTTP/storage/reveal wall time separately.
`npm run build` prints Wrangler's uncompressed/gzip Worker upload sizes; the web checker
asserts five distinctive Pearl strings are absent from every built JS/CSS/map asset.
