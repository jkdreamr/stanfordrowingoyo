# Dive recall corpus

```sh
source ~/.nvm/nvm.sh
node scripts/dive/recall.mjs
node scripts/dive/recall.mjs --ref origin/devin/1794172834-launch-integration --report "$HOME/work/dive-recall-before.json"
node --test scripts/dive/recall.test.mjs
```

`corpus.json` maps prompt IDs to independently brainstormed player submissions.
All 320 scheduled prompts were authored from the prompt wording and general
knowledge before evaluating or opening their generated answer modules. Pipeline
code and the answer-free catalog were read first. Large sets generally have
25–40 guesses; small closed sets include remembered members and natural variants.
This is one model's casual-to-knowledgeable brainstorm, not collected player data
or a statistically representative survey. It is a regression baseline, not proof
of exhaustive answer coverage. Guesses are frozen: do not add, remove, or replace
them in response to misses.

A guess is either a string or `{ "guess": "...", "invalid": "short reason" }`.
Only genuinely incorrect answers may be marked reviewed-invalid. Missing aliases,
short titles, surnames, common names, and otherwise plausible valid answers must
remain in the denominator even when absent from generated data. Initial invalid
20 annotations came from a knowledge review before the first evaluation; five
more were reviewed afterward (Lagos, Azerbaijan, Roots, Idalia, and the accidental
misspelling `itsonga`). No guesses were added or removed after evaluation. Keep any
later invalid review explicit in the diff. Do not treat this corpus as a source
of truth for expanding answer banks without separately checking membership.

The evaluator uses only exact normalized length-bucket keys, including aliases;
it never imports the matcher or invokes fuzzy matching. Normalization is imported
from `shared/games/dive.ts` in the evaluated tree/ref. Raw distinct submissions
remain separate observations even if normalization collapses them; thus common
variants intentionally carry weight. Recall is micro-averaged (total hits divided
by total valid guesses), not an average of prompt percentages. Zero-denominator
rates are null/n/a, not 100%.

The evaluated ref's `DIVE_SCHEDULE` determines the cycle and its catalog determines
constrained/broad classification. Missing data modules count all valid guesses as
misses and are listed; missing corpus IDs and metadata are separately listed.
Corpus entries outside that cycle are listed but excluded from cycle rates.
Malformed existing modules and invalid corpus entries fail rather than being
silently skipped. Reports include every prompt and miss, exclusions, summary
counts, source commit/ref and the corpus SHA-256. Reports are key-sorted with no
timestamp; repeated evaluation of the same inputs is deterministic.

`--ref` resolves a commit and extracts only the data, catalog, schedule and shared
normalization into a disposable temporary directory, removed on success or error.
It does not check out or modify the working tree. The corpus always comes from
the working tree (or `--corpus PATH`), so the same guesses measure before/after.
The default report path is `scripts/dive/recall/report.json`; use `--report PATH`
to preserve a separate comparison. The report's `workingTree` flag means tracked
data may differ from its HEAD commit; ref-based measurements pin data exactly.

## First replacement batch

`batch-1.json` and `batch-1-substitutes.json` preserve pre-source brainstorms,
including rejected candidates. `batch-1-selected.json` contains the final 25
prompts with reviewed-invalid annotations, not source-derived extra guesses.
`batch-1-audit.json` records each prompt's before/after exact results and standalone
gzip estimate. See `batch-1-review.md` for source scope and editorial decisions.
These are audit artifacts, not a staging catalog: all 25 selected prompts are
active and the ordinary generator rebuilds the prospective schedule immediately.

To evaluate the new cycle without changing the historical baseline corpus:

```sh
source ~/.nvm/nvm.sh
node --input-type=module - "$HOME/work/dive-batch1-corpus.json" <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const read = (name) => JSON.parse(readFileSync(`scripts/dive/recall/${name}.json`, 'utf8'));
writeFileSync(process.argv[2], JSON.stringify({ ...read('corpus'), ...read('batch-1-selected') }, null, 2) + '\n');
JS
node scripts/dive/recall.mjs --corpus "$HOME/work/dive-batch1-corpus.json" --report "$HOME/work/dive-batch1-report.json"
node --test scripts/dive/recall.test.mjs
```

The 25 displaced broad prompts are expected in `Unscheduled corpus`. Their data
remain loadable for legacy dates. The Node regression test checks all 25 selected
prompts independently, requiring at least 25 brainstorm guesses and 95% exact
recall per prompt. Existing empty/error-case harness tests remain applicable.

## Second replacement batch

`batch-2-raw.json` preserves 32 candidate brainstorms. The 30 selected prompts and
reviewed-invalid annotations live in `batch-2-selected.json`; the two rejected
candidate brainstorms remain untouched. `batch-2-audit.json` records before/after
results against the same reviewed denominator, corpus hashes, module sizes, tiers,
aliases and gzip. See `batch-2-review.md` for pinned-source scope decisions, ENABLE
editorial policy, the remaining ambiguous-surname miss and runtime limitations.

Reproduce the current combined cycle without altering the historical corpus:

```sh
source ~/.nvm/nvm.sh
node --input-type=module - "$HOME/work/dive-batch2-corpus.json" <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const read = (name) => JSON.parse(readFileSync(`scripts/dive/recall/${name}.json`, 'utf8'));
writeFileSync(process.argv[2], JSON.stringify({ ...read('corpus'), ...read('batch-1-selected'), ...read('batch-2-selected') }, null, 2) + '\n');
JS
node scripts/dive/recall.mjs --corpus "$HOME/work/dive-batch2-corpus.json" --report "$HOME/work/dive-batch2-report.json"
node --test scripts/dive/recall.test.mjs
```

All 30 new prompts have at least 25 frozen guesses and at least 95% exact recall.
The three ENABLE prompts are independently checked for their spelling predicates
and the 2,000-answer cap. Their original-spelling constraints are intentionally
separate from the unchanged production normalizer's plural folding and stopwords.

## Third replacement batch

`batch-3-raw.json` preserves all 35 brainstormed candidates, including six rejected
concepts. `batch-3-selected.json` contains 29 selected prompts and reviewed-invalid
annotations without replacing any raw guess. `batch-3-audit.json` records the same
denominator before/after, corpus hashes, sizes, tiers, aliases and gzip estimates.
See `batch-3-review.md` for source scopes, carryovers, scheduler correction and the
gameplay/safety budget reserves.

Reproduce the current combined cycle:

```sh
source ~/.nvm/nvm.sh
node --input-type=module - "$HOME/work/dive-batch3-corpus.json" <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const read = (name) => JSON.parse(readFileSync(`scripts/dive/recall/${name}.json`, 'utf8'));
writeFileSync(process.argv[2], JSON.stringify({ ...read('corpus'), ...read('batch-1-selected'), ...read('batch-2-selected'), ...read('batch-3-selected') }, null, 2) + '\n');
JS
node scripts/dive/recall.mjs --corpus "$HOME/work/dive-batch3-corpus.json" --report "$HOME/work/dive-batch3-report.json"
node --test scripts/dive/recall.test.mjs
```

All 29 selected prompts have at least 25 frozen guesses and 100% exact valid-guess
recall. The Node regression also rejects all reviewed nonmembers. The historical
corpus remains unmodified. Displaced broad data stay loadable for legacy dates.
