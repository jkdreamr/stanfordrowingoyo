# S2 science and nature: pre-edit recall audit

All 40 requested IDs; 1,201 fresh raw guesses, at least 26 per prompt. Raw guesses were frozen before reading answer/alias data or evaluating them. Selected preserves every raw submission in order. Strings are reviewed-valid; objects are reviewed-invalid with reasons. The audit includes explicit classifications and reasons for every guess. No constrained data or historical corpus changes.

This is a conservative _plausible valid guess_ audit, not independently source-verified membership. Ambiguous broad terms (royal albatross, rorqual, cloud height classes, generic gorilla/orangutan), subspecies (grizzly, gorilla subspecies), conditionally essential amino acids, candidate dwarf planets (Sedna/Orcus/Quaoar/Gonggong), historical seal species, and mineral varieties remain valid under potentially inclusive readings of the short prompt. Do not automatically add all misses as aliases: these need scope/source review in the next step. Symbols are case-sensitive scientifically but the unchanged game normalizer is not; metrics deliberately use its exact keys. Scientific names, satellite Roman numerals, unit symbols and recognizable short names remain valid guesses. Invalidity was not inferred from a lookup miss.

The stock CLI evaluates only the active schedule. An explicit call to its exported `evaluateCorpus` with `schedule: [all40Ids]` supplies the requested 40-ID comparison without editing evaluator or schedule. Every requested ID had a runtime data module and frozen baseline observations. All percentages are exact normalized-key recall, not fuzzy runtime acceptance. No answer data were changed: before/after comparison is not applicable yet; `before` means the new shard corpus against current data, and `baseline` means the historical corpus against the same data.

## Recall and all misses

| Prompt                    | Baseline % | Shard % |
| ------------------------- | ---------: | ------: |
| actinides                 |     100.00 |   50.00 |
| albatrosses               |      91.67 |   96.30 |
| baleen-whales             |     100.00 |   80.77 |
| bears                     |      86.67 |   64.00 |
| beaufort-winds            |      82.35 |   48.28 |
| carpal-bones              |      88.89 |   29.63 |
| cat-family                |      93.33 |   96.77 |
| cloud-genera              |     100.00 |   31.25 |
| cranes                    |      88.89 |   76.92 |
| cranial-nerves            |      46.15 |    6.67 |
| crocodilians              |      85.71 |   84.62 |
| dog-family                |      89.29 |   88.89 |
| elements-named-people     |     100.00 |  100.00 |
| elements-named-places     |     100.00 |  100.00 |
| essential-amino-acids     |     100.00 |   30.00 |
| gaseous-elements          |     100.00 |   40.74 |
| great-apes                |      76.92 |   46.15 |
| human-vitamins            |     100.00 |  100.00 |
| iau-constellations        |      93.75 |   90.63 |
| large-saturn-moons        |     100.00 |   47.83 |
| mohs-minerals             |     100.00 |   53.85 |
| named-neptune-moons       |     100.00 |   50.00 |
| named-uranus-moons        |     100.00 |   93.10 |
| nobel-chemistry           |      97.22 |   93.10 |
| nobel-physics             |      94.29 |   93.10 |
| one-letter-symbols        |      48.28 |   48.28 |
| otters                    |      77.78 |   61.54 |
| pelicans                  |      88.89 |   53.85 |
| penguins                  |      92.86 |   85.19 |
| planets-dwarf             |     100.00 |   58.33 |
| proteinogenic-amino-acids |      91.67 |   47.83 |
| rare-earth-elements       |     100.00 |   50.00 |
| retired-hurricanes        |     100.00 |   93.10 |
| si-named-derived-units    |      95.65 |   51.16 |
| si-prefixes               |      96.00 |   75.00 |
| skull-bones               |      56.00 |   46.15 |
| storks                    |      95.24 |   83.33 |
| symbol-mismatch           |     100.00 |   33.33 |
| transuranium-elements     |     100.00 |   83.33 |
| true-seal-species         |      95.45 |   81.48 |

### actinides

- Baseline misses: none.
- Shard misses: Ac; Th; Pa; U; Np; Pu; Am; Cm; Bk; Cf; Es; Fm; Md; No; Lr.

### albatrosses

- Baseline misses: snowy albatross; gray headed albatross.
- Shard misses: yellow nosed albatross.

### baleen-whales

