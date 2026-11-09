# Dive S1: geography and words completeness audit

51 existing prompts audited; no prompts added, removed or rescheduled. Only 37 S1 answer blocks changed. Bases, source snapshots, expected counts, Surface/Too Clever/Pearl picks, tooling and tests are unchanged. No deployment or PR.

## Frozen method and recall

`shard-S1-raw.json` was brainstormed from prompt text and general knowledge before opening answer data, then frozen in commit `73e32e3`. The 1,893 original strings and their order remain unchanged in `shard-S1-selected.json`. Only genuinely wrong guesses receive reasoned invalid annotations; missing aliases and debatable geography stay in the denominator. This is one model’s brainstorm, not representative player data or proof of completeness.

Final shard: **1,893 guesses, 128 reviewed-invalid, 1,765 valid**. Australia and Indonesia were temporarily marked invalid during source-scope review, then unmarked as debatable; both are valid misses in the final before/after comparison. Czechoslovakia was explicitly reviewed-invalid after the first measurement and the before report rerun, because it is not a former name of one current country. No guesses were added or replaced after evaluation.

Both sides use the same final denominators. Before data came from regeneration of unmodified constrained specs at `73e32e3`; after data came from the audited working tree. The baseline corpus is unchanged. Recall measures exact normalized keys only, not fuzzy matching. All 51 IDs are scheduled; missing corpus entries elsewhere in the shard-only report are expected.

**S1 baseline:** 1274/1350 (94.37%) → **1344/1350 (99.56%)**. **Shard:** 1507/1765 (85.38%) → **1701/1765 (96.37%)**. **44/51 prompts reach at least 95% on both corpora**; the seven below target are countries-b, countries-m, countries-with-z, states-m-n, states-two-words, states-vowel and greek-letters. Their blockers are explicit below.

**665 alias strings added; 0 canonical rows added.** The audit JSON records SHA-256 hashes of the baseline, raw, selected and pre-edit constrained specs, per-prompt observations and flags. Array observations are `[hits, total]`.

## Alias policy

- Accept former/alternate English names, common short forms and recognizable formal names, not only the brainstorm misses: Orissa/Uttaranchal/Pondicherry, Western Samoa, Burkina/CAR/DRC/PNG/NZ/UAE, Republic of Chad, Kingdom of Lesotho and Kyrgyz Republic style variants.
- Accept common spelling variants and widely used older Chinese romanizations: Surinam, Kirgizstan, Kazakstan, Tadjikistan, Lamda/Lambda, Whisky, X-ray/Xray, Ulan Bator, Naypyidaw, Berne, Abruzzi, Peking, Szechuan, Kwangtung, Fukien, Chekiang and Heilungkiang.
- Accept local/endonym names: German state names, Italian region names, Swiss official-language names, te reo Māori regions, Mexican Spanish forms, EU language endonyms and common country endonyms. Normalization already handles case and many accents/punctuation variants.
- Accept USPS state codes, Canadian postal abbreviations, unambiguous Brazilian codes and common short forms (Mass/Penn/Wisc/Mich/New York State, Washington/Delhi for capitals, Rio/Federal District/Brasilia, Newfoundland/Yukon Territory/Jervis Bay). Derived-base limitations remain flagged rather than bypassed.
- Old part names of merged entities alias to the merged unit: Daman and Diu and Dadra and Nagar Haveli. A component site may identify a World Heritage property, such as Daintree. Former composite states are not arbitrary aliases of their successors.
- Do not choose an owner for ambiguous aliases. Greek glyphs are valid, but cannot be added while the shared Latin-only normalizer erases them. No normalizer or matcher changes were made.

## Per-prompt exact recall

