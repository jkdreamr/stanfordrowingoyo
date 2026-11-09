# R8 alias-budget follow-up

## Module sizes

Standalone gzip uses Node's `gzipSync` with default compression on each formatted TypeScript data module. Retired module bytes come from `git show d9f96cf:path`. These independent compressed sizes do not sum to the compressed bundled Worker delta.

| Replacement                                   | Retired gzip bytes | New before trim | New after trim | New aliases before → after |
| --------------------------------------------- | -----------------: | --------------: | -------------: | -------------------------: |
| star-alliance → le-mans-winning-makes         |                948 |             725 |            725 |                      8 → 8 |
| oneworld-airlines → a380-airlines             |                649 |             657 |            657 |                    14 → 14 |
| monopoly-uk → spiel-des-jahres-winners        |                827 |            1276 |           1276 |                    13 → 13 |
| monopoly-us → video-game-hall-of-fame         |                817 |            1452 |           1452 |                    11 → 11 |
| css-named-colors → generic-trademarks         |               2415 |            3145 |           3145 |                      9 → 9 |
| magic-eight-ball-responses → toy-hall-of-fame |                700 |            1936 |           1936 |                    19 → 19 |
| london-tube-lines → monopoly-tokens           |                517 |             607 |            603 |                    21 → 20 |

## Trim decision and validation

No explicit aliases in the seven new specs normalize to their canonical or another alias of the same answer under the actual shared `normalizeAnswer`. They were already deduplicated during initial implementation. Retain natural alternate names and every exact key needed for the frozen corpus, including Plexiglass, Onesie, Bubblewrap, Superglue, translated titles and airline short names.

Removed only **Scotty dog → Scottie dog**: a low-value spelling variant absent from the frozen corpus. The matcher permits two edits for normalized keys at least eight characters long; this variant replaces “ie” with “y”. Bundled the actual matcher and checked the regenerated set without the alias:

```text
Scotty dog without explicit alias: { canonical: 'Scottie dog', tier: 'surface', points: 10 }
PASS: shared-normalizer alias uniqueness, frozen valid exact hits, invalid rejection for all seven
```

No members or other aliases were cut. All seven remain 100% exact recall (30/30, 26/26, 37/37, 52/52, 64/64, 74/74, 29/29). Standalone token-module gzip falls 607 → 603 bytes. Full build prints:

```text
Total Upload: 8021.16 KiB / gzip: 2996.53 KiB
```

Worker gzip is still **+2.78 KiB** versus 2993.75 KiB, unchanged at Wrangler's two-decimal precision, and remains **1.28 KiB over** the requested +1.5 KiB delta budget.

## Correction: recall exit status

The earlier review/report mistakenly attributed a chained command's exit 1 to the evaluator. The failing second command was the Node test suite. The evaluator only sets exitCode 1 when it throws, not when a prompt has recall below 95%.

```text
node scripts/dive/recall.mjs --ref d9f96cf --report ~/work/R8-base-default-recall.json
exit=0
overall: 8719/8748 99.67% (320 prompts)

node scripts/dive/recall.mjs
recall_exit=0
overall: 8840/8869 99.67% (320 prompts)
```

Both use the default combined working-tree corpus as requested. The base schedule excludes the seven new prompt IDs.

## Test diagnosis

Re-executed the current suites after trimming: Python 28/30 pass, Node 14/15 pass, same failures. A clean persistent archive of d9f96cf passes both affected Python tests (`Ran 2 tests ... OK`) and the affected Node test (`tests 1; pass 1; fail 0`). No test files were changed.

Observed Python assertions:

```python
# scripts/dive/test_constrained.py:106
self.assertEqual(len(prompts), 387)
# AssertionError: 394 != 387

# scripts/dive/test_constrained.py:82–97
self.assertEqual(retired, {'disney-princesses', 'calendar-months', 'zodiac-signs', 'chinese-zodiac',
                         # ... fixed pre-R8 IDs ...
                         'borders-austria', 'borders-zambia'} |
                 {p['id'] for p in prompts if re.search(
                     r'-(pre1980|1980-1999|2000-2026|early|middle|recent)$', p['id'])})
```

The second assertion's actual extra IDs are precisely the seven requested retirements. **However, the Python test is not purely a count/list maintenance issue:** after correcting its retired-ID assertion, line 102 would also reject the explicitly requested Spiel wording:

```python
self.assertNotRegex(prompt['text'], r'[();]|through \\d{4}|counts|pinned|IAU|IUCN')
# Name a winner of the Spiel des Jahres (German Game of the Year).
```

A direct scan of the same text predicates finds only this new prompt. The parenthesized wording was explicitly requested, so it remains unchanged. This needs an editorial/test-policy decision rather than silently changing the prompt or weakening a test.

Node's historical batch test (recall.test.mjs:238–256) fails before its recall assertions, at:

```js
loadSet: async (id) => (await import(`../../worker/src/games/dive/data/${id}.ts`)).default,
```

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../worker/src/games/dive/data/css-named-colors.ts'
```

The frozen original batch still contains css-named-colors; generation omits the newly retired unreachable runtime module. That failure is a retired-module import, not a new-prompt recall miss. Restoring generated files returns the module to the committed working tree, as requested, but does not change what the generator omits.
