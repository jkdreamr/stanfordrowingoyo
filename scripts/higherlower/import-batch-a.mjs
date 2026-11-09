import assert from 'node:assert/strict';
import { categoryCopy } from './copy.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { URL } from 'node:url';
import console from 'node:console';
import { fetchRecords, recordsFromTable } from './verify.mjs';
import { validateFacts } from './generate.mjs';

const root = new URL('./', import.meta.url);
const specs = JSON.parse(await readFile(new URL('sources.json', root), 'utf8'));
const fetched = {};
for (const [id, s] of Object.entries(specs)) {
  if (id === 'country-gdp' || id === 'country-land-area') s.scale = 1;
  if (id === 'football-stadiums') s.matchDetail = true;
  if (id === 'island-area') {
    s.detailColumn = 4;
    s.matchDetail = true;
  }
  const raw = await fetchRecords(s);
  fetched[id] = ['worldbank', 'census-csv', 'density'].includes(s.kind)
    ? raw
    : recordsFromTable(raw, s);
}
const states = new Set(
  fetched['state-population']
    .filter((r) => !['District of Columbia', 'Puerto Rico'].includes(r.name))
    .map((r) => r.name),
);
assert.equal(states.size, 50);
const countries = new Set(
  'USA CAN MEX BRA ARG CHL COL PER ECU VEN GBR FRA DEU ESP PRT ITA NLD BEL CHE AUT SWE NOR DNK FIN POL CZE GRC ROU HUN UKR RUS TUR EGY MAR DZA ZAF NGA KEN ETH GHA SAU ARE ISR IRN IRQ IND CHN JPN KOR IDN MYS THA VNM PHL PAK BGD LKA AUS NZL SGP'.split(
    ' ',
  ),
);
const countryNames = {
  USA: 'United States',
  GBR: 'United Kingdom',
  KOR: 'South Korea',
  RUS: 'Russia',
  EGY: 'Egypt',
  IRN: 'Iran',
  VEN: 'Venezuela',
  VNM: 'Vietnam',
  CZE: 'Czechia',
};
const surprising =
  /Jacksonville|San Francisco|Charlotte|Columbus|Fort Worth|El Paso|Miami|Atlanta|Georgia|Michigan|Tennessee|Massachusetts|Wyoming|Vermont|Maine|Nevada|Bangladesh|Nigeria|Ethiopia|Indonesia|Pakistan|Japan|Great Britain|Java|Cuba|Ireland|Sri Lanka|Tasmania|Hispaniola|Golden Gate|Brooklyn|Humber|Mackinac|Stanford|Duke|Vanderbilt|Autzen|Gold|Tungsten|Lead|Aluminium|Magnesium|Silver|Carbon|Osmium/;