| ID                             | Baseline before → after | Shard before → after | Aliases added |
| ------------------------------ | ----------------------- | -------------------- | ------------: |
| `africa-capitals`              | 36/36 → 36/36           | 44/44 → 44/44        |             7 |
| `africa-countries`             | 39/40 → 40/40           | 45/45 → 45/45        |            16 |
| `africa-landlocked`            | 17/18 → 18/18           | 19/26 → 26/26        |             9 |
| `americas-capitals`            | 38/41 → 41/41           | 40/42 → 42/42        |             9 |
| `ancient-modern-wonders`       | 21/24 → 24/24           | 21/28 → 28/28        |            14 |
| `asia-capitals`                | 36/40 → 40/40           | 39/43 → 43/43        |            24 |
| `asia-countries`               | 39/40 → 40/40           | 44/45 → 45/45        |            31 |
| `australia-states-territories` | 25/25 → 25/25           | 28/29 → 29/29        |             6 |
| `australia-world-heritage`     | 25/36 → 36/36           | 26/38 → 38/38        |            20 |
| `borders-china`                | 16/16 → 16/16           | 21/26 → 26/26        |            14 |
| `borders-france`               | 12/12 → 12/12           | 14/27 → 27/27        |            25 |
| `borders-russia`               | 14/14 → 14/14           | 18/24 → 24/24        |            16 |
| `brazil-states`                | 33/34 → 34/34           | 38/42 → 42/42        |            30 |
| `canada-national-parks`        | 34/35 → 35/35           | 43/44 → 44/44        |            17 |
| `canada-provinces`             | 14/20 → 19/20           | 14/31 → 31/31        |            25 |
| `china-provinces`              | 23/23 → 23/23           | 23/29 → 29/29        |            24 |
| `countries-b`                  | 19/20 → 19/20           | 23/27 → 23/27        |             0 |
| `countries-ia`                 | 39/39 → 39/39           | 40/41 → 40/41        |             0 |
| `countries-m`                  | 19/21 → 19/21           | 20/25 → 20/25        |             0 |
| `countries-no-a`               | 32/32 → 32/32           | 35/35 → 35/35        |             0 |
| `countries-s`                  | 30/30 → 30/30           | 30/31 → 30/31        |             0 |
| `countries-same-letter`        | 16/16 → 16/16           | 29/29 → 29/29        |             0 |
| `countries-vowel`              | 38/39 → 38/39           | 39/40 → 39/40        |             0 |
| `countries-with-z`             | 17/18 → 17/18           | 23/27 → 23/27        |             0 |
| `english-counties`             | 39/40 → 40/40           | 45/45 → 45/45        |             2 |
| `eu-official-languages`        | 26/27 → 27/27           | 26/31 → 31/31        |            26 |
| `europe-capitals`              | 39/40 → 40/40           | 43/45 → 45/45        |            18 |
| `europe-countries`             | 40/40 → 40/40           | 45/45 → 45/45        |            59 |
| `four-letter-countries`        | 11/11 → 11/11           | 22/22 → 22/22        |             0 |
| `german-states`                | 17/26 → 26/26           | 18/29 → 29/29        |            15 |
| `great-lakes-states`           | 8/8 → 8/8               | 16/28 → 28/28        |            16 |
| `greek-letters`                | 23/24 → 24/24           | 25/32 → 28/32        |             4 |
| `indian-states`                | 33/35 → 35/35           | 36/43 → 43/43        |            24 |
| `island-countries`             | 40/40 → 40/40           | 44/45 → 44/45        |            13 |
| `italian-regions`              | 20/30 → 30/30           | 21/32 → 32/32        |            17 |
| `japan-prefectures`            | 31/31 → 31/31           | 45/45 → 45/45        |             0 |
| `landlocked-countries`         | 42/42 → 42/42           | 45/45 → 45/45        |            42 |
| `mexico-states`                | 32/35 → 35/35           | 38/43 → 43/43        |            12 |
| `nato-alphabet`                | 27/30 → 30/30           | 27/30 → 30/30        |             3 |
| `new-zealand-regions`          | 17/17 → 17/17           | 19/25 → 25/25        |            18 |
| `oceania-countries`            | 15/17 → 17/17           | 18/22 → 21/22        |             4 |
| `south-africa-languages`       | 25/25 → 25/25           | 27/28 → 28/28        |             2 |
| `south-america-countries`      | 12/12 → 12/12           | 25/29 → 29/29        |             6 |
| `states-border-canada`         | 13/13 → 13/13           | 15/29 → 29/29        |            17 |
| `states-end-a`                 | 21/21 → 21/21           | 37/37 → 37/37        |             0 |
| `states-m-n`                   | 16/16 → 16/16           | 18/36 → 18/36        |             0 |
| `states-mississippi`           | 10/10 → 10/10           | 20/30 → 30/30        |            16 |
| `states-two-words`             | 10/10 → 10/10           | 20/31 → 20/31        |             0 |
| `states-vowel`                 | 12/12 → 12/12           | 24/36 → 24/36        |             0 |
| `swiss-cantons`                | 27/33 → 33/33           | 28/39 → 38/39        |            56 |
| `us-national-parks`            | 36/36 → 36/36           | 44/45 → 45/45        |             8 |

