# Refine R2 — six constrained replacements

Facts reviewed as of **9 November 2026**. Raw brainstorm was frozen before any new source/answer fetch; selected retains every raw string, unchanged and in order. Invalid guesses have genuine membership reasons; valid variants remain in the denominator. No guesses were added after sourcing.

## Accepted surname convention

Per follow-up decision, all four people prompts keep `people: true`; `constrained.py` remains unchanged. It adds surnames unique among valid answers, even when a non-member shares one. Known accepted cases include Marshall → John Marshall, Harlan → John Marshall Harlan, Bush → George H. W. Bush, Johnson → Richard Mentor Johnson (VPs), Johnson → Boris Johnson (premiers), Washington → Bushrod Washington, Johnson → William Johnson, Clinton → George Clinton and Wilson → Henry Wilson / Harold Wilson. No extra explicit bare Marshall/Harlan/Bush/Johnson aliases were added to bypass this convention. In the congressional-president set, Johnson and Harrison each have two valid owners and therefore get no bare aliases. John Quincy Adams is the only valid Adams; auto-generated Adams is accepted despite non-member John Adams.

## Membership, tiers, recall and overlap

Overlap is intersection / smaller canonical set after the shared Python normalization, excluding aliases, against every other active constrained prompt (including the other five replacements and derived sets). Every maximum is below 50%.

### presidents-ex-congress

a US president who served in the US Congress before becoming president — **26 members**.

- Surface: Abraham Lincoln, Barack Obama, Joe Biden.
- Too Clever: John Quincy Adams.
- Pearl: William Henry Harrison.
- Recall: **26/26 (100%)**; 6 reviewed-invalid guesses; 32 frozen guesses.
- Maximum overlap: **26.92%** with `us-banknote-portraits` (7/26).

As of 9 November 2026. US House (including territorial delegates) or Senate service before the presidency; Continental Congress and Confederation Congress do not count. Excludes Washington, John Adams and Jefferson.

Members: Abraham Lincoln, Andrew Jackson, Andrew Johnson, Barack Obama, Benjamin Harrison, Franklin Pierce, George H. W. Bush, Gerald Ford, Harry S. Truman, James A. Garfield, James Buchanan, James K. Polk, James Madison, James Monroe, Joe Biden, John F. Kennedy, John Quincy Adams, John Tyler, Lyndon B. Johnson, Martin Van Buren, Millard Fillmore, Richard Nixon, Rutherford B. Hayes, Warren G. Harding, William Henry Harrison, William McKinley.

- https://en.wikipedia.org/w/index.php?title=List_of_presidents_of_the_United_States_by_other_offices_held&oldid=1374388644
  Union of Senate and House tables; every member has pre-presidency service. John Quincy Adams also served in the House after his presidency; his earlier Senate service independently qualifies. Andrew Johnson has both pre- and post-presidency Senate service.

### vps-never-president

a former US vice president who never became president — **34 members**.

- Surface: Kamala Harris, Mike Pence, Al Gore, Dick Cheney.
- Too Clever: Aaron Burr.
- Pearl: William A. Wheeler.
- Recall: **33/33 (100%)**; 3 reviewed-invalid guesses; 36 frozen guesses.
- Maximum overlap: **5.88%** with `nobel-peace` (2/34).

As of 9 November 2026. Excludes incumbent JD Vance and all 15 vice presidents who became president. Acting President is not becoming president: Dick Cheney (2002/2007) and Kamala Harris (2021) qualify.

Members: Aaron Burr, Adlai Stevenson I, Al Gore, Alben W. Barkley, Charles Curtis, Charles G. Dawes, Charles W. Fairbanks, Dan Quayle, Daniel D. Tompkins, Dick Cheney, Elbridge Gerry, Garret Hobart, George Clinton, George M. Dallas, Hannibal Hamlin, Henry A. Wallace, Henry Wilson, Hubert Humphrey, James S. Sherman, John C. Breckinridge, John C. Calhoun, John Nance Garner, Kamala Harris, Levi P. Morton, Mike Pence, Nelson Rockefeller, Richard Mentor Johnson, Schuyler Colfax, Spiro Agnew, Thomas A. Hendricks, Thomas R. Marshall, Walter Mondale, William A. Wheeler, William R. King.