- Baseline misses: none.
- Shard misses: finback; rorqual; right whale; Balaenoptera musculus; Megaptera novaeangliae.

### bears

- Baseline misses: black bear; Asiatic black bear.
- Shard misses: black bear; tibetan blue bear; eurasian brown bear; ursus arctos; ursus maritimus; Ursus americanus; Asiatic black bear; malayan sun bear; honey bear.

### beaufort-winds

- Baseline misses: moderate gale; fresh gale; whole gale.
- Shard misses: force 0; force 1; force 2; force 3; force 4; force 5; force 6; force 7; force 8; force 9; force 10; force 11; force 12; high wind; whole gale.

### carpal-bones

- Baseline misses: triquetral.
- Shard misses: scaphoid bone; lunate bone; triquetral bone; pisiform bone; trapezium bone; trapezoid bone; capitate bone; hamate bone; navicular; greater multangular; lesser multangular; os scaphoideum; os lunatum; os triquetrum; os pisiforme; os trapezium; os trapezoideum; os capitatum; os hamatum.

### cat-family

- Baseline misses: lynx; Pallas cat.
- Shard misses: wildcat.

### cloud-genera

- Baseline misses: none.
- Shard misses: nimbus; cumulus clouds; cirrus cloud; stratus clouds; cumulonimbus cloud; anvil cloud; thundercloud; rain cloud; high clouds; middle clouds; low clouds; mackerel sky; Cu; Cb; Ci; Cs; Cc; As; Ac; Ns; Sc; St.

### cranes

- Baseline misses: Eurasian crane; Japanese crane.
- Shard misses: eurasian crane; japanese crane; manchurian crane; african crowned crane; Grus grus; Antigone canadensis.

### cranial-nerves

- Baseline misses: olfactory; optic; oculomotor; trochlear; trigeminal; abducens; facial; vestibulocochlear; auditory nerve; glossopharyngeal; vagus; accessory; spinal accessory; hypoglossal.
- Shard misses: olfactory; optic; oculomotor; trochlear; trigeminal; abducens; facial; vestibulocochlear; glossopharyngeal; vagus; accessory; hypoglossal; auditory nerve; acoustic nerve; spinal accessory nerve; CN I; CN II; CN III; CN IV; CN V; CN VI; CN VII; CN VIII; CN IX; CN X; CN XI; CN XII; eighth cranial nerve.

### crocodilians

- Baseline misses: saltie; marsh crocodile; Australian freshwater crocodile; slender snouted crocodile.
- Shard misses: slender snouted crocodile; indian gharial; tomistoma; salties.

### dog-family

- Baseline misses: red wolf; domestic dog; dingo.
- Shard misses: red wolf; domestic dog; dingo.

### elements-named-people

- Baseline misses: none.
- Shard misses: none.

### elements-named-places

- Baseline misses: none.
- Shard misses: none.

### essential-amino-acids

- Baseline misses: none.
- Shard misses: His; Ile; Leu; Lys; Met; Phe; Thr; Trp; Val; H; I; L; K; M; F; T; W; V; arginine; cysteine; tyrosine.

### gaseous-elements

- Baseline misses: none.
- Shard misses: H; He; N; O; F; Ne; Cl; Ar; Kr; Xe; Rn; H2; N2; O2; F2; Cl2.

### great-apes

- Baseline misses: common chimpanzee; chimp; pygmy chimpanzee.
- Shard misses: common chimpanzee; pygmy chimpanzee; mountain gorilla; western lowland gorilla; eastern lowland gorilla; cross river gorilla; orang-utan; Pan troglodytes; Pan paniscus; Gorilla gorilla; Gorilla beringei; Pongo pygmaeus; Pongo abelii; Pongo tapanuliensis.

### human-vitamins

- Baseline misses: none.
- Shard misses: none.

### iau-constellations

- Baseline misses: Scorpio; Capricorn.
- Shard misses: the hunter; Scorpio; Capricorn.

### large-saturn-moons

- Baseline misses: none.
- Shard misses: Prometheus; Pandora; Titan moon; Saturn VI; Saturn II; Saturn I; Saturn III; Saturn IV; Saturn V; Saturn VII; Saturn VIII; Saturn IX.

### mohs-minerals

- Baseline misses: none.
- Shard misses: fluorspar; calcium carbonate; calcium sulfate; silica; ruby; sapphire; amethyst; rock crystal; quartz crystal; talcum; talcum powder; apatite mineral.