## Flagged for merger

### Derived bases

`constrained.py:read_specs` replaces per-prompt answers with derived base rows; adding a prompt-local answer/alias cannot override that branch. Fixes require aliases on base rows, and qualifying common names in `names` where membership itself is missing. Bases were outside this shard’s ownership and remain untouched.

Base-blocked below-target prompts: **countries-b, countries-m, countries-with-z, states-m-n, states-two-words, states-vowel**. Additional base-only residuals: **countries-ia, countries-s, countries-vowel**. The following is the complete handoff from `~/work/s1-base-aliases.md`; broader suggestions require normal membership/ambiguity review before insertion.

### Country aliases

- Shqipëria → Albania: countries-ia, countries-same-letter, countries-vowel
- Principality of Andorra → Andorra: countries-same-letter, countries-vowel
- Hayastan → Armenia: countries-ia, countries-same-letter, countries-vowel
- Österreich → Austria: countries-ia, countries-same-letter, countries-vowel
- Oesterreich → Austria: countries-ia, countries-same-letter, countries-vowel
- Republic of Azerbaijan → Azerbaijan: countries-with-z, countries-vowel
- Azerbaijan Republic → Azerbaijan: countries-with-z, countries-vowel
- Byelorussia → Belarus: countries-b
- Bielorussia → Belarus: countries-b
- Republic of Belarus → Belarus: countries-b
- België → Belgium: countries-no-a, countries-b
- Belgique → Belgium: countries-no-a, countries-b
- Belgien → Belgium: countries-no-a, countries-b
- Kingdom of Belgium → Belgium: countries-no-a, countries-b
- Bosnia → Bosnia and Herzegovina: countries-with-z, countries-b
- BiH → Bosnia and Herzegovina: countries-with-z, countries-b
- Brasil → Brazil: countries-with-z, countries-b
- Federative Republic of Brazil → Brazil: countries-with-z, countries-b
- Burkina → Burkina Faso: countries-b
- Kampuchea → Cambodia: countries-ia
- CAR → Central African Republic: countries-same-letter
- Central Africa Republic → Central African Republic: countries-same-letter
- Republic of Chad → Chad: four-letter-countries
- Tchad → Chad: four-letter-countries
- Republic of Colombia → Colombia: countries-ia
- Democratic Republic of Congo → Democratic Republic of the Congo: countries-no-a, countries-with-z
- Republic of Congo → Republic of the Congo: countries-no-a, countries-with-z
- Česko → Czech Republic: countries-no-a, countries-with-z, countries-ia, countries-same-letter
- Arab Republic of Egypt → Egypt: countries-no-a, countries-vowel
- Kingdom of Eswatini → Eswatini: countries-with-z, countries-s, countries-vowel
- Eesti → Estonia: countries-ia, countries-vowel
- Hellas → Greece: countries-no-a
- Ellada → Greece: countries-no-a
- Hellenic Republic → Greece: countries-no-a
- Ísland → Iceland: countries-vowel
- Republic of India → India: countries-ia, countries-vowel
- Bharat → India: countries-ia, countries-vowel
- Republic of Indonesia → Indonesia: countries-ia, countries-vowel
- Persia → Iran: four-letter-countries, countries-vowel
- Éire → Ireland: countries-vowel
- Republic of Ireland → Ireland: countries-vowel
- Italia → Italy: countries-vowel
- Italian Republic → Italy: countries-vowel
- Kazakstan → Kazakhstan: countries-with-z
- Kazakh Republic → Kazakhstan: countries-with-z
- Republic of Kazakhstan → Kazakhstan: countries-with-z
- Kirgizstan → Kyrgyzstan: countries-with-z
- Kyrgyz Republic → Kyrgyzstan: countries-with-z
- Kirghizia → Kyrgyzstan: countries-with-z
- Lao Republic → Laos: four-letter-countries
- Kingdom of Lesotho → Lesotho: countries-no-a
- Luxemburg → Luxembourg: countries-no-a
- Lëtzebuerg → Luxembourg: countries-no-a
- Grand Duchy of Luxembourg → Luxembourg: countries-no-a
- Republic of Mali → Mali: four-letter-countries, countries-m
- Mexican Republic → Mexico: countries-no-a, countries-m
- United Mexican States → Mexico: countries-no-a, countries-m
- Moldavia → Moldova: countries-m
- Republic of Moldova → Moldova: countries-m
- Principality of Monaco → Monaco: countries-m
- Maroc → Morocco: countries-no-a, countries-m
- Kingdom of Morocco → Morocco: countries-no-a, countries-m
- NZ → New Zealand: countries-with-z
- Aotearoa → New Zealand: countries-with-z
- Niger Republic → Niger: countries-no-a
- Republic of Niger → Niger: countries-no-a
- Macedonia → North Macedonia: countries-ia
- Republic of North Macedonia → North Macedonia: countries-ia
- FYROM → North Macedonia: countries-ia
- Republic of Peru → Peru: four-letter-countries, countries-no-a
- Rossiya → Russia: countries-ia
- Western Samoa → Samoa: countries-s
- Slovak Republic → Slovakia: countries-s, countries-ia
- Slovensko → Slovakia: countries-s, countries-ia
- Slovenija → Slovenia: countries-s, countries-ia
- ROK → South Korea: countries-s
- España → Spain: countries-s
- Espana → Spain: countries-s
- Kingdom of Spain → Spain: countries-s
- Ceylon → Sri Lanka: countries-s
- Surinam → Suriname: countries-s
- Republic of Suriname → Suriname: countries-s
- Sverige → Sweden: countries-no-a, countries-s
- Schweiz → Switzerland: countries-with-z, countries-s
- Suisse → Switzerland: countries-with-z, countries-s
- Svizzera → Switzerland: countries-with-z, countries-s
- Svizra → Switzerland: countries-with-z, countries-s
- Swiss Confederation → Switzerland: countries-with-z, countries-s
- Republic of Turkey → Turkey: countries-no-a
- UAE → United Arab Emirates: countries-vowel
- U.A.E. → United Arab Emirates: countries-vowel
- Emirates → United Arab Emirates: countries-vowel
- Republic of Uzbekistan → Uzbekistan: countries-with-z, countries-vowel
- Sao Tome → São Tomé and Príncipe: countries-s
- São Tomé → São Tomé and Príncipe: countries-s

