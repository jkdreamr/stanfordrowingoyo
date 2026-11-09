# Plain-list swaps

Only the fourteen S1 flags are retired. Their specifications and pinned sources
remain intact with `active: false`. Replacements: twelve geography and two words;
eight tiny, four medium and two large sets. The wider 320-prompt editorial scan
is deferred, not represented as resolved by these fourteen swaps.

## Frozen recall

The five raw files were written before inspecting their candidate sources or
answer data. Backups were independently brainstormed before their source lookup.
Rejected candidates remain frozen. Selection preserves strings and order; the
second identical `Czech Republic` in the Austria brainstorm is the sole duplicate
removed. Every selected prompt has at least 25 distinct guesses.

475 selected guesses: 137 reviewed-invalid, 338 valid. Exact normalized recall
before/after the formal-name and spelling-alias review is **316/338 (93.49%) →
337/338 (99.70%)**. Thirteen prompts reach 100%; Greek hidden names reaches
**37/38 (97.37%)**. The remaining valid miss is `gypsies`: the spelling satisfies
the pattern, but its ethnic-slur use is explicitly editorially excluded. It is
retained as a valid miss rather than using a false invalid annotation to inflate
recall. No fuzzy credit is included. This model brainstorm is not player telemetry
or a proof of completeness.

The audit pins original/current raw hashes, reviewed selected hash, per-prompt
results and standalone gzip. Initial results use the sourced canonical sets and
their inherited aliases before this batch's additional reviewed aliases; they
are not recall against the unrelated retired prompts.

## Complete pinned scopes

All sets have exact source and canonical counts in `constrained.json`, covering
25 distinct Wikipedia/dataset snapshots. Reviewed source membership was checked
against the pinned revision/dataset. No live source is required at runtime.

- **Germany, Austria, Zambia and DR Congo borders:** complete geographic neighbour
  enumerations. River/lake borders count, including Zambia–Botswana at Kazungula;
  maritime proximity does not. Sudan is not the DR Congo neighbour: South Sudan is.
- **High capitals:** the complete sovereign-state capital elevation table,
  strictly above 2,000 m. All nine qualify, including both La Paz and Sucre.
  Lhasa is not a sovereign-state capital; Nairobi and Kabul are below the threshold.
- **Left-driving countries:** all 54 UN members whose own roads normally use
  left-hand traffic. Hong Kong and dependencies are not separate UN members;
  the US Virgin Islands exception does not make the US qualify.
- **Crescent flags:** all 19 current UN-member national flags containing a crescent,
  including stylised moon symbols and coats of arms. Star/crescent and crescent
  galleries are supplemented by the pinned Brunei, Iran and Mongolia flag pages.
  Includes Nepal, Moldova, Croatia and Iran's stylised crescents. Full discs alone,
  historical Egyptian/Syrian flags and nonmember Western Sahara do not qualify.
- **Multiple zones:** the complete country table, more than one standard offset,
  including overseas dependencies and uninhabited territory. Antarctica is not a
  country. Seasonal switching is not two standard zones; Kazakhstan unified in 2024. South Africa counts through the Prince Edward Islands, Greenland through
  Denmark, and China uses one official standard zone.
- **High summits:** complete sovereign-state elevation-extremes table, strictly
  above 5,000 m. Shared summits count for both countries. Earth and dependencies
  are excluded. Indonesia and Venezuela fall below the threshold.
- **Moscow 1980:** the complete 68-team non-participating list, including territories
  and withdrawals for reasons other than the US-led boycott. Wording deliberately
  asks for absent Olympic teams, not exclusively boycott participants. Competing
  under an IOC/NOC flag is still participation: Britain, Australia, New Zealand,
  France, Italy and Spain do not qualify. West Germany does; East Germany does not.
- **Olympic capitals:** intersection of the complete hosted Summer/Winter city
  lists through 2026 with current national capitals: fifteen cities. Sarajevo
  counts as a present-day capital, Stockholm as split host in 1956. No Youth
  Olympics, cancelled/future editions or other sporting events.
- **English Eurovision wins:** complete winners-by-language English row through
  2026: nineteen countries. Mixed-language wins count explicitly, including
  Ukraine. Bulgaria's 2026 win is in the pinned source. West Germany's 1982 win
  was German, unlike reunified Germany's English-language 2010 win. The latter
  does not make historical West Germany qualify.

## Word pools and editorial review

Both pools use the existing SHA-pinned public-domain ENABLE and `wordfreq==3.1.1`,
Zipf >=3, explicit reviewed low-frequency exceptions, no arbitrary size pruning,
and normalization-equivalent inflections as aliases. Surface anchors and exactly
one Pearl are explicit, rather than automatically assigned by frequency.

- **Hidden Greek names (198 canonicals):** original spellings, 4–12 letters,
  containing one of all six three-letter English Greek-letter names: ETA, RHO,
  TAU, PHI, CHI, PSI. `sapphire`, `restaurant`, `architect` and `capsicum` qualify;
  ALPHA/GAMMA or similar-looking `psy`/`rhu` strings do not. `metamorphosis` has
  thirteen letters. Pearl: `rhododendron`; Too Clever: `epsilon` hiding PSI.
- **QWERTY top row (146 canonicals):** complete familiar 4–12-letter ENABLE base
  spellings using Q W E R T Y U I O P. Plural forms are expressly allowed,
  matching the unchanged normalizer; verified ENABLE inflections are aliases.
  Pearl: `perpetuity`; Too Clever: the classic `typewriter`. `qwerty` is retained
  as a dictionary word, not rejected as a convenient miss.

Reviewed ethnic slurs/vulgar insults and proper-name-dominated obscure frequency
artifacts are explicitly excluded by normalized family. Legitimate technical and
medical words remain eligible. `china` (porcelain), `chile`/`chino`, `perry` (drink),
`peter` (peter out), `terry` and `troy` have ordinary English senses, not merely
proper-name frequency. The pinned ENABLE source is public domain; Wikipedia
revision text/data is CC BY-SA. wordfreq 3.1.1 code is Apache-2.0 and its underlying
corpus attribution/licensing remains applicable as documented in batch 2.

## Rejected candidates

- Capital not largest: city/metro boundary differences and omitted Sri Lanka
  prevented a clean complete global scope in the available list.
- Exactly two neighbours: constituent-country versus kingdom/dependency treatment
  (especially Netherlands/Denmark and overseas borders) was not clean enough.
- Personal namesakes: disputed/legendary etymologies and family/official-long-name
  distinctions were insufficiently clean for the stated scope.
- No railways: no complete pinned current operational-railway absence list established.
- Cross flags: the proposed complete source was unavailable.
- Hidden NATO codewords: inflection and codeword-only edge cases were less clean
  than the QWERTY-row puzzle.

Retired Canada/NATO suggestion fixtures are replaced by new reachable prompts;
case counts and precision/recall floors are unchanged. The normalizer, matcher,
routes, Dive UI, shared contract and hidden registry flag were not hand-edited.
The final upstream gameplay merge supplies `DIVE_ENABLED = true` at `f96f8a1`;
the flag is not hand-edited in this content pass. No deployment
or browser/visual verification was performed.