### named-neptune-moons

- Baseline misses: none.
- Shard misses: Neptune I; Neptune II; Neptune III; Neptune IV; Neptune V; Neptune VI; Neptune VII; Neptune VIII; Neptune IX; Neptune X; Neptune XI; Neptune XII; Neptune XIII; Neptune XIV.

### named-uranus-moons

- Baseline misses: none.
- Shard misses: Uranus I; Uranus II.

### nobel-chemistry

- Baseline misses: John Jumper.
- Shard misses: John Goodenough; John Jumper.

### nobel-physics

- Baseline misses: Curie; Bohr.
- Shard misses: Curie; Bohr.

### one-letter-symbols

- Baseline misses: sulphur; H; B; C; N; O; F; P; S; K; V; Y; I; W; U.
- Shard misses: H; B; C; N; O; F; P; S; K; V; Y; I; W; U; sulphur.

### otters

- Baseline misses: European otter; river otter; Cape clawless otter; sea cat.
- Shard misses: european otter; Lutra lutra; Enhydra lutris; Pteronura brasiliensis; Lontra canadensis; oriental small clawed otter; cape clawless otter; river otter; giant river otter; european river otter.

### pelicans

- Baseline misses: white pelican.
- Shard misses: white pelican; eastern white pelican; rosy pelican; grey pelican; Pelecanus onocrotalus; Pelecanus erythrorhynchos; Pelecanus occidentalis; Pelecanus thagus; Pelecanus conspicillatus; Pelecanus rufescens; Pelecanus crispus; Pelecanus philippensis.

### penguins

- Baseline misses: fairy penguin; jackass penguin.
- Shard misses: fairy penguin; jackass penguin; rockhopper penguin; hoiho.

### planets-dwarf

- Baseline misses: none.
- Shard misses: Terra; Sedna; Orcus; Quaoar; Gonggong; 2003 UB313; Xena; 134340 Pluto; 1 Ceres; 136199 Eris.

### proteinogenic-amino-acids

- Baseline misses: aspartate; glutamate.
- Shard misses: aspartate; glutamate; Ala; Arg; Asn; Asp; Cys; Gln; Glu; Gly; His; Ile; Leu; Lys; Met; Phe; Pro; Ser; Thr; Trp; Tyr; Val; Sec; Pyl.

### rare-earth-elements

- Baseline misses: none.
- Shard misses: Sc; Y; La; Ce; Pr; Nd; Pm; Sm; Eu; Gd; Tb; Dy; Ho; Er; Tm; Yb; Lu.

### retired-hurricanes

- Baseline misses: none.
- Shard misses: Hurricane Katrina; hurricane andrew.

### si-named-derived-units

- Baseline misses: Celsius.
- Shard misses: N; J; W; Pa; Hz; C; V; F; Ω; S; Wb; T; H; lm; lx; Bq; Gy; Sv; kat; rad; sr.

### si-prefixes

- Baseline misses: deka.
- Shard misses: deka; k; M; G; m; µ; u; n.

### skull-bones

- Baseline misses: frontal; parietal; temporal; occipital; sphenoid; ethmoid; zygomatic; nasal; lacrimal; palatine; inferior nasal conchae.
- Shard misses: frontal; parietal; temporal; occipital; sphenoid; ethmoid; zygomatic; nasal; lacrimal; palatine; lower jaw; upper jaw; cheekbone; inferior nasal turbinate.

### storks

- Baseline misses: woolly necked stork.
- Shard misses: woolly necked stork; Ciconia ciconia; Ciconia nigra; saddlebill.

### symbol-mismatch

- Baseline misses: none.
- Shard misses: Na; K; Fe; Ag; Sn; Sb; W; Au; Hg; Pb; natrium; kalium; ferrum; argentum; stannum; stibium; wolfram; aurum; hydrargyrum; plumbum.

### transuranium-elements

- Baseline misses: none.
- Shard misses: Np; Pu; Am; Cm; Og.

### true-seal-species

- Baseline misses: Caribbean monk seal.
- Shard misses: caribbean monk seal; monk seal; elephant seal; Phoca vitulina; Halichoerus grypus.

## Commands

Run from the repository root:

```sh
source ~/.nvm/nvm.sh
python3 -m venv ~/work/dive-venv
~/work/dive-venv/bin/pip install -r scripts/dive/requirements.txt
npx prettier --write scripts/dive/recall/shard-S2-raw.json scripts/dive/recall/shard-S2-selected.json
node scripts/dive/recall.mjs --report /home/ubuntu/work/shard-S2-baseline-scheduled.json > /home/ubuntu/work/shard-S2-baseline-scheduled.log
node scripts/dive/recall.mjs --corpus scripts/dive/recall/shard-S2-selected.json --report /home/ubuntu/work/shard-S2-scheduled.json > /home/ubuntu/work/shard-S2-scheduled.log
node /home/ubuntu/work/shard-S2-measure.mjs > /home/ubuntu/work/shard-S2-all-results.log
node --test scripts/dive/recall.test.mjs
npx prettier --write scripts/dive/recall/shard-S2-audit.json scripts/dive/recall/shard-S2-review.md
```

The stock shard report was refreshed after the final validity review. Use the 40-ID audit for the requested scope rather than the scheduled-only summaries. The persistent measurement driver is `/home/ubuntu/work/shard-S2-measure.mjs`.

No UI changes or visual verification. No commit.

## Step 2 — first 20 fixes

Added **3 canonical answers and 267 aliases**, touching 17 of the allowed 20 blocks only. Human vitamins and the two element-names prompts already had 100% on both corpora and were left unchanged. All 20 now have **100% exact recall on both corpora**, with no remaining reviewed-valid misses. No raw guesses were changed. The 35 prior invalids were rechecked and retained; 12 additional submissions were excluded for substantive membership/scope reasons below. The frozen baseline corpus was not changed.

The table uses Step 1's original before rates (before the additional invalid review); `reviewed_before` in the JSON audit additionally provides pre-edit results using the exact same newly reviewed denominator as `after`.

| Prompt                | Baseline before → after | Shard before → after |
| --------------------- | ----------------------: | -------------------: |
| actinides             |       100.00% → 100.00% |     50.00% → 100.00% |
| albatrosses           |        91.67% → 100.00% |     96.30% → 100.00% |
| baleen-whales         |       100.00% → 100.00% |     80.77% → 100.00% |
| bears                 |        86.67% → 100.00% |     64.00% → 100.00% |
| beaufort-winds        |        82.35% → 100.00% |     48.28% → 100.00% |
| carpal-bones          |        88.89% → 100.00% |     29.63% → 100.00% |
| cat-family            |        93.33% → 100.00% |     96.77% → 100.00% |
| cloud-genera          |       100.00% → 100.00% |     31.25% → 100.00% |
| cranes                |        88.89% → 100.00% |     76.92% → 100.00% |
| cranial-nerves        |        46.15% → 100.00% |      6.67% → 100.00% |
| crocodilians          |        85.71% → 100.00% |     84.62% → 100.00% |
| dog-family            |        89.29% → 100.00% |     88.89% → 100.00% |
| elements-named-people |       100.00% → 100.00% |    100.00% → 100.00% |
| elements-named-places |       100.00% → 100.00% |    100.00% → 100.00% |
| essential-amino-acids |       100.00% → 100.00% |     30.00% → 100.00% |
| gaseous-elements      |       100.00% → 100.00% |     40.74% → 100.00% |
| great-apes            |        76.92% → 100.00% |     46.15% → 100.00% |
| human-vitamins        |       100.00% → 100.00% |    100.00% → 100.00% |
| iau-constellations    |        93.75% → 100.00% |     90.63% → 100.00% |
| large-saturn-moons    |       100.00% → 100.00% |     47.83% → 100.00% |

### New invalid reviews

- **baleen-whales: rorqual** — A family-level group containing multiple baleen whale species, not a species.
- **baleen-whales: right whale** — A common name for multiple Eubalaena species, not an individual species.
- **cloud-genera: nimbus** — Historical generic rain-cloud label, not one of the ten modern cloud genera.
- **cloud-genera: rain cloud** — Generic precipitation-bearing cloud; can be nimbostratus or cumulonimbus, not a genus.
- **cloud-genera: high clouds** — An altitude class containing cirrus, cirrostratus and cirrocumulus, not a genus.
- **cloud-genera: middle clouds** — An altitude class containing multiple genera, not a genus.
- **cloud-genera: low clouds** — An altitude class containing multiple genera, not a genus.
- **cloud-genera: mackerel sky** — A sky pattern formed by altocumulus or cirrocumulus; does not specify one genus.
- **cranes: african crowned crane** — A group name covering black crowned and grey crowned cranes, not an individual species.
- **essential-amino-acids: arginine** — Conditionally essential, not one of the nine unconditional adult dietary essentials in the pinned list.
- **essential-amino-acids: cysteine** — Conditionally essential, not one of the nine unconditional adult dietary essentials in the pinned list.
- **essential-amino-acids: tyrosine** — Conditionally essential, not one of the nine unconditional adult dietary essentials in the pinned list.

