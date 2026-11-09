# Two non-border geography swaps

Base: `4e95160`, checked out as the clean tracking branch
`devin/1794186244-dive-did-you-mean`. No stash or protected-code/flag edit.
Only `borders-austria` and `borders-zambia` become inactive; every other previous
specification and base is preserved. Both replacements remain tiny geography
sets, so the theme/difficulty size mix is unchanged.

| Before                                          | Size | After                                                                            | Size |
| ----------------------------------------------- | ---: | -------------------------------------------------------------------------------- | ---: |
| Name a country with a land border with Austria. |    8 | Name a UN member country with no U, S or A in its UN short name.                 |   14 |
| Name a country with a land border with Zambia.  |    8 | Name a present-day country where both Summer and Winter Olympics have been held. |    9 |

## Complete pinned membership

- **No USA:** all 193 members in _Member states of the United Nations_, revision
  **1384387228**, table 0, column 0. Strip diacritics, case and punctuation and
  exclude any name containing U, S or A. This yields all 14; there is no ranked
  truncation. The predicate concerns the country's UN short name, not a submitted
  alias: Ivory Coast is accepted for qualifying Côte d'Ivoire, and Republic of the
  Congo/Congo-Brazzaville identify qualifying Congo. DR Congo does not qualify:
  its UN name contains forbidden letters. Niue and Hong Kong are not UN members.
  Mexico qualifies despite not appearing in the frozen brainstorm. Surface:
  Mexico/Egypt/Fiji; Pearl: Côte d'Ivoire.
- **Both Olympic seasons:** _List of Olympic Games host cities_, revision
  **1383437929**, complete country table 2, country column 1. Intersect rows whose
  Summer and Winter columns are nonempty: exactly nine countries. All nine have
  completed editions of both seasons; cancelled/future editions add no member.
  Present-day geography explicitly counts Moscow 1980 plus Sochi 2014 for Russia.
  Canada: Montreal 1976/Calgary 1988; China: Beijing 2008/2022; France: Paris
  1900/Chamonix 1924; Germany: Berlin/Garmisch 1936; Italy: Rome 1960/Cortina 1956;
  Japan: Tokyo 1964/Sapporo 1972; South Korea: Seoul 1988/Pyeongchang 2018;
  USA: St. Louis 1904/Lake Placid 1932. Youth Olympics do not count. Surface:
  USA/France/Japan; Pearl: South Korea. Reviewed aliases include ROK/Korea,
  PRC/People's Republic of China, Russian Federation and formal republic names.

These are not duplicates of the existing country no-A, equator/tropic, left-driving,
crescent, elevation, time-zone or capital-city Olympic predicates. One is a
three-letter exclusion on a pinned naming standard; the other intersects both
Olympic seasons at country level, not a host-city or capital roster.

Both source records carry exact extraction counts and reviewed snapshots. Source
acquisition was checked against the pinned revisions during authoring. Wikipedia
revision material is CC BY-SA, following the existing source policy.

## Frozen recall and review

`batch-6-raw.json` was frozen before source inspection and includes a rejected
dollar-currency candidate; `batch-6-olympics-raw.json` was frozen before inspecting
the Olympic tables. Source-derived Mexico was not added to the brainstorm.
Whitespace formatting preserves every raw string and order. The selected corpus
retains all 30 + 33 guesses with explicit reasons for the 26 nonmembers.

Exact normalized recall: **17/17 and 20/20 (100% each), 37/37 overall**. No fuzzy
credit. The audit also records canonical-only results against the same denominator
before adding aliases, explicitly not results against unrelated border sets.
Frozen raw/selected SHA-256 checks, invalid rejection and empty/error evaluation
regressions are included in the native recall tests. These are model brainstorms,
not measured player telemetry or proof of complete coverage.

The dollar candidate was dropped: the inspected circulating-currency table omitted
Zimbabwe's dollar usage and Cambodia presented official/de-facto ambiguity.
Rather than inventing a complete scope or marking plausible answers invalid, it
was replaced with the fully enumerable Olympic intersection. Its raw brainstorm
remains untouched. No currency-source assertion is used for either selected set.

Batch-5 raw/audit artifacts remain historical. Its live recall test now evaluates
the twelve still-active prompts; the two newly retired border specs retain their
complete eight-member source rows but no longer require runtime modules.
The retired Austria suggestion fixture is replaced by Montenegro in the new
reachable set, without reducing any case count or precision/recall floor.
