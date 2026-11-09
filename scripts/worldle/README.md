# Worldle content

Regenerate with Python 3 (standard library only):

```sh
python3 scripts/worldle/generate.py --data ~/worldle-data --verify
npx vitest run scripts/worldle
```

The external input directory must contain Natural Earth's public-domain
`ne_10m_admin_0_countries.geojson` and `ne_110m_land.geojson`, plus Google's
`google_countries.html` (the countries latitude/longitude HTML table).
Source GeoJSON is deliberately not checked in. Natural Earth: <https://www.naturalearthdata.com/>.
Google reference: <https://developers.google.com/public-data/docs/canonical/countries_csv>.

`countries.json` is the curated answer pool: 193 UN members, four additional
states, and 25 territories. Its order is the index contract for both generated
modules. Do not reorder the pool or change the schedule without explicitly
versioning the game: the test pins its SHA-256 to protect historical answers.
`shape-ids.json` contains opaque random IDs assigned once using `secrets.token_hex(8)`;
regeneration never replaces them. New countries require a newly assigned ID.

Parts overrides support a geographic `bbox` (west, south, east, north) and/or
`gapKm`. West greater than east denotes an antimeridian-crossing box.
Bounding boxes select complete polygons by their mean vertex position (circular for longitude),
not clipping coastlines. Without a box, the largest polygon seeds a connected
component with water gaps at most 400 km, estimated from boundary samples.
Negligible rocks below 1/100000 of the largest part (minimum 0.005 km²) are dropped.
Archipelago overrides retain their principal island groups. Seychelles depicts
the principal inhabited Mahé/Praslin group, not the scattered outer islands.
Malaysia includes both peninsula and Borneo; Kiribati depicts the Gilbert group.
American Samoa excludes remote Swains/Rose islands; Palau uses its main northern
group; French Polynesia uses the Society Islands; the Cook Islands use their
southern group. These prevent far-flung tiny outliers from shrinking the main
recognizable islands into specks.
Fiji excludes Rotuma and Ceva-i-Ra; Tonga retains Tongatapu, Ha'apai and Vava'u
without the remote Niuas. Seychelles retains the Mahé–Praslin–La Digue Inner Islands.

Silhouettes use spherical Lambert azimuthal equal-area projection, with two
area-weighted centroid evaluations, including holes in the centroid calculation.
Only exterior rings are drawn. Dateline wrapping is intrinsic to the projection.
The long side is 1000 units including 40 units of padding on each edge;
Douglas–Peucker starts at two units and increases only to meet the 6 KB budget.
Every kept island smaller than 26 normalized units (2.6% of the long side),
including any island collapsed by simplification, becomes a filled 26-unit
square with round-stroked corners, centred on its own bounding box. This minimum is
applied after simplification, so increasing the size-budget tolerance cannot
erase tiny islands. Enlargement affects rendering only, never geographic centroids.
The locator uses independently simplified equirectangular land geometry.

Verification checks Google matches via ISO-2 (including Natural Earth's EH
fallback) or normalized name, with explicitly documented exceptions in
`generate.py`. Google's old table omits South Sudan and Curaçao: South Sudan is
reported as unavailable, not silently matched to Sudan; Curaçao uses the
Netherlands Antilles reference, located on Curaçao. Every other country has a
numeric deviation in `verify-report.md`.

The schedule contains three permutations, encoded as two base-36 digits per
pool index. Decode pair `i` with `parseInt(packed.slice(2*i, 2*i+2), 36)`.
For a whole-day offset from `WORLDLE_START`, select
`((days % length) + length) % length`, including before the start date.
No tier-3 entry appears in the first **seven** days. The revised hard mix seeks
at most two tier-1 entries and at least two tier-3 entries each Monday–Sunday
week. With 71 tier-1 and 60 tier-3 per 222 answers, both targets are impossible
in every week. Deterministic annealing reaches the arithmetic optimum across
95 complete weeks: 22 weeks have a third tier-1 answer; apart from the opening
week, eight weeks have only one tier-3 answer, and all others have two.
The last (partial-week) day is tier 1. Permutations and the cyclic minimum
150-day repeat gap are independently asserted. The schedule uses a fixed seed;
Python's deterministic implementation and the pinned hash prevent silent drift.