### Membership and source decisions

- **Red wolf:** added as a distinct living canid, not silently mapped to gray wolf. Its taxonomy is disputed; its own source documents USFWS recognition. Added pinned Red wolf revision 1384091642 and one-member reviewed snapshot; canid count 37 → 38.
- **Prometheus and Pandora:** added because their longest axes are 137 km and 103 km, respectively. Literal “over 100 kilometres across” includes both even though mean diameter does not. Added their pinned sources (1381961719 / 1377883382), one-member snapshots, and clarified acceptance notes; moon count 11 → 13. The existing original-source snapshot remains unchanged.
- **Aliases:** no source membership/count changes for aliases. Per-source review notes explain accepted forms. Scientific binomials, CN designations, element/amino-acid symbols, cloud abbreviations, Latin bone names and Saturn designations map to their existing canonical members. Familiar subspecies names map to parent species as the existing bear policy already does.
- **Pinned supplementary references:** Snowy albatross 1379042248; Atlantic yellow-nosed albatross 1354731517; Scaphoid bone 1369788418; Trapezium (bone) 1373211955; Trapezoid bone 1373211899. Main pinned lists and reliable current article references were reviewed; this was not a full `--verify-sources` refresh of every existing source.

### Flagged

- **essential-amino-acids:** the terse prompt omits “adult human/unconditionally essential”. The pinned nine-member adult list distinguishes conditionally essential arginine, cysteine and tyrosine; users could reasonably interpret the current wording more broadly. Recommend clarifying the player-facing question in the editorial pass; no text change here.
- **cloud-genera:** “main type of cloud” is less specific than the actual ten-genus constraint. Recommend explicitly asking for a cloud genus; otherwise cloud height classes and rain-cloud labels are understandable guesses even though not genera.
- **large-saturn-moons:** “across” versus mean diameter materially changes membership for elongated satellites. This pass accepts maximum measured span; consider explicitly stating the intended dimension in the question.
- **dog-family:** taxonomic disagreements (notably red wolf and dingo) make a single list brittle. Red wolf is now included conservatively; familiar dingo maps to Dog. Consider a less taxonomy-dependent formulation if editorially useful.
- **cat-family / great-apes / albatrosses / baleen-whales / cranes:** species-level wording still invites broad group names. Existing familiar shorthand is retained where it identifies a conventional species (lynx, wildcat, royal/yellow-nosed albatross), but multi-species groups rorqual/right whale/African crowned crane are excluded. A taxonomy-focused wording is precise but may be less approachable.
- **actinides / gaseous-elements / human-vitamins / elements-named-people / elements-named-places:** complete reference-list trivia rather than especially distinctive questions; suitable for a later interest/specificity rewrite, not deletions in this pass.

### Measurements and checks

```text
Before: Total Upload: 7837.36 KiB / gzip: 2946.24 KiB
After:  Total Upload: 7841.90 KiB / gzip: 2947.76 KiB
Delta: +1.52 KiB (2.48 KiB remains of the whole-shard 4 KiB budget)

Ran 18 tests in 9.067s
OK

Test Files  2 passed (2)
Tests  66 passed (66)

ℹ tests 10
ℹ pass 10
ℹ fail 0
```

Commands (repository root; Node loaded with `source ~/.nvm/nvm.sh`):

```sh
npm run build > /home/ubuntu/work/shard-S2-build-before.log 2>&1
~/work/dive-venv/bin/python scripts/dive/generate.py > /home/ubuntu/work/shard-S2-generate.log 2>&1
~/work/dive-venv/bin/python -m unittest discover -s scripts/dive -p 'test_constrained.py'
node /home/ubuntu/work/shard-S2-measure.mjs > /home/ubuntu/work/shard-S2-step2-results.log
npm run build > /home/ubuntu/work/shard-S2-build-after.log 2>&1
npx vitest run scripts/dive/data.test.ts shared/games/dive.test.ts > /home/ubuntu/work/shard-S2-data-tests.log 2>&1
node --test scripts/dive/recall.test.mjs > /home/ubuntu/work/shard-S2-recall-tests.log 2>&1
```

