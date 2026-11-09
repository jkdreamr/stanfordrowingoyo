# Immutable source snapshots

These eleven `.raw` responses are exact UTF-8 source bytes, including original CRLF,
re-acquired on 9 November 2026 and verified against R7's original SHA-256 pins.
Filenames are their SHA-256. `constrained.json` retains the original public URL in
`original_url`; generation reads only the local `dataset` path and verifies its digest.

- ALA annual challenged-book archive: `ea41dd86…`.
- Seven Open Library edition/ISBN JSON records: `7752a3e4…`, `455d87b6…`,
  `72b27c75…`, `8a0daddc…`, `76accc2a…`, `823a836b…`, `1903c6a9…`.
- Alexandra Y. Caluen publication post: `69dfdb66…`.
- Debi Gueron book page: `975ae8be…`.
- Angus & Robertson publication record: `7f9b101d…`.

No source content or checksum was changed to fit the extracted membership.
The complete catalog audit leaves only these local snapshots, positive Wikipedia/
Wiktionary revision IDs, or full 40-character commit-pinned raw GitHub URLs.
The original mutable URLs remain attribution, not regeneration dependencies.
Snapshots are build-time evidence only and are not imported into either bundle.

Run `python -m unittest discover scripts/dive` to test every local snapshot without
network or cache. `generate.py --verify-sources --check` also re-extracts all pins.