### Membership name additions (not aliases alone)

- Bosnia → Bosnia and Herzegovina: add to base `names` for countries-ia membership; alias also needed.
- Macedonia → North Macedonia: add to base `names` for countries-m membership; aliases Macedonia and North Macedonia then resolve.
- Byelorussia/Bielorussia → Belarus: former English names also qualify countries-ia if reviewed into base `names`.
- Moldavia → Moldova: former English name also qualifies countries-ia if reviewed into base `names`.
- Persia → Iran: former English name also qualifies countries-ia if reviewed into base `names`.
- Kirghizia → Kyrgyzstan: former English name also qualifies countries-ia if reviewed into base `names`.

### Measured S1 blockers

- countries-b: Bosnia → Bosnia and Herzegovina; Brasil → Brazil; Byelorussia/Bielorussia → Belarus.
- countries-ia: Bosnia and Herzegovina needs the qualifying common name Bosnia in base `names`.
- countries-m: Macedonia/North Macedonia needs Macedonia in base `names`; Republic of Moldova/Moldavia → Moldova; Mexican Republic → Mexico; Maroc → Morocco.
- countries-s: Surinam → Suriname.
- countries-vowel: UAE → United Arab Emirates.
- countries-with-z: NZ → New Zealand; Brasil → Brazil; Kirgizstan → Kyrgyzstan; Kazakstan → Kazakhstan; Republic of Azerbaijan → Azerbaijan.
- states-m-n, states-two-words, states-vowel: the USPS codes and short forms listed below. State membership is already correct.

