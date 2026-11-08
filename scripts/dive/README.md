# Dive answer data

Build-time only. No fetch, Python, word-frequency lookup or external service runs in
the Worker or browser. The curated sets are **not exhaustive dictionaries of valid
answers**. Maintain them when players find omissions; never award points from a crowd.

## Regenerate

From the repository root, with Node 24+ and npm dependencies installed:

```sh
source ~/.nvm/nvm.sh
python3 -m venv ~/work/dive-venv
~/work/dive-venv/bin/pip install -r scripts/dive/requirements.txt
~/work/dive-venv/bin/python scripts/dive/generate.py
~/work/dive-venv/bin/python scripts/dive/generate.py --check
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

The generator calls `wordfreq.zipf_frequency(name, 'en')` on the **whole name**, including
multiword names. Each prompt is ranked independently, highest familiarity first, lexical
normalized-key tiebreak. Rank fractions are Surface `<20%`, Midwater `<55%`, Rare `<80%`,
Deep Cut otherwise. Then overrides apply. Too Clever and Pearl are **only** explicit
overrides, never automatic low-frequency picks. Hand anchors ensure dog, cat, France,
apple and other obvious answers score Surface. The single Pearl is a recognizable fun
pick, not necessarily the rarest name. Points: 10 / 15 / 30 / 60 / 85 / 100; miss 0.

## Coverage and review

120 distinct general-knowledge prompts, 62,560 canonical answers. 105 sets have at least
100 answers; 74 have at least 200. Range 50–7,907. Some naturally bounded categories
(states, constellations, instruments) are smaller. The report lists every set's size,
tier counts, five familiar Surface examples, Too Clever picks and Pearl.

We stopped at 120 reviewed topics rather than stretch to 420 by slicing alphabet letters,
inventing subjective sets or adding obscure technical/medical lists. Thirty-six prompts
ask for towns/cities in different countries; the remaining 84 span nature, food, science,
arts, geography, games, materials and general culture. Expansion needs another reviewed,
distinct source and its own anchors/aliases/Pearl. No rowing, Stanford, team or Krillion
prompts/content are used. Sources span eras and are intentionally not advertised as
current rankings (e.g. company and movie lists). Major commercial movies after the movie
source's era will need additions. Broad source lists still benefit from future editorial
review; corrections must go into the manifest, not generated modules.

Hand-checked examples (Zipf ordering within Surface, not a claim about crowd popularity):

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

These are independently sourced name lists, not a copy of another game's content or
tiers. Keep source/license attribution with redistributions of the generated data.

## Outputs and runtime

- `worker/src/games/dive/prompts.ts`: small ID/text catalog, no accepted answers.
- `worker/src/games/dive/data/<id>.ts`: encoded `canonical|code|alias;alias` rows, in
  familiarity order. Codes `s,t,m,r,d,g` mean Surface, Too Clever, Midwater, Rare, Deep Cut,
  Pearl. Never import these from web code.
- `loaders.ts`: lazy per-prompt imports; `sets.ts`: eight-entry promise-aware parsed LRU.
  Bundling includes strings but neither initializes every data module nor parses all sets
  at Worker startup. A submit parses only its current prompt. Reloading caller answers
  parses at most their answered prompts, not future prompts.
- `report.json`: review summary, no raw caches.

## Checks and measurements

```sh
source ~/.nvm/nvm.sh
npx vitest run scripts/dive/data.test.ts shared/games/dive.test.ts
npm test -w worker -- src/dive.test.ts src/games.test.ts
node_modules/.bin/esbuild scripts/dive/measure-entry.ts --bundle --platform=node --format=esm --outfile="$HOME/work/dive-data.mjs"
node scripts/dive/measure.mjs "$HOME/work/dive-data.mjs"
npm run build
node scripts/dive/check-web.mjs
```

Measurements use a fresh Node process and the same esbuild lazy-module pattern as the
Worker bundle. Cold registry import and largest-module import are separate from parsed
set cost. Exact and worst **sampled** fuzzy miss timing report mean/p95 on the largest set;
miss candidates include shared-prefix mutations, not just instant-rejection random strings.
This is not a proof of a theoretical worst-case bound or a production workerd CPU profile.
The Worker test logs seven-request end-to-end HTTP/storage/reveal wall time separately.
`npm run build` prints Wrangler's uncompressed/gzip Worker upload sizes; the web checker
asserts five distinctive Pearl strings are absent from every built JS/CSS/map asset.
