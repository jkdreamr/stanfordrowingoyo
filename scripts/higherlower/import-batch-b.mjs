import assert from 'node:assert/strict';
import { categoryCopy } from './copy.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { URL } from 'node:url';
import console from 'node:console';
import { fetchRecords, recordsFromTable } from './verify.mjs';
import { validateFacts } from './generate.mjs';

const root = new URL('./', import.meta.url);
const bank = JSON.parse(await readFile(new URL('facts.json', root), 'utf8'));
const sources = JSON.parse(await readFile(new URL('sources.json', root), 'utf8'));
const wiki = (oldid, header, columns, nameColumn, valueColumn, extra = {}) => ({
  kind: 'wiki',
  url: `https://en.wikipedia.org/w/api.php?action=parse&oldid=${oldid}&prop=text&format=json`,
  header,
  columns,
  nameColumn,
  valueColumn,
  ...extra,
});
const definitions = [
  {
    id: 'mountain-elevation',
    question: 'Which mountain summit is higher?',
    higherLabel: 'Higher',
    lowerLabel: 'Lower',
    unit: 'm',
    asOf: null,
    source:
      'Summit elevation above sea level, whole metres, as tabulated in Wikipedia revision 1324904563 (2025-11-30). Selected named peaks; excludes duplicate/ambiguous summit names and known superseded measurements (including Everest, Denali, Mont Blanc and Aoraki). Not prominence or base-to-summit height.',
    spec: wiki(1324904563, 'Mountain Metres Feet', 4, 0, 1, { allTables: true }),
  },
  {
    id: 'building-height',
    question: 'Which completed building is taller?',
    higherLabel: 'Taller',
    lowerLabel: 'Shorter',
    unit: 'm',
    asOf: 2025,
    source:
      'CTBUH architectural height (includes spires, excludes antennae), completed buildings only, as transcribed in Wikipedia revision 1327981295 (2025-12-17), first ranked height table. Not tip height or highest occupied floor. City identifies the building.',
    spec: wiki(1327981295, 'Name Height Floors', 10, 1, 2, { detailColumn: 6 }),
  },
  {
    id: 'solar-diameter',
    question: 'Which solar-system body has a larger mean diameter?',
    higherLabel: 'Larger',
    lowerLabel: 'Smaller',
    unit: 'km',
    asOf: null,
    source:
      'NASA/JPL Solar System Dynamics Planetary and Satellite Physical Parameters: mean diameter = twice mean radius in km (not maximum axis). Eight planets, Ceres/Pluto/Makemake and 19 well-measured round moons at least 200 km across; excludes irregular moons and uncertain dwarf-planet estimates. Display rounded to whole km. Satellite source: https://ssd.jpl.nasa.gov/sats/phys_par/ . Later measurement revisions are reported by verification.',
    spec: {
      kind: 'solar',
      url: 'https://ssd.jpl.nasa.gov/planets/phys_par.html',
      names:
        'Mercury|Venus|Earth|Mars|Jupiter|Saturn|Uranus|Neptune|Ceres|Pluto|Makemake|Moon|Io|Europa|Ganymede|Callisto|Mimas|Enceladus|Tethys|Dione|Rhea|Titan|Iapetus|Ariel|Umbriel|Titania|Oberon|Miranda|Triton|Charon'.split(
          '|',
        ),
      sources: [
        {
          kind: 'html',
          url: 'https://ssd.jpl.nasa.gov/planets/phys_par.html',
          header: 'Planet Equatorial Radius',
          columns: 11,
          nameColumn: 0,
          valueColumn: 2,
          multiplier: 2,
          allTables: true,
        },
        {
          kind: 'html',
          url: 'https://ssd.jpl.nasa.gov/sats/phys_par/',
          header: 'Planet Satellite Code GM',
          columns: 6,
          nameColumn: 1,
          valueColumn: 4,
          detailColumn: 0,
          multiplier: 2,
        },
      ],
    },
  },
  {
    id: 'food-energy',
    question: 'Which food has more kcal per 100 g?',
    higherLabel: 'More energy',
    lowerLabel: 'Less energy',
    unit: 'kcal',
    asOf: 2018,
    source:
      'USDA FoodData Central SR Legacy April 2018 release, nutrient 1008 (Energy, kcal), per 100 g edible portion, not per serving. Exact entry descriptions and FDC ids are in per-fact sources. Preparation state is part of the item definition; cooked foods are without added salt unless specified.',
    spec: {
      kind: 'usda',
      url: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip',
    },
  },
  {
    id: 'airport-passengers',
    question: 'Which airport handled more passengers in 2019?',
    higherLabel: 'More passengers',
    lowerLabel: 'Fewer passengers',
    unit: 'passengers',
    asOf: 2019,
    source:
      'ACI total airport passengers in calendar 2019, arrivals plus departures; airport, not metropolitan airport system. ACI table transcribed in Wikipedia revision 1316727930 (2025-10-14), 2019 section. IATA code identifies each airport.',
    spec: wiki(1316727930, 'Rank Airport Location Country', 8, 4, 5),
  },
  {
    id: 'film-gross',
    question: 'Which film grossed more worldwide as of 2025?',
    higherLabel: 'More gross',
    lowerLabel: 'Less gross',
    unit: 'usd',
    asOf: 2025,
    source:
      'Worldwide nominal theatrical box-office gross in US dollars, including re-releases through the pinned 2025-12-31 table; not inflation-adjusted, revenue from streaming or profit. Box Office Mojo/The Numbers figures as cited individually in Wikipedia revision 1330525225. Films first released after 2023 excluded to avoid active first runs; remake titles include release year.',
    spec: wiki(1330525225, 'Rank Peak Title Worldwide gross', 6, 2, 3, {
      detailColumn: 4,
      currency: true,
    }),
  },
  {
    id: 'nba-career-points',
    question: 'Which retired NBA player scored more career points?',
    higherLabel: 'More points',
    lowerLabel: 'Fewer points',
    unit: 'points',
    asOf: null,
    source:
      'Basketball-Reference NBA career regular-season points, NBA table only (not combined NBA/ABA, playoffs or international play). Retired Hall of Fame players only; asterisk denotes Hall of Fame induction, which requires retirement. Final career totals are stable; live page checked on access date.',
    spec: {
      kind: 'html',
      url: 'https://www.basketball-reference.com/leaders/pts_career.html',
      header: 'Rank Player PTS',
      tableIndex: 1,
      columns: 3,
      nameColumn: 1,
      valueColumn: 2,
    },
  },
  {
    id: 'national-park-area',
    question: 'Which US national park has more area?',
    higherLabel: 'Larger',
    lowerLabel: 'Smaller',
    unit: 'km2',
    asOf: 2023,
    source:
      'NPS 2023 park acreage as transcribed in Wikipedia revision 1326671800 (2025-12-10), Area (2023) column. Park unit only, excluding separately counted adjoining national preserves. Acres converted using exactly 0.0040468564224 km²/acre and rounded to 0.1 km². Not land-only area.',
    spec: wiki(1326671800, 'Area (2023)', 7, 0, 4, { multiplier: 0.0040468564224, scale: 10 }),
  },
];
const mountainNames = new Set(
  'K2|Kangchenjunga|Lhotse|Makalu|Cho Oyu|Dhaulagiri|Manaslu|Nanga Parbat|Annapurna|Broad Peak|Shishapangma|Mount Logan|Cotopaxi|Mount Kilimanjaro|Mount Elbrus|Pico de Orizaba|Mount Damavand|Mount Saint Elias|Mount Kenya|Mount Ararat|Mount Stanley|Vinson Massif|Matterhorn|Mount Whitney|Mount Rainier|Mount Shasta|Mount Elgon|Pikes Peak|Finsteraarhorn|Aletschhorn|Jungfrau|Mount Kinabalu|Eiger|Mount Robson|Grossglockner|Mount Erebus|Mount Fuji|Zugspitze|Triglav|Mount Kosciuszko|Ben Nevis|Mount Vesuvius'.split(
    '|',
  ),
);
const foods = [
  ['173944', 'Banana', 'Raw'],
  ['171688', 'Apple', 'Raw, with skin'],
  ['169097', 'Orange', 'Raw'],
  ['167762', 'Strawberry', 'Raw'],
  ['174683', 'Grape', 'Raw'],
  ['171711', 'Blueberry', 'Raw'],
  ['171705', 'Avocado', 'Raw'],
  ['172430', 'Peanut', 'Raw'],
  ['170567', 'Almond', 'Raw'],
  ['170187', 'Walnut', 'English, raw'],
  ['173410', 'Butter', 'Salted'],
  ['171413', 'Olive oil', 'Salad/cooking'],
  ['169655', 'Sugar', 'Granulated'],
  ['169640', 'Honey', ''],
  ['168878', 'White rice', 'Cooked, long-grain, enriched'],
  ['169737', 'Pasta', 'Cooked, enriched'],
  ['174924', 'White bread', 'Commercially prepared'],
  ['171287', 'Egg', 'Whole, raw'],
  ['171265', 'Whole milk', '3.25% fat, added vitamin D'],
  ['171284', 'Plain yogurt', 'Whole milk'],
  ['170273', 'Dark chocolate', '70–85% cacao'],
  ['167587', 'Milk chocolate', ''],
  ['172421', 'Lentil', 'Cooked, boiled'],
  ['173757', 'Chickpea', 'Cooked, boiled'],
  ['173735', 'Black bean', 'Cooked, boiled'],
  ['170379', 'Broccoli', 'Raw'],
  ['170393', 'Carrot', 'Raw'],
  ['168462', 'Spinach', 'Raw'],
  ['170457', 'Tomato', 'Raw'],
  ['168409', 'Cucumber', 'Raw, with peel'],
  ['169248', 'Iceberg lettuce', 'Raw'],
  ['170438', 'Potato', 'Boiled, flesh only'],
  ['168483', 'Sweet potato', 'Baked, flesh only'],
  ['168191', 'Date', 'Medjool'],
  ['173941', 'Dried apricot', 'Sulfured, uncooked'],
  ['173904', 'Oat', 'Dry, unfortified'],
  ['168872', 'Oat bran', 'Raw'],
  ['168917', 'Quinoa', 'Cooked'],
  ['169998', 'Sweet corn', 'Yellow, raw'],
  ['169251', 'White mushroom', 'Raw'],
  ['172470', 'Peanut butter', 'Smooth, unsalted'],
  ['170150', 'Sesame seed', 'Whole, dried'],
  ['170554', 'Chia seed', 'Dried'],
  ['170562', 'Sunflower seed', 'Kernel, dried'],
  ['172475', 'Firm tofu', 'Raw, calcium sulfate'],
  ['171998', 'Atlantic salmon', 'Wild, cooked, dry heat'],
  ['171477', 'Chicken breast', 'Meat only, roasted'],
  ['174032', 'Beef patty', '85% lean, broiled'],
];
for (const d of definitions) {
  const spec = d.spec;
  const raw = await fetchRecords(spec);
  let records = ['usda', 'solar'].includes(spec.kind) ? raw : recordsFromTable(raw, spec);
  if (d.id === 'mountain-elevation') records = records.filter((r) => mountainNames.has(r.name));
  if (d.id === 'building-height') records = records.slice(0, 48);
  if (d.id === 'nba-career-points')
    records = records.filter((r) => r.name.endsWith('*')).slice(0, 50);
  if (d.id === 'film-gross') records = records.filter((r) => Number(r.detail) <= 2023).slice(0, 40);
  if (d.id === 'food-energy')
    records = foods.map(([id]) => {
      const r = records.find((r) => r.key === id);
      assert(r, `Missing FDC ${id}`);
      return r;
    });
  spec.keys = {};
  const facts = records.map((r) => {
    let name = r.name.replace(/[†‡*]/g, '').trim(),
      detail = r.detail || undefined;
    let source;
    if (d.id === 'airport-passengers') {
      name = r.cells[1].replace(/ International Airport| Airport/g, '');
      detail = r.key.split('/')[0];
    }
    if (d.id === 'food-energy') {
      const f = foods.find((f) => f[0] === r.key);
      name = f[1];
      detail = f[2] || undefined;
      source = `USDA FDC ${r.key}: ${r.name}. https://fdc.nal.usda.gov/food-details/${r.key}/nutrients`;
    }
    spec.keys[name] = r.key;
    const value = spec.scale ? Math.round(r.value * spec.scale) / spec.scale : r.value;
    return {
      name,
      ...(detail ? { detail } : {}),
      value,
      ...(source ? { source } : {}),
      ...(/K2|Kilimanjaro|Fuji|Empire State|Chrysler|Titan|Ganymede|Triton|Charon|Avocado|Peanut|Quinoa|Dark chocolate|Yogurt|Bean|Chicken|Denver|Dubai|Dallas|Atlanta|Titanic|Frozen|Barbie|Lion King|Shaquille|Tim Duncan|John Stockton|Yosemite|Death Valley|Yellowstone|Everglades/.test(
        name,
      )
        ? { surprise: true }
        : {}),
    };
  });
  assert(
    facts.length >= (d.id === 'solar-diameter' ? 21 : 40) && facts.length <= 64,
    `${d.id}: ${facts.length}`,
  );
  const category = {
    id: d.id,
    question: d.question,
    higherLabel: d.higherLabel,
    lowerLabel: d.lowerLabel,
    unit: d.unit,
    asOf: d.asOf,
    ...categoryCopy[d.id],
    source: `${d.source} URL: ${spec.url} Accessed 2026-11-09.`,
    facts,
  };
  bank.categories = bank.categories.filter((c) => c.id !== d.id && c.id !== 'moon-diameter');
  delete sources['moon-diameter'];
  bank.categories.push(category);
  sources[d.id] = spec;
  console.log(`${d.id}: ${facts.length}`);
}
validateFacts(bank.categories);
await writeFile(new URL('facts.json', root), JSON.stringify(bank, null, 2) + '\n');
await writeFile(new URL('sources.json', root), JSON.stringify(sources, null, 2) + '\n');
