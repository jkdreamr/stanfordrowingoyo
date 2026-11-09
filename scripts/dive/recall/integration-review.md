# Final content integration

The default recall command combines the historical corpus, all four selected
batches and `supplemental-selected.json`. `--corpus PATH` uses only that file.
`--ref REF` tests the same current corpus against archived code/data; unscheduled
guesses do not enter denominators.

The duplicate `disney-princesses` is retired. Its replacement is the 13 released
Pixar films with one-word English titles: a lexical challenge distinct from the
existing all-Pixar list. Its 31 guesses were frozen in batch-4-raw.json before
source review; multiword titles are explicitly out of scope.

The historical corpus retains every raw guess, with 12 Emmy non-winner annotations
and one copper symbol-initial annotation. Emmy evidence is Wikipedia revision
1375256355: all 59 winner-highlighted rows, including the four unlinked bold
winner titles. Ambiguous surnames remain valid misses. S1's complete country/state
base-alias handoff and six qualifying common-name groups are applied; all 138
budget-dropped aliases are restored subject to the final bundle check.

Greek glyphs still normalize to empty strings; aliases alone cannot repair them.
A future fix needs explicit Greek-glyph-to-letter-name transliteration before
ASCII filtering in both runtime and Python normalization, including case and
final-sigma variants, collision tests and regenerated data. No normalizer change
is made here.

## Bumping cutover

Edit only `DIVE_SCHEDULE_CUTOVER` in `scripts/dive/generate.py` to an ISO date at
least two days after the actual integration merge, then run:

```sh
source ~/.nvm/nvm.sh
~/work/dive-venv/bin/python scripts/dive/generate.py
~/work/dive-venv/bin/python scripts/dive/generate.py --check
```

The current value remains `2026-11-10`; the merger must bump it if that date no
longer satisfies the rule. Do not edit generated schedule.ts or the hidden
game-registry flag. Dates before cutover retain the frozen legacy order.
Selector tests derive their boundary and cycle dates from the generated constant.
