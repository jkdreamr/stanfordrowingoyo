import type {
  Modality,
  ExamplePlanSlot,
  ExamplePlanTotal,
  Preset,
  Zone,
  RosterInput,
} from './types';
const rowerNames = [
  'Marcus Albrecht',
  'Matteo Amodio',
  'Zander Auth',
  'Callen Berwick',
  'Barron Celli',
  'Tom Corbett',
  'Elliott Donovan-Davies',
  'Braun Endicott',
  'Maxim Ericson',
  'Augie Freijo',
  'Jack Frye',
  'Gabe George',
  'Jack Griffin',
  'Leopold Hainlein',
  'Ferdi Hainlein',
  'Raph Hardwick-Skottowe',
  'Hylton Harvey',
  'Theo Herzog',
  'Finn Lorgen',
  'Tony Madigan',
  'Chris Muehl',
  'Tyler Murphy',
  'Andrew Orio',
  'Tom Pakulis',
  'George Petrow',
  'John Piersma',
  'Dom Pucinelli',
  'Kalen Routley',
  'John Salvi',
  'Sandro Scalfi',
  'Luke Smith',
  'Danny Stephenson',
  'Ody Tubidis',
  'Charlie Vachris',
  'Philip Wolfensberger',
];
export const ROSTER: RosterInput[] = [
  ...rowerNames.map((name) => ({
    name,
    role: 'rower' as const,
    email: null,
    group_key: null,
    side: null,
    class_year: null,
  })),
  ...['Kannan Alford', 'Gabrielle Zammit', 'Ginger Bernstein'].map((name) => ({
    name,
    role: 'coxswain' as const,
    email: null,
    group_key: null,
    side: null,
    class_year: null,
  })),
  {
    name: 'Joshua Koo',
    role: 'admin',
    email: 'joskoo@stanford.edu',
    group_key: null,
    side: null,
    class_year: null,
  },
];
export const GROUP_TARGETS = { frosh: 60000, normal: 80000, u23: 100000 };
const rows: [Modality, Zone, [string, number | null][]][] = [
  [
    'erg',
    'R',
    [
      ["4x5k w/1' rest r18-20", 20000],
      ["3x6k w/1' r18-20", 18000],
      ["2x10k w/2' r18-20", 20000],
    ],
  ],
  [
    'erg',
    'R/E',
    [
      ['4x5k', 20000],
      ['3x6k', 18000],
      ["2x10k w/2'", 20000],
    ],
  ],
  [
    'erg',
    'E',
    [
      ["4x5k w/1' r18-20", 20000],
      ["3x6k w/1'", 18000],
      ["2x10k w/2'", 20000],
      ['2x8k w/90"', 16000],
      ["3x25' w/1' r18-20", null],
    ],
  ],
  [
    'erg',
    'E/D',
    [
      ["4x5k w/2' r20-22", 20000],
      ["3x6k w/2'", 18000],
      ["2x10k w/3'", 20000],
      ["2x8k w/2'", 16000],
    ],
  ],
  [
    'erg',
    'D',
    [
      ["4x5k r2'", 20000],
      ['12k', 12000],
      ["3x6k w/2'", 18000],
      ["4x4k w/2'", 16000],
    ],
  ],
  [
    'erg',
    'D/C',
    [
      ["4x4k r3'", 16000],
      ['10k r22', 10000],
      ["54' pyramid r22 (1'/3'/5'/7'/9'/8'/6'/4'/2' r1')", null],
    ],
  ],
  [
    'bike',
    'R',
    [
      ["120'", null],
      ["3x20k w/1'", 60000],
      ["5x12k w/1'", 60000],
      ["6x10k w/1'", 60000],
    ],
  ],
  [
    'bike',
    'R/E',
    [
      ["120'", null],
      ['3x20k', 60000],
      ['5x12k', 60000],
      ['6x10k', 60000],
    ],
  ],
  [
    'bike',
    'E',
    [
      ["120'", null],
      ["100'", null],
      ['80k', 80000],
      ['60k', 60000],
      ['45k', 45000],
      ["3x30k w/1'", 90000],
    ],
  ],
  [
    'bike',
    'E/D',
    [
      ["120'", null],
      ["100'", null],
      ['80k', 80000],
      ['60k', 60000],
      ['40k', 40000],
    ],
  ],
  [
    'bike',
    'D',
    [
      ["2x50' w/2'", null],
      ["90'", null],
      ['80k', 80000],
      ['60k', 60000],
      ['40k', 40000],
    ],
  ],
  ['bike', 'D/C', [["90'", null]]],
  [
    'run',
    'E',
    [
      ['Campus loop easy', 6240],
      ['Dish loop from A hall easy', 11280],
    ],
  ],
  [
    'run',
    'D',
    [
      ['Campus loop firm', 6240],
      ['Dish loop from A hall firm', 11280],
    ],
  ],
];
export const PRESETS: Preset[] = rows
  .flatMap(([modality, zone, items]) =>
    items.map(([name, distance_m]) => ({
      id: '',
      modality,
      zone,
      name,
      distance_m,
      sort: 0,
      active: true,
    })),
  )
  .map((p, i) => ({ ...p, id: 'preset-' + (i + 1), sort: i }));