- https://en.wikipedia.org/w/index.php?title=List_of_vice_presidents_of_the_United_States&oldid=1368745602
  All 50 vice presidents minus the 15 presidents listed in the other-offices-held source and incumbent JD Vance. Each retained row is a completed vice presidency, not a presidential accession.

### pms-two-queens

a British prime minister who served under Queen Victoria or Queen Elizabeth II — **25 members**.

- Surface: Winston Churchill, Margaret Thatcher, Tony Blair, Boris Johnson.
- Too Clever: Liz Truss.
- Pearl: George Hamilton-Gordon.
- Recall: **26/26 (100%)**; 5 reviewed-invalid guesses; 31 frozen guesses.
- Maximum overlap: **4.00%** with `nobel-literature` (1/25).

Service under either queen, even for only part of a term. Victoria 1837–1901; Elizabeth II 1952–2022. Excludes premiers serving only other monarchs, including Sunak, Starmer and Burnham.

Members: Alec Douglas-Home, Anthony Eden, Archibald Primrose, Benjamin Disraeli, Boris Johnson, David Cameron, Edward Heath, Edward Smith-Stanley, George Hamilton-Gordon, Gordon Brown, Harold Macmillan, Harold Wilson, Henry John Temple, James Callaghan, John Major, Liz Truss, Lord John Russell, Margaret Thatcher, Robert Gascoyne-Cecil, Robert Peel, Theresa May, Tony Blair, William Ewart Gladstone, William Lamb, Winston Churchill.

- https://en.wikipedia.org/w/index.php?title=List_of_prime_ministers_of_the_United_Kingdom&oldid=1378424861
  Reviewed monarch column across every premiership: ten distinct Victoria premiers and fifteen Elizabeth II premiers. Includes terms spanning an accession or death (Melbourne, Salisbury, Churchill and Truss); repeated terms deduplicated. Uses existing canonical identities and aliases.

### justices-thirty-years

a US Supreme Court justice who served at least 30 years on the Court — **16 members**.

- Surface: Clarence Thomas, John Marshall, William Rehnquist.
- Too Clever: Anthony Kennedy.
- Pearl: Bushrod Washington.
- Recall: **14/14 (100%)**; 18 reviewed-invalid guesses; 32 frozen guesses.
- Maximum overlap: **6.25%** with `us-banknote-portraits` (1/16).

Total Supreme Court service across associate and chief seats, as of 9 November 2026. Does not count service on lower courts. Unique-in-set surnames follow the existing people convention, including Marshall and Harlan despite non-member namesakes.

Members: Anthony Kennedy, Bushrod Washington, Byron White, Clarence Thomas, Hugo Black, James M. Wayne, John Marshall, John Marshall Harlan, John McLean, John Paul Stevens, Joseph Story, Stephen Johnson Field, William J. Brennan Jr., William Johnson, William O. Douglas, William Rehnquist.

- https://en.wikipedia.org/w/index.php?title=List_of_justices_of_the_Supreme_Court_of_the_United_States&oldid=1382428803
  Reviewed Duration column: fifteen people at least 30 years in a single seat plus William Rehnquist, whose 14 years 262 days as associate and 18 years 342 days as chief total over 33 years. Exactly sixteen distinct people. Thomas has 35 years as of 9 November 2026. Scalia served under 30 years and is excluded.

### element-symbol-words

an element whose chemical symbol is also a two-letter English word — **26 members**.

- Surface: Helium, Neon, Lithium, Sodium.
- Too Clever: Nobelium.
- Pearl: Protactinium.
- Recall: **36/36 (100%)**; 50 reviewed-invalid guesses; 86 frozen guesses.
- Maximum overlap: **27.27%** with `gaseous-elements` (3/11).

English word means membership in the pinned ENABLE word list, not an arbitrary dictionary or abbreviation. Case ignored; element names and their symbols accepted. Exact 26-element intersection, with no frequency threshold.

Members: Helium, Lithium, Beryllium, Neon, Sodium, Aluminium, Silicon, Argon, Titanium, Arsenic, Molybdenum, Silver, Indium, Barium, Lanthanum, Holmium, Erbium, Tantalum, Rhenium, Osmium, Bismuth, Astatine, Protactinium, Americium, Einsteinium, Nobelium.

- https://en.wikipedia.org/w/index.php?title=List_of_chemical_elements&oldid=1377683963
  Computed exact intersection of all 118 symbols, lowercased, with the SHA-256-pinned ENABLE dataset also listed here; require exactly two letters. No familiarity filter. All 26 qualifying rows verified against the element table.
