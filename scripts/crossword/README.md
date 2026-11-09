# Mini Crossword Content

## Format

The production bank is `scripts/crossword/puzzles.json`:

```json
{
  "start": "2026-11-16",
  "puzzles": [
    {
      "grid": ["#ACE#", "HEAVY", "AGREE", "TIARA", "#STY#"],
      "across": { "1": "Top playing card" },
      "down": { "1": "Shield against threats" }
    }
  ]
}
```

The example omits the remaining clues. Supply exactly the numbered starts in
each direction, using standard row-major numbering shared by Across and Down.
Each grid is 5×5 uppercase letters with `#` blocks. Black squares are rotationally
symmetric, every maximal entry has at least three letters, every white cell is
checked in both directions, and all white cells form one orthogonally connected
component. There is no 2×2-block restriction.

Production `words.txt` contains one lowercase word per line. Every across/down
answer must be listed. The three non-word-square, blocked development puzzles
in `fixtures/sample.json` use the separate `fixtures/words.txt`; they are not the
production bank. Real content requires at least 365 puzzles. Both sources start
on November 16, 2026. Index 0 is that day's LA puzzle; after the bank ends, the
server cycles from index 0.

## Validate and Build

Load Node 24+ with `source ~/.nvm/nvm.sh`. From the repository root:

```sh
npx vitest run scripts/crossword/content.test.ts --silent=false
npm run crossword:build
```

The content test always validates the fixture. When `puzzles.json` exists, it
also validates the real bank and requires the production `words.txt`. A missing
real file skips only the real-bank case; malformed files or a missing real
dictionary fail. This test also runs in root `npm test`.

Validation checks dictionary membership, duplicate/prefix-related entries,
clue numbering and style, answer/stem leaks, connectedness, identical grids,
reuse caps (three-letter: 5; four-letter: 4; five-letter: 3), a rolling 14-day
reuse exclusion (day 1 may repeat on day 15), and exact repeated clues for the
same answer. Clues are trimmed, 3–80 characters, start with an uppercase letter,
digit, straight quote or `___`, use only straight quotes and exactly three
underscores for blanks, and have no double spaces. A trailing period is allowed
only after `etc` or an uppercase letter (such as `U.S.`). Answer checks ignore
case and nonletters, including between words; suffix stems S/ED/ES/ING are
checked when at least four letters remain. Plural-agreement heuristics print
only a warning count and never fail the bank.

The build defaults to the real bank, falling back to the fixture only when the
real file is absent. A source path can be passed explicitly:

```sh
npm run crossword:build -- scripts/crossword/fixtures/sample.json
```

Commit the generated `web/public/games/crossword.dat` and
`worker/src/games/crossword/data.ts` with content changes. The freshness test
requires them to match the default source; `npm run build` checks that puzzle
plaintext never enters web assets. The builder performs structural checks;
run the content test for the complete editorial validation.

## Freeze Played Days

`frozen.json` records an inclusive `through` date and SHA-256 of
`JSON.stringify(source.puzzles.slice(0, count))`, where count is the number of
scheduled days from `start` through that date (clamped to the bank). JSON file
indentation does not matter; puzzle values, array order and object-key order do.
The test's `FROZEN_THROUGH` constant must match the manifest. Initially both are
`2026-11-15`, the day before launch, so the frozen prefix is `[]` and its hash is
`4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`.

After days have been played:

1. Run validation against the current snapshot **before** advancing it. Never
   bless an unexpected mismatch; restore the played data instead.
2. Choose the last fully played LA date (normally yesterday), not a future date.
   Advance `FROZEN_THROUGH` in `content.test.ts` to that date.
3. From the repository root, generate the matching manifest with the same date:

   ```sh
   THROUGH=2026-11-16 node --input-type=module <<'JS'
   import { readFile, writeFile } from 'node:fs/promises';
   import { createHash } from 'node:crypto';
   import { sourcePath } from './scripts/crossword/build.mjs';
   const source = JSON.parse(await readFile(await sourcePath(), 'utf8'));
   const through = process.env.THROUGH;
   const count = Math.max(0, Math.floor((Date.parse(through) - Date.parse(source.start)) / 86400000) + 1);
   const sha256 = createHash('sha256').update(JSON.stringify(source.puzzles.slice(0, count))).digest('hex');
   await writeFile('scripts/crossword/frozen.json', JSON.stringify({ through, sha256 }, null, 2) + '\n');
   JS
   ```

4. Run validation again, review the manifest and constant, and commit them
   together. When real content is present, only that bank supplies the frozen
   prefix; fixture validation remains independent.

Never rewrite the source start date or played puzzles to fix a validation error.
Preserve cycled days too: extending a bank after cycling can change already-played
dates even if its original prefix is unchanged.