export const PLAN_SLOTS: ExamplePlanSlot[] = [];
export const PLAN_TOTALS: ExamplePlanTotal[] = [];
export const FORTNIGHT_GUIDANCE = [
  { session: 'D Erg Session', splits: 'D 6k +10 ± 2.5', frequency: '1x', load: '20k+' },
  { session: 'Running', splits: 'D', frequency: '2x', load: '7.5k+' },
  { session: 'Lifting with Evan*', splits: '–', frequency: '2x', load: '10k total' },
];
export const LIFT_NOTE =
  'Extra lifts are recommended for people who have talked about it with the coaches.';
PLAN_TOTALS.push({ group_key: 'frosh', week: 1, label: '40k Equivalent + Monday PM' });
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 1,
  day: 0,
  slot: 'AM',
  kind: 'team',
  zone: 'E',
  text: 'Team Row E',
});
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 1,
  day: 0,
  slot: 'PM1',
  kind: 'team',
  zone: 'C',
  text: 'Team Erg C (counts for OYO extra meters)',
});
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 1,
  day: 1,
  slot: 'AM',
  kind: 'team',
  zone: 'C',
  text: 'Team Row C Stake Race',
});
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 1,
  day: 1,
  slot: 'PM1',
  kind: 'team',
  zone: null,
  text: 'Team Lift',
});
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 1,
  day: 2,
  slot: 'AM',
  kind: 'oyo',
  zone: 'E',
  text: "OYO E Erg 3x6k r1' (18k)",
});
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 1,
  day: 3,
  slot: 'AM',
  kind: 'team',
  zone: 'E',
  text: 'Team Row E',
});
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 1,
  day: 3,
  slot: 'PM1',
  kind: 'team',
  zone: null,
  text: 'Team Lift',
});
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 1,
  day: 4,
  slot: 'AM',
  kind: 'team',
  zone: 'E/D',
  text: 'Team Row E/D',
});
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 1,
  day: 4,
  slot: 'PM1',
  kind: 'oyo',
  zone: 'E',
  text: 'OYO E Bike 42k (14k)',
});
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 1,
  day: 4,
  slot: 'PM2',
  kind: 'oyo',
  zone: 'E',
  text: 'OYO E campus loop run (8k)',
});
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 1,
  day: 5,
  slot: 'AM',
  kind: 'team',
  zone: 'D/C',
  text: 'Team Row D/C',
});
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 1,
  day: 6,
  slot: 'AM',
  kind: 'off',
  zone: null,
  text: 'Off',
});
PLAN_TOTALS.push({ group_key: 'frosh', week: 2, label: '60k' });
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 2,
  day: 0,
  slot: 'AM',
  kind: 'team',
  zone: 'E',
  text: 'Team Row E',
});
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 2,
  day: 0,
  slot: 'PM1',
  kind: 'oyo',
  zone: 'D',
  text: "OYO D Erg 3x5k r2' (20k)",
});
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 2,
  day: 0,
  slot: 'PM2',
  kind: 'oyo',
  zone: 'D',
  text: 'OYO D campus loop run (10k)',
});
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 2,
  day: 1,
  slot: 'AM',
  kind: 'team',
  zone: 'D',
  text: 'Team Row D',
});
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 2,
  day: 1,
  slot: 'PM1',
  kind: 'team',
  zone: null,
  text: 'Team Lift',
});
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 2,
  day: 2,
  slot: 'AM',
  kind: 'oyo',
  zone: 'E',
  text: "OYO E Erg 4x5k r1' (20k)",
});
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 2,
  day: 3,
  slot: 'AM',
  kind: 'team',
  zone: 'C',
  text: "Team Row 30'r20 C Row",
});
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 2,
  day: 3,
  slot: 'PM1',
  kind: 'team',
  zone: null,
  text: 'Team Lift',
});
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 2,
  day: 4,
  slot: 'AM',
  kind: 'team',
  zone: 'E',
  text: 'Team Row E',
});
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 2,
  day: 4,
  slot: 'PM1',
  kind: 'oyo',
  zone: 'E',
  text: 'OYO 36k E bike (12k)',
});
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 2,
  day: 5,
  slot: 'AM',
  kind: 'team',
  zone: 'D/C',
  text: 'Team Row D/C',
});
PLAN_SLOTS.push({
  group_key: 'frosh',
  week: 2,
  day: 6,
  slot: 'AM',
  kind: 'off',
  zone: null,
  text: 'Off',
});
PLAN_TOTALS.push({ group_key: 'normal', week: 1, label: '60k + Monday PM' });
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 1,
  day: 0,
  slot: 'AM',
  kind: 'team',
  zone: 'E',
  text: 'Team Row E',
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 1,
  day: 0,
  slot: 'PM1',
  kind: 'team',
  zone: 'C',
  text: 'Team Erg C (counts)',
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 1,
  day: 1,
  slot: 'AM',
  kind: 'team',
  zone: 'C',
  text: 'Team Row C Stake Race',
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 1,
  day: 1,
  slot: 'PM1',
  kind: 'team',
  zone: null,
  text: 'Team Lift',
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 1,
  day: 2,
  slot: 'AM',
  kind: 'oyo',
  zone: 'E',
  text: "OYO E Erg 4x5k r1' (20k)",
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 1,
  day: 2,
  slot: 'PM1',
  kind: 'oyo',
  zone: 'E',
  text: 'OYO 36k E bike (12k)',
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 1,
  day: 3,
  slot: 'AM',
  kind: 'team',
  zone: 'E',
  text: 'Team Row E',
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 1,
  day: 3,
  slot: 'PM1',
  kind: 'team',
  zone: null,
  text: 'Team Lift',
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 1,
  day: 4,
  slot: 'AM',
  kind: 'team',
  zone: 'E/D',
  text: 'Team Row E/D',
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 1,
  day: 4,
  slot: 'PM1',
  kind: 'oyo',
  zone: 'E',
  text: 'OYO E Bike 60k (20k)',
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 1,
  day: 4,
  slot: 'PM2',
  kind: 'oyo',
  zone: 'E',
  text: 'OYO E campus loop run (8k)',
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 1,
  day: 5,
  slot: 'AM',
  kind: 'team',
  zone: 'D/C',
  text: 'Team Row D/C',
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 1,
  day: 6,
  slot: 'AM',
  kind: 'off',
  zone: null,
  text: 'Off',
});
PLAN_TOTALS.push({ group_key: 'normal', week: 2, label: '80k' });
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 2,
  day: 0,
  slot: 'AM',
  kind: 'team',
  zone: 'E',
  text: 'Team Row E',
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 2,
  day: 0,
  slot: 'PM1',
  kind: 'oyo',
  zone: 'D',
  text: "OYO D Erg 3x5k r2' (20k)",
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 2,
  day: 0,
  slot: 'PM2',
  kind: 'oyo',
  zone: 'D',
  text: 'OYO D campus loop run (10k)',
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 2,
  day: 1,
  slot: 'AM',
  kind: 'team',
  zone: 'D',
  text: 'Team Row D',
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 2,
  day: 1,
  slot: 'PM1',
  kind: 'team',
  zone: null,
  text: 'Team Lift',
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 2,
  day: 2,
  slot: 'AM',
  kind: 'oyo',
  zone: 'E',
  text: "OYO E Erg 4x5k r1' (20k)",
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 2,
  day: 2,
  slot: 'PM1',
  kind: 'oyo',
  zone: 'E',
  text: 'OYO E Bike 36k (12k)',
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 2,
  day: 3,
  slot: 'AM',
  kind: 'team',
  zone: 'C',
  text: "Team Row 30'r20 C Row",
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 2,
  day: 3,
  slot: 'PM1',
  kind: 'team',
  zone: null,
  text: 'Team Lift',
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 2,
  day: 4,
  slot: 'AM',
  kind: 'team',
  zone: 'E',
  text: 'Team Row E',
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 2,
  day: 4,
  slot: 'PM1',
  kind: 'oyo',
  zone: 'E',
  text: "OYO E Erg 3x6k r1' (18k)",
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 2,
  day: 5,
  slot: 'AM',
  kind: 'team',
  zone: 'D/C',
  text: 'Team Row D/C',
});
PLAN_SLOTS.push({
  group_key: 'normal',
  week: 2,
  day: 6,
  slot: 'AM',
  kind: 'off',
  zone: null,
  text: 'Off',
});
PLAN_TOTALS.push({ group_key: 'u23', week: 1, label: '80k + Monday PM' });
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 1,
  day: 0,
  slot: 'AM',
  kind: 'team',
  zone: 'E',
  text: 'Team Row E',
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 1,
  day: 0,
  slot: 'PM1',
  kind: 'team',
  zone: 'C',
  text: 'Team Erg C (counts)',
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 1,
  day: 1,
  slot: 'AM',
  kind: 'team',
  zone: 'C',
  text: 'Team Row C Stake Race',
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 1,
  day: 1,
  slot: 'PM1',
  kind: 'team',
  zone: null,
  text: 'Team Lift',
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 1,
  day: 2,
  slot: 'AM',
  kind: 'oyo',
  zone: 'E',
  text: "OYO E Erg 4x6k r1' (24k)",
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 1,
  day: 2,
  slot: 'PM1',
  kind: 'oyo',
  zone: 'E',
  text: 'OYO 48k E bike (16k)',
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 1,
  day: 3,
  slot: 'AM',
  kind: 'team',
  zone: 'E',
  text: 'Team Row E',
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 1,
  day: 3,
  slot: 'PM1',
  kind: 'team',
  zone: null,
  text: 'Team Lift',
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 1,
  day: 3,
  slot: 'PM2',
  kind: 'oyo',
  zone: 'E',
  text: "OYO E Erg 2x6k r1'",
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 1,
  day: 4,
  slot: 'AM',
  kind: 'team',
  zone: 'E/D',
  text: 'Team Row E/D',
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 1,
  day: 4,
  slot: 'PM1',
  kind: 'oyo',
  zone: 'E',
  text: 'OYO E Bike 60k (20k)',
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 1,
  day: 4,
  slot: 'PM2',
  kind: 'oyo',
  zone: 'E',
  text: 'OYO E campus loop run (8k)',
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 1,
  day: 5,
  slot: 'AM',
  kind: 'team',
  zone: 'D/C',
  text: 'Team Row D/C',
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 1,
  day: 6,
  slot: 'AM',
  kind: 'off',
  zone: null,
  text: 'Off',
});
PLAN_TOTALS.push({ group_key: 'u23', week: 2, label: '100k' });
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 2,
  day: 0,
  slot: 'AM',
  kind: 'team',
  zone: 'E',
  text: 'Team Row E',
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 2,
  day: 0,
  slot: 'PM1',
  kind: 'oyo',
  zone: 'D',
  text: "OYO D Erg 4x5k r2' (27k)",
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 2,
  day: 0,
  slot: 'PM2',
  kind: 'oyo',
  zone: 'D',
  text: 'OYO D campus loop run (10k)',
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 2,
  day: 1,
  slot: 'AM',
  kind: 'team',
  zone: 'D',
  text: 'Team Row D',
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 2,
  day: 1,
  slot: 'PM1',
  kind: 'team',
  zone: null,
  text: 'Team Lift',
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 2,
  day: 2,
  slot: 'AM',
  kind: 'oyo',
  zone: 'E',
  text: "OYO E Erg 4x6k r1' (24k)",
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 2,
  day: 2,
  slot: 'PM1',
  kind: 'oyo',
  zone: 'E',
  text: 'OYO 45k E bike (15k)',
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 2,
  day: 3,
  slot: 'AM',
  kind: 'team',
  zone: 'C',
  text: "Team Row 30'r20 C Row",
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 2,
  day: 3,
  slot: 'PM1',
  kind: 'team',
  zone: null,
  text: 'Team Lift',
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 2,
  day: 4,
  slot: 'AM',
  kind: 'team',
  zone: 'E',
  text: 'Team Row E',
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 2,
  day: 4,
  slot: 'PM1',
  kind: 'oyo',
  zone: 'E',
  text: "OYO E Erg 4x6k r1' (24k)",
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 2,
  day: 5,
  slot: 'AM',
  kind: 'team',
  zone: 'D/C',
  text: 'Team Row D/C',
});
PLAN_SLOTS.push({
  group_key: 'u23',
  week: 2,
  day: 6,
  slot: 'AM',
  kind: 'off',
  zone: null,
  text: 'Off',
});