Generated data, catalog and report changes were explicitly restored using `git checkout --` on only their changed paths after measuring; measurements above describe the temporarily regenerated data, not the restored modules. `/home/ubuntu/work/shard-S2-step2-measurement.json` preserves that after snapshot. Rerunning the driver after restoration provided the same-denominator reviewed-before measurement. No commit, no UI changes, no visual verification.

## Step 3 / final all-40 results

The original Step 1 results above are historical. The final comparison below uses the original before values (including guesses subsequently reviewed invalid), unchanged frozen baseline, and the final selected-corpus denominator. Invalid classification is not evidence that the matcher accepted anything.

**Totals:** 4 canonical additions (Red wolf, Prometheus, Pandora, Caribbean monk seal), 1 canonical removal (Copper), net +3; **498 explicit aliases** (267 first20 + 231 remaining20). No new alias duplicates its row's normalized name/aliases. Existing picks, prompt text, bases and non-S2 prompt bytes are unchanged.

| Prompt                    | Baseline % before → after | Shard % before → after |
| ------------------------- | ------------------------: | ---------------------: |
| actinides                 |           100.00 → 100.00 |         50.00 → 100.00 |
| albatrosses               |            91.67 → 100.00 |         96.30 → 100.00 |
| baleen-whales             |           100.00 → 100.00 |         80.77 → 100.00 |
| bears                     |            86.67 → 100.00 |         64.00 → 100.00 |
| beaufort-winds            |            82.35 → 100.00 |         48.28 → 100.00 |
| carpal-bones              |            88.89 → 100.00 |         29.63 → 100.00 |
| cat-family                |            93.33 → 100.00 |         96.77 → 100.00 |
| cloud-genera              |           100.00 → 100.00 |         31.25 → 100.00 |
| cranes                    |            88.89 → 100.00 |         76.92 → 100.00 |
| cranial-nerves            |            46.15 → 100.00 |          6.67 → 100.00 |
| crocodilians              |            85.71 → 100.00 |         84.62 → 100.00 |
| dog-family                |            89.29 → 100.00 |         88.89 → 100.00 |
| elements-named-people     |           100.00 → 100.00 |        100.00 → 100.00 |
| elements-named-places     |           100.00 → 100.00 |        100.00 → 100.00 |
| essential-amino-acids     |           100.00 → 100.00 |         30.00 → 100.00 |
| gaseous-elements          |           100.00 → 100.00 |         40.74 → 100.00 |
| great-apes                |            76.92 → 100.00 |         46.15 → 100.00 |
| human-vitamins            |           100.00 → 100.00 |        100.00 → 100.00 |
| iau-constellations        |            93.75 → 100.00 |         90.63 → 100.00 |
| large-saturn-moons        |           100.00 → 100.00 |         47.83 → 100.00 |
| mohs-minerals             |           100.00 → 100.00 |         53.85 → 100.00 |
| named-neptune-moons       |           100.00 → 100.00 |         50.00 → 100.00 |
| named-uranus-moons        |           100.00 → 100.00 |         93.10 → 100.00 |
| nobel-chemistry           |            97.22 → 100.00 |         93.10 → 100.00 |
| nobel-physics             |             94.29 → 94.29 |          93.10 → 93.10 |
| one-letter-symbols        |            48.28 → 100.00 |         48.28 → 100.00 |
| otters                    |            77.78 → 100.00 |         61.54 → 100.00 |
| pelicans                  |            88.89 → 100.00 |         53.85 → 100.00 |
| penguins                  |            92.86 → 100.00 |         85.19 → 100.00 |
| planets-dwarf             |           100.00 → 100.00 |         58.33 → 100.00 |
| proteinogenic-amino-acids |            91.67 → 100.00 |         47.83 → 100.00 |
| rare-earth-elements       |           100.00 → 100.00 |         50.00 → 100.00 |
| retired-hurricanes        |           100.00 → 100.00 |         93.10 → 100.00 |
| si-named-derived-units    |            95.65 → 100.00 |          51.16 → 97.67 |
| si-prefixes               |            96.00 → 100.00 |          75.00 → 96.88 |
| skull-bones               |            56.00 → 100.00 |         46.15 → 100.00 |
| storks                    |            95.24 → 100.00 |         83.33 → 100.00 |
| symbol-mismatch           |            100.00 → 90.91 |          33.33 → 96.67 |
| transuranium-elements     |           100.00 → 100.00 |         83.33 → 100.00 |
| true-seal-species         |            95.45 → 100.00 |         81.48 → 100.00 |