### State aliases

- AL → Alabama: states-end-a, states-vowel
- AK → Alaska: states-end-a, states-vowel
- AZ → Arizona: states-end-a, states-vowel
- AR → Arkansas: states-vowel
- CA → California: states-end-a
- FL → Florida: states-end-a
- GA → Georgia: states-end-a
- ID → Idaho: states-vowel
- IL → Illinois: states-vowel
- IN → Indiana: states-end-a, states-vowel
- IA → Iowa: states-end-a, states-vowel
- LA → Louisiana: states-end-a
- ME → Maine: states-m-n
- MD → Maryland: states-m-n
- MA → Massachusetts: states-m-n
- Mass → Massachusetts: states-m-n
- MI → Michigan: states-m-n
- Mich → Michigan: states-m-n
- MN → Minnesota: states-end-a, states-m-n
- MS → Mississippi: states-m-n
- MO → Missouri: states-m-n
- MT → Montana: states-end-a, states-m-n
- NE → Nebraska: states-end-a, states-m-n
- NV → Nevada: states-end-a, states-m-n
- NH → New Hampshire: states-two-words, states-m-n
- NJ → New Jersey: states-two-words, states-m-n
- NM → New Mexico: states-two-words, states-m-n
- NY → New York: states-two-words, states-m-n
- New York State → New York: states-two-words, states-m-n
- NC → North Carolina: states-two-words, states-end-a, states-m-n
- ND → North Dakota: states-two-words, states-end-a, states-m-n
- OH → Ohio: states-vowel
- OK → Oklahoma: states-end-a, states-vowel
- OR → Oregon: states-vowel
- PA → Pennsylvania: states-end-a
- Penn → Pennsylvania: states-end-a
- RI → Rhode Island: states-two-words
- SC → South Carolina: states-two-words, states-end-a
- SD → South Dakota: states-two-words, states-end-a
- UT → Utah: states-vowel
- VA → Virginia: states-end-a
- WV → West Virginia: states-two-words, states-end-a

### Normalization, scope and ambiguity

- **greek-letters:** Α, β, π and ω normalize to empty under the Latin-only shared normalizer. A shared normalizer change is required, outside S1 ownership. They remain valid misses.
- **island-countries / Australia:** acceptance_notes explicitly says Australia counts, but the answer rows and pinned island-country list exclude it. Merger must add a row with reviewed provenance or fix the contradictory note. It remains a valid miss; source scope alone does not make this debatable answer invalid.
- **oceania-countries / Indonesia:** Western New Guinea makes regional membership debatable. Merger decides whether to broaden the source-backed scope. It remains a valid miss.
- **australia-states-territories / Jervis Bay:** the pinned scope includes Jervis Bay Territory; its short alias was added.
- **swiss-cantons / Basel:** ambiguous between Basel-Stadt and Basel-Landschaft. Intentionally unresolved; do not pick one arbitrarily.
- **canada-provinces / Labrador:** a baseline-only nonmember miss, since Labrador is not a separate province/territory. The frozen baseline is not rewritten; the shard correctly marks it invalid. Baseline recall is still 19/20 (95%).

### Gzip and dropped variants

**Whole Worker: 2946.24 → 2950.12 KiB gzip (+3.88 KiB)**, from `npm run build` / Wrangler 4.158.0 dry-run Total Upload on Node v24.22.2. These are printed rounded whole-bundle KiB, not additive standalone-module estimates. The +4 KiB allowance is nearly exhausted: approximately 0.12 KiB remains. Initial expansions measured 2950.81 and 2950.34 KiB before trimming.

The following candidate aliases were dropped for budget: Japanese -ken suffixes (plus Tokyo -to and Kyoto/Osaka -fu), county abbreviations, some formal/endonym variants and Canadian full park suffix variants. They were never added as new guesses. Merger may restore them if budget allows; no claim is made that every plausible alias fits this cap. Exact dropped variants, grouped by prompt:

