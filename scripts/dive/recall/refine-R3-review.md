# R3 music refinement review

## Result

Six plain artist-album prompts are retired (`"active": false`) and each is followed by a constrained music replacement. All six reach **100% exact normalized recall** on the frozen R3 guesses.

| Retired slot      | Replacement                    | Count | Band   | Recall |
| ----------------- | ------------------------------ | ----: | ------ | ------ |
| beatles-albums    | beatles-name-songs             |    27 | medium | 42/42  |
| bowie-albums      | live-aid-1985-performers       |    78 | medium | 54/54  |
| queen-albums      | hot100-number-one-two-versions |     9 | tiny   | 12/12  |
| pink-floyd-albums | hot100-14-week-number-ones     |    15 | tiny   | 17/17  |
| swift-albums      | riaa-20x-platinum-albums       |    14 | tiny   | 20/20  |
| u2-studio-albums  | vma-grammy-video-double        |     9 | tiny   | 8/8    |

## Independent guesses

`refine-R3-raw.json` (SHA-256 `93a140c613f39dc693bdc3987114d68cc7d8fa0722229f9d0f0e67febcd90bf9`) was committed before any answer data was opened and never edited. It holds eight candidate prompts; two were not used (27 Club: no pinned complete member list; non-English Hot 100 No. 1s: source predicate ambiguous for bilingual hits). `refine-R3-selected.json` preserves the six used guess lists exactly, annotating 125 genuinely wrong guesses with reasons.

## Membership and stability

- **beatles-name-songs**: title-by-title review of the main catalogue table (all 1962–1970 UK releases). My Bonnie and Sweet Georgia Brown (Tony Sheridan sessions released 1962/1964) are accepted as Too Clever. Archive releases (BBC, Anthology) fall outside the stated years.
- **live-aid-1985-performers**: every performer in the Wembley and JFK running-order tables, plus Kiki Dee and Wham! from the Elton John setlist. Satellite segments excluded. Lionel Richie is not credited on the pinned page and is not accepted.
- **hot100-number-one-two-versions**: complete nine-song list on the milestones page.
- **hot100-14-week-number-ones**: complete 14+ weeks table. No outside song can reach 14 weeks before late January 2027.
- **riaa-20x-platinum-albums**: the wording is limited to certifications before November 2026, so a mid-cycle upgrade (for example The Bodyguard, 19×) cannot make it wrong.
- **vma-grammy-video-double**: the MTV table's Grammy markers, cross-checked against the Grammy page. The next Grammy ceremony falls after the cycle.

## Reproduction

```sh
~/work/dive-venv/bin/python scripts/dive/generate.py
node scripts/dive/recall.mjs
```

Retiring the six album sets breaks fixed-count/retired-set assertions in `test_constrained.py` (prompt count 393 vs 387; retired set) and the batch-3 test in `recall.test.mjs` (it imports the now-omitted `u2-studio-albums` module), as expected for the parent merge.