Micro-average: baseline **768/848 (90.57%) → 845/848 (99.65%)**; shard **769/1166 (65.95%) → 1135/1140 (99.56%)**. Final selected corpus: **61 invalid**, comprising the original 35 plus 12 Step 2 and 14 Step 3 decisions. Baseline's existing 2 invalid entries are unchanged. Frozen raw corpus remains 1,201 guesses.

### Newly invalidated in Step 3

- **mohs-minerals: calcium carbonate** — A compound shared by calcite, aragonite and vaterite, not an unambiguous name of the reference mineral calcite.
- **mohs-minerals: calcium sulfate** — Does not specify gypsum (hydrated calcium sulfate); also identifies anhydrite.
- **mohs-minerals: silica** — Composition shared by quartz and other polymorphs, not uniquely the reference mineral quartz.
- **mohs-minerals: ruby** — A gemstone variety of corundum, not a named member of the ten reference-mineral list.
- **mohs-minerals: sapphire** — A gemstone variety of corundum, not a named member of the ten reference-mineral list.
- **mohs-minerals: amethyst** — A gemstone variety of quartz, not a named member of the ten reference-mineral list.
- **mohs-minerals: rock crystal** — A colorless quartz variety, not a named member of the ten reference-mineral list.
- **mohs-minerals: talcum powder** — A manufactured powder that may contain additives or cornstarch, not the mineral talc itself.
- **planets-dwarf: Sedna** — A proposed dwarf planet, not one of the five IAU-recognised dwarf planets in the pinned scope.
- **planets-dwarf: Orcus** — A proposed dwarf planet, not one of the five IAU-recognised dwarf planets in the pinned scope.
- **planets-dwarf: Quaoar** — A proposed dwarf planet, not one of the five IAU-recognised dwarf planets in the pinned scope.
- **planets-dwarf: Gonggong** — A proposed dwarf planet, not one of the five IAU-recognised dwarf planets in the pinned scope.
- **true-seal-species: monk seal** — A group covering multiple species, not an individual species of true seal.
- **true-seal-species: elephant seal** — A group covering northern and southern elephant seals, not an individual species.

The previous 47 invalid decisions were rechecked and retained. These exclusions follow reference-member/species scope, not whether a guess missed the bank. The ambiguous but valid Nobel surnames and unsupported symbol inputs below remain valid.

### Membership and source decisions

- **One-letter symbols:** all 14 symbols now work, as do canonical element names and Sulphur. Baseline and shard both improve 48.28% → 100%. Direct runtime checks returned Hydrogen for H/hydrogen, Vanadium for V/vanadium, and misses for empty/skip.
- **Planets/dwarfs:** retained the pinned 13 (eight planets plus Ceres, Pluto, Haumea, Makemake and Eris); added Terra, minor-planet number forms and the Eris discovery designation/nickname. No candidate dwarf planets added.
- **True seals:** added Caribbean monk seal because it is explicitly named by the existing pinned taxonomy and the displayed wording does not restrict answers to living species. Source reviewed/members/expect and canonical count all change 18 → 19; the existing pin was checked with `acquire()`. Broad monk/elephant seal groups remain excluded.
- **Symbol mismatch:** removed Copper from canonical and source memberships, count 11 → 10; Copper/Cu start with the same letter. The existing pin was checked with `acquire()`. The frozen baseline's copper stays unchanged and necessarily misses. Na is a reserved matcher stopword: its attempted alias failed the runtime data tests and was removed rather than changing the matcher or claiming it works. Natrium/Sodium work.
- Compact reviewed aliases cover Roman numeral satellite designations, amino-acid codes, rare-earth/transuranium symbols, unit symbols, common/binomial species names, skull-bone names, mineral synonyms, hurricane prefixes and Nobel middle-initial omissions. This was not a full remote refresh of every existing source.