- **africa-countries:** `Kingdom of Morocco` → Morocco; `Republic of Niger` → Niger.
- **africa-landlocked:** `Republic of Niger` → Niger.
- **asia-countries:** `Islamic Republic of Afghanistan` → Afghanistan; `Hayastan` → Armenia; `Republic of Indonesia` → Indonesia; `Federal Democratic Republic of Nepal` → Nepal; `Republic of Uzbekistan` → Uzbekistan.
- **borders-china:** `Islamic Republic of Afghanistan` → Afghanistan; `Federal Democratic Republic of Nepal` → Nepal.
- **borders-france:** `Kingdom of Belgium` → Belgium; `Grand Duchy of Luxembourg` → Luxembourg.
- **borders-russia:** `Suomen tasavalta` → Finland; `Kingdom of Norway` → Norway.
- **canada-national-parks:** `Aulavik National Park` → Aulavik; `Auyuittuq National Park` → Auyuittuq; `Bruce Peninsula National Park` → Bruce Peninsula; `Cape Breton Highlands National Park` → Cape Breton Highlands; `Elk Island National Park` → Elk Island; `Forillon National Park` → Forillon; `Georgian Bay Islands National Park` → Georgian Bay Islands; `Glacier National Park` → Glacier; `Grasslands National Park` → Grasslands; `Gulf Islands National Park` → Gulf Islands; `Gwaii Haanas National Park` → Gwaii Haanas; `Ivvavik National Park` → Ivvavik; `Kejimkujik National Park` → Kejimkujik; `Kluane National Park` → Kluane; `Kouchibouguac National Park` → Kouchibouguac; `La Mauricie National Park` → La Mauricie; `Mealy Mountains National Park` → Mealy Mountains; `Mingan Archipelago National Park` → Mingan Archipelago; `Mount Revelstoke National Park` → Mount Revelstoke; `Nahanni National Park` → Nahanni; `Nááts'ihch'oh National Park` → Nááts'ihch'oh; `Pacific Rim National Park` → Pacific Rim; `Pituamkek National Park` → Pituamkek; `Point Pelee National Park` → Point Pelee; `Prince Albert National Park` → Prince Albert; `Prince Edward Island National Park` → Prince Edward Island; `Pukaskwa National Park` → Pukaskwa; `Qausuittuq National Park` → Qausuittuq; `Quttinirpaaq National Park` → Quttinirpaaq; `Riding Mountain National Park` → Riding Mountain; `Sable Island National Park` → Sable Island; `Sirmilik National Park` → Sirmilik; `Terra Nova National Park` → Terra Nova; `Thaidene Nëné National Park` → Thaidene Nëné; `Thousand Islands National Park` → Thousand Islands; `Torngat Mountains National Park` → Torngat Mountains; `Tuktut Nogait National Park` → Tuktut Nogait; `Ukkusiksalik National Park` → Ukkusiksalik; `Vuntut National Park` → Vuntut; `Wapusk National Park` → Wapusk.
- **china-provinces:** `Hainan Province` → Hainan; `Hunan Province` → Hunan; `Liaoning Province` → Liaoning.
- **english-counties:** `Beds` → Bedfordshire; `Bucks` → Buckinghamshire; `Cambs` → Cambridgeshire; `Glos` → Gloucestershire; `Hants` → Hampshire; `Herts` → Hertfordshire; `Lancs` → Lancashire; `Leics` → Leicestershire; `Lincs` → Lincolnshire; `Northants` → Northamptonshire; `Notts` → Nottinghamshire; `Oxon` → Oxfordshire; `Salop` → Shropshire; `Staffs` → Staffordshire; `Warks` → Warwickshire; `Wilts` → Wiltshire; `Worcs` → Worcestershire.
- **eu-official-languages:** `Engels` → English.
- **europe-capitals:** `Athinae` → Athens.
- **europe-countries:** `Hayastan` → Armenia; `Kingdom of Belgium` → Belgium; `Suomen tasavalta` → Finland; `French Republic` → France; `République française` → France; `Grand Duchy of Luxembourg` → Luxembourg; `Kingdom of Norway` → Norway; `Portuguese Republic` → Portugal.
- **island-countries:** `Republic of Indonesia` → Indonesia.
- **japan-prefectures:** `Aichi-ken` → Aichi; `Akita-ken` → Akita; `Aomori-ken` → Aomori; `Chiba-ken` → Chiba; `Ehime-ken` → Ehime; `Fukui-ken` → Fukui; `Fukuoka-ken` → Fukuoka; `Fukushima-ken` → Fukushima; `Gifu-ken` → Gifu; `Gunma-ken` → Gunma; `Hiroshima-ken` → Hiroshima; `Hyōgo-ken` → Hyōgo; `Ibaraki-ken` → Ibaraki; `Ishikawa-ken` → Ishikawa; `Iwate-ken` → Iwate; `Kagawa-ken` → Kagawa; `Kagoshima-ken` → Kagoshima; `Kanagawa-ken` → Kanagawa; `Kumamoto-ken` → Kumamoto; `Kyōto-fu` → Kyōto; `Kōchi-ken` → Kōchi; `Mie-ken` → Mie; `Miyagi-ken` → Miyagi; `Miyazaki-ken` → Miyazaki; `Nagano-ken` → Nagano; `Nagasaki-ken` → Nagasaki; `Nara-ken` → Nara; `Niigata-ken` → Niigata; `Okayama-ken` → Okayama; `Okinawa-ken` → Okinawa; `Saga-ken` → Saga; `Saitama-ken` → Saitama; `Shiga-ken` → Shiga; `Shimane-ken` → Shimane; `Shizuoka-ken` → Shizuoka; `Tochigi-ken` → Tochigi; `Tokushima-ken` → Tokushima; `Tottori-ken` → Tottori; `Toyama-ken` → Toyama; `Tōkyō-to` → Tōkyō; `Wakayama-ken` → Wakayama; `Yamagata-ken` → Yamagata; `Yamaguchi-ken` → Yamaguchi; `Yamanashi-ken` → Yamanashi; `Ōita-ken` → Ōita; `Ōsaka-fu` → Ōsaka.
- **landlocked-countries:** `Islamic Republic of Afghanistan` → Afghanistan; `Hayastan` → Armenia; `Grand Duchy of Luxembourg` → Luxembourg; `Federal Democratic Republic of Nepal` → Nepal; `Republic of Niger` → Niger; `Republic of Uzbekistan` → Uzbekistan.
- **swiss-cantons:** `Ury` → Uri.