- https://raw.githubusercontent.com/dolph/dictionary/233d25a56b9ac8bef906916ccf091a976995cce0/enable1.txt
  ENABLE commit 233d25a56b9ac8bef906916ccf091a976995cce0; SHA-256 `3f16130220645692ed49c7134e24a18504c2ca55b3c012f7290e3e77c63b1a89`.

### jupiter-spacecraft

a spacecraft that has flown past or orbited Jupiter — **9 members**.

- Surface: Voyager 1, Voyager 2, Juno.
- Too Clever: New Horizons.
- Pearl: Ulysses.
- Recall: **21/21 (100%)**; 15 reviewed-invalid guesses; 36 frozen guesses.
- Maximum overlap: **0.00%** (no shared canonical).

As of 9 November 2026; nine independent spacecraft missions reaching Jupiter. Cassini–Huygens is one mission. Galileo atmospheric probe counts with Galileo, not as an extra mission. Excludes Europa Clipper and JUICE, still en route with arrival in 2030 and 2031 respectively; excludes Earth-based/space telescopes and planned missions.

Members: Pioneer 10, Pioneer 11, Voyager 1, Voyager 2, Ulysses, Galileo, Cassini, New Horizons, Juno.

- https://en.wikipedia.org/w/index.php?title=Exploration_of_Jupiter&oldid=1376446589
  Reviewed introduction and mission-by-mission sections: Pioneer 10 (1973), Pioneer 11 (1974), Voyagers 1 and 2 (1979), Ulysses (1992; again 2004), Galileo (1995–2003), Cassini (2000), New Horizons (2007), Juno (2016 onward). Nine independent missions, repeated encounters counted once.

## Counts and source review

Counts are **26 / 34 / 25 / 16 / 26 / 9**, consistent with the expected ranges. Congressional membership was extracted from the union of Senate/House tables, and service dates checked to precede each presidency. VP exclusions were checked against the 15 presidential accessions and incumbent Vance. Premier membership was checked against the monarch column, including accession-spanning terms. Justice membership was derived from the duration column (15 single-seat tenures plus Rehnquist); Bushrod Washington and Byron White qualify, Scalia does not. Jupiter introduction and individual mission sections corroborate all nine arrivals. The chemical-symbol intersection was computed from all 118 element rows and the checksum-verified ENABLE file, with no frequency filter. Pinned source recipe extraction matches every new reviewed snapshot.

Tier rationale: obvious modern names and iconic probes/elements are Surface. The trickier valid answers are J.Q. Adams (earlier Senate service), Burr, Truss (two days under Elizabeth II), Kennedy (just over 30 years), Nobelium (No), and New Horizons (Jupiter on the way to Pluto). Pearls are less-remembered qualifying members rather than arbitrary invalid tricks.

## Verification and limitations

Generation succeeded; all six recall rates are 100%. Additional evaluator assertions covered unchanged raw/selected order, at least 30 distinct raw strings each, rejection of reviewed-invalid guesses, empty answer/corpus behavior, and malformed duplicate guesses.

**Existing tests have catalog-coupled failures; they are not reported as passing:**

- Python: 30 tests, 2 failures. Fixed count expects 387 but six replacements retain their retired originals, yielding 393. Fixed retired-ID set excludes precisely the six newly retired IDs. Remaining 28 tests passed.
- Node recall tests: 15 tests, 1 failure. The historical batch-4 test imports `apollo-moon-travellers.ts` unconditionally. Regeneration correctly omits that now-inactive, non-legacy, unreachable module. Remaining 14 tests passed.
- Worker Dive prompts: 11 tests, 1 expected failure at retired count 67 versus 73; remaining 10 passed.
- Tests were not modified because they are outside the explicit file allowlist. Updating fixed catalog assertions and skipping unreachable retired modules in the historical recall test is a follow-up for the owner.

Build dry run succeeded: **2992.15 KiB gzip**, versus the user-supplied approximate **2993.75 KiB** baseline, **−1.60 KiB** (within +1.5 KiB budget). Baseline was not independently rebuilt. No deployment occurred.

Generated Worker modules and generated reports are restored before committing; regenerate to consume these source changes. No UI/runtime/matcher/shared changes; visual verification is not applicable to this source-data edit.