### Flagged

The Step 2 flags above remain. Additional final editorial/runtime limitations:

- **nobel-physics:** Curie means Marie or Pierre; Bohr means Niels or Aage. All four are actual laureates in this prompt. The pipeline intentionally generates only unique surnames (`constrained.py:read_specs`); assigning an ambiguous surname to one person silently is wrong. Both corpora keep these valid-but-ambiguous guesses as misses: baseline 94.29%, shard 93.10%. A matcher/product decision outside this data-only scope is required to accept multi-owner answers. This remains below the 95% target.
- **symbol-mismatch:** the frozen baseline's incorrect copper creates 90.91% baseline recall despite the corrected production list; shard is 96.67%, with only valid Na blocked by the unchanged stopword rule.
- **si-prefixes / si-named-derived-units:** valid µ and Ω normalize to empty and cannot be fixed with aliases. Case-folding merges M/m; the stored m key maps to milli, including capital M. Degree Celsius's °C collides with C for coulomb; the Celsius word form works. Direct runtime checks verified M/m → milli, µ/Ω → miss, u → micro, ohm → ohm. Do not mistake high exact-key recall for case-sensitive scientific-symbol fidelity.
- **true-seal-species:** wording should explicitly choose living/recent species versus all fossil species. The pinned recent taxonomy supports Caribbean monk seal; claiming completeness across every prehistoric species would be unjustified.
- **mohs-minerals:** explicitly ask for one of the ten reference minerals; current “on the scale” wording invites gemstone varieties and other minerals whose hardness can be measured. The pinned source scope here is the ten references.
- **named-neptune-moons / named-uranus-moons / retired-hurricanes:** changing named/retired lists need a stated snapshot date; generic list-recall prompts remain relatively plain.
- **planets-dwarf:** the IAU-recognised boundary is important; candidate dwarf planets are excluded, not overlooked.
- **otters / pelicans / penguins / storks:** traditional common-name/taxonomy boundaries can be ambiguous. Existing familiar shorthand was preserved; editorially state the species convention if more precision is needed.

### Final measurements and checks

```text
Before: Total Upload: 7837.36 KiB / gzip: 2946.24 KiB
After:  Total Upload: 7844.99 KiB / gzip: 2948.91 KiB
Whole-shard delta: +2.67 KiB; 1.33 KiB remains of the 4 KiB limit.
Step 3 delta: +1.15 KiB of its remaining 2.48 KiB allowance.

Ran 28 tests in 9.274s
OK

Test Files  2 passed (2)
Tests  66 passed (66)

ℹ tests 10
ℹ pass 10
ℹ fail 0

overall: 5926/6516 90.95% (320 prompts)
constrained: 5165/5526 93.47% (287 prompts)
broad: 761/990 76.87% (33 prompts)
Missing data: none
Missing metadata: none

All matched files use Prettier code style!
```

The standard recall CLI also reports missing corpus for unrelated newly scheduled IDs; all 40 S2 IDs have baseline/shard observations. All-40 figures above use the explicit measurement schedule, not just the currently active schedule. The final `generate.py --check` printed 617 runtime modules, 606 active + 82 inactive prompts, 147,493 canonicals and 93,767 aliases; generated artifacts are restored after measurement as requested.

Commands from repo root:

```sh
source ~/.nvm/nvm.sh
~/work/dive-venv/bin/python scripts/dive/generate.py
~/work/dive-venv/bin/python scripts/dive/generate.py --check
~/work/dive-venv/bin/python -m unittest discover -s scripts/dive -p 'test_*.py'
node --test scripts/dive/recall.test.mjs
node scripts/dive/recall.mjs
node /home/ubuntu/work/shard-S2-measure.mjs
npx vitest run scripts/dive/data.test.ts shared/games/dive.test.ts
npx prettier --write scripts/dive/recall/shard-S2-{selected,audit}.json scripts/dive/recall/shard-S2-review.md
npm run format:check
npm run build
git checkout -- worker/src/games/dive/ scripts/dive/report.json scripts/dive/recall/report.json data/
```

Environment: the repeated unresolved Inter font warning was diagnosed as a missing declared dependency. `npm install` added one package without tracked changes; final build no longer warns about that font. No deployment, PR, UI edits or visual verification. Final measurements describe temporarily regenerated runtime data, not the restored modules.