### Plain prompts: editorial decision, not deletion

The user requested no broad/plain prompts. These constrained membership lists remain active because S1 was an alias audit, not permission to delete or replace prompts. Merger decides:

- **africa-countries:** Plain continent membership list; low specificity.
- **asia-countries:** Plain continent membership list; low specificity.
- **europe-countries:** Plain continent membership list; low specificity.
- **south-america-countries:** Plain continent membership list; low specificity.
- **oceania-countries:** Plain continent membership list; low specificity.
- **africa-capitals:** Plain continent-capital list; low specificity.
- **asia-capitals:** Plain continent-capital list; low specificity.
- **europe-capitals:** Plain continent-capital list; low specificity.
- **americas-capitals:** Plain continent-capital list; low specificity.
- **canada-provinces:** Plain first-level membership list; low specificity.
- **australia-states-territories:** Plain first-level membership list; low specificity.
- **landlocked-countries:** Familiar geographic membership list; low specificity.
- **greek-letters:** Recitation list with little discovery.
- **nato-alphabet:** Recitation list with little discovery.

## Checks and runtime limits

The generator and its check pass; Python unit tests: 28 passed; Node recall tests: 10 passed. Both recall corpora were measured on regenerated data, and the default historical corpus was also evaluated. Source reviewed/members and counts did not change, so --verify-sources was not run. `npm run build` is a dry run, not a deployment.

Generator-check, Python-test and Node-test inputs are unchanged from the final Step 3 pass; those passing checks are carried forward rather than rerun without changed inputs. Final corpus measurements and artifact formatting checks cover the changed selected/audit/review files. Generated Worker modules and report files are reverted before committing; regeneration is required to consume these reviewed specs. No runtime, matcher, shared-normalizer or UI changes were made.