const definitions = [
  [
    'state-land-area',
    'Which state has more land area?',
    'More land',
    'Less land',
    'km2',
    2010,
    'US Census state area measurements, land only (not total area), rounded to whole km²; January 2010 boundaries.',
  ],
  [
    'state-population',
    'Which state had more residents in 2020?',
    'More people',
    'Fewer people',
    'people',
    2020,
    '2020 US Census resident population, April 1, 2020 (not overseas-inclusive apportionment population); Census apportionment historical CSV, Year=2020, Geography Type=State.',
  ],
  [
    'city-population',
    'Which US city had more residents in 2020?',
    'More people',
    'Fewer people',
    'people',
    2020,
    '2020 Census city-proper population, not metropolitan area. Incorporated/consolidated places; consolidated city-county balance boundaries follow the cited table. Column 2020 census, not the 2024 estimate. Census data transcribed by Wikipedia, revision 1329007547.',
  ],
  [
    'country-population',
    'Which country had more people in 2023?',
    'More people',
    'Fewer people',
    'people',
    2023,
    'World Bank SP.POP.TOTL, total population, 2023. Sovereign-country selection only; no regional aggregates. Figures are the pinned-year observations in the accessed release, not a forecast.',
  ],
  [
    'country-gdp',
    'Which country had a larger nominal GDP in 2023?',
    'Larger GDP',
    'Smaller GDP',
    'usd',
    2023,
    'World Bank NY.GDP.MKTP.CD, GDP in current US dollars, 2023 (nominal, not PPP). Rounded to the nearest US dollar from the accessed release.',
  ],
  [
    'country-land-area',
    'Which country had more land area in 2023?',
    'More land',
    'Less land',
    'km2',
    2023,
    'World Bank AG.LND.TOTL.K2, land area in km², 2023 (excludes inland water bodies, continental-shelf claims and exclusive economic zones). Rounded to whole km².',
  ],
  [
    'island-area',
    'Which island has more area?',
    'Larger',
    'Smaller',
    'km2',
    null,
    'Individual islands, not countries or archipelagos; excludes continental landmasses. Area in whole km² from Wikipedia island-area tables, revision 1327688960 (2025-12-15). Main island only where specified; never the full territory.',
  ],
  [
    'bridge-spans',
    'Which bridge has a longer main span?',
    'Longer',
    'Shorter',
    'm',
    2025,
    'Completed road suspension bridges opened by 2025; main suspended span in metres, not total bridge length. Excludes cable-stayed hybrids and future bridges. Wikipedia longest suspension spans, revision 1383647690; opening-year column filtered through 2025.',
  ],
  [
    'football-stadiums',
    'Which football stadium had more seats in 2025?',
    'More seats',
    'Fewer seats',
    'seats',
    2025,
    'NCAA Division I FBS home stadium listed seating capacity in the 2025-season table; not record attendance or standing-room maximum. Active stadiums only, excludes future builds. Wikipedia revision 1329747422 (2025-12-27).',
  ],
  [
    'element-density',
    'Which solid element is denser near room temperature?',
    'Denser',
    'Less dense',
    'g/cm3',
    null,
    'Solid-phase density in g/cm³ near room temperature, CRC Handbook values specifically (not the Wikipedia use row or WEL/LNG values). Named allotrope where needed. Excludes gases, liquid-phase data, uncertain forms and synthetic/radioactive entries after bismuth. Wikipedia Densities of the elements data page, revision 1258326075; CRC near r.t. rows.',
  ],
];
const categories = definitions.map(([id, question, higherLabel, lowerLabel, unit, asOf, note]) => {
  const s = specs[id];
  let records = fetched[id];
  if (id.startsWith('state-')) records = records.filter((r) => states.has(r.name));
  if (id.startsWith('country-')) records = records.filter((r) => countries.has(r.key));
  if (id === 'city-population') records = records.sort((a, b) => b.value - a.value).slice(0, 64);
  if (id === 'island-area')
    records = records
      .filter(
        (r) =>
          !['Alexander Island', 'Berkner Island', 'Thurston Island', 'Delmarva'].includes(r.name),
      )
      .slice(0, 64);
  if (id === 'bridge-spans')
    records = records.filter(
      (r) =>
        /^\d{4}$/.test(r.cells[3]) &&
        Number(r.cells[3]) <= 2025 &&
        !r.name.includes('Yavuz Sultan Selim'),
    );
  if (id === 'football-stadiums') records = records.sort((a, b) => b.value - a.value).slice(0, 64);
  if (id === 'element-density') {
    records = records
      .slice(
        0,
        records.findIndex((r) => r.name === 'Polonium (alpha)'),
      )
      .filter(
        (r) =>
          ![
            'Phosphorus (red)',
            'Phosphorus (black)',
            'Selenium (alpha)',
            'Selenium (vitreous)',
            'Tin (gray)',
            'Thulium',
            'Holmium',
            'Terbium',
          ].includes(r.name),
      );
  }
  s.keys = {};
  const facts = records.map((r) => {
    let name = id.startsWith('country-') ? (countryNames[r.key] ?? r.name) : r.name;
    if (id === 'island-area')
      name = name
        .replace(' ( Kalaallit Nunaat )', '')
        .replace(' ( Te Waipounamu )', '')
        .replace(' ( Te Ika-a-Māui )', '');
    let detail = ['city-population', 'bridge-spans', 'football-stadiums', 'island-area'].includes(
      id,
    )
      ? r.detail
      : undefined;
    if (id === 'island-area' && /^(South Island|North Island)/.test(name)) detail = 'New Zealand';
    if (id === 'island-area' && name === 'Victoria Island') detail = 'Canada';
    if (s.keys[name]) {
      name += ` (${detail})`;
    }
    s.keys[name] = r.key;
    const value =
      id === 'country-gdp' || id === 'country-land-area' ? Math.round(r.value) : r.value;
    return {
      name,
      ...(detail ? { detail } : {}),
      value,
      ...(surprising.test(name) ? { surprise: true } : {}),
    };
  });
  assert(facts.length >= 40 && facts.length <= 64, `${id}: ${facts.length}`);
  return {
    id,
    question,
    higherLabel,
    lowerLabel,
    unit,
    asOf,
    ...categoryCopy[id],
    source: `${note} URL: ${s.url} Accessed 2026-11-09.`,
    facts,
  };
});
validateFacts(categories);
await writeFile(new URL('facts.json', root), JSON.stringify({ categories }, null, 2) + '\n');
await writeFile(new URL('sources.json', root), JSON.stringify(specs, null, 2) + '\n');
console.log(categories.map((c) => `${c.id}: ${c.facts.length}`).join('\n'));
