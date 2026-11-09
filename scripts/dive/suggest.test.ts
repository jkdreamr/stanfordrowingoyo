import { expect, it } from 'vitest';
import { normalizeAnswer } from '../../shared/games/dive';
import { matchAnswer, suggestAnswer } from '../../worker/src/games/dive/matcher';
import { answerSet } from '../../worker/src/games/dive/sets';
import { DIVE_SCHEDULE } from '../../worker/src/games/dive/schedule';
import { loaders } from '../../worker/src/games/dive/loaders';
import { decodedAnswers, fixtureSet } from './fixtures';

it('matches and suggests 60-character answers without overflowing distance workspaces', () => {
  const canonical = 'abcdefghij'.repeat(6);
  const set = fixtureSet(`${canonical}|g|`);
  expect(matchAnswer(canonical, set).canonical).toBe(canonical);
  expect(matchAnswer(canonical.slice(0, -2) + 'xy', set).canonical).toBe(canonical);
  const typed = canonical.slice(0, -3) + 'xyz';
  expect(typed).toHaveLength(60);
  expect(matchAnswer(typed, set).tier).toBe('miss');
  expect(suggestAnswer(typed, set)?.canonical).toBe(canonical);
  expect(matchAnswer('z'.repeat(60), set).tier).toBe('miss');
  expect(suggestAnswer('z'.repeat(60), set)).toBeNull();
});

// Prompt | canonical (or its exact registered alias) | independently written guesses.
const handwritten = `
us-national-parks|Dry Tortugas|Tortugas;Dry Tortugaz
us-national-parks|Yellowstone|Yelowstoon;Yellostonee
best-actor|Leonardo DiCaprio|Leo Dicaprio;Leonardo Decapreo
best-actor|Matthew McConaughey|Mathew Maconahay;Matthew McConaghy
us-presidents|Abraham Lincoln|Abruham Linkoln;Abraham Lincon
us-presidents|George Washington|George Woshingten;Georg Washinton
physicists|Albert Einstein|Alber Einstien;Albert Einstine
composers|Ludwig van Beethoven|Ludvig van Betoven;Ludwig Beethoven
proteinogenic-amino-acids|Phenylalanine|Fenylalanene;Phenylalnine
proteinogenic-amino-acids|Tryptophan|Triptofan;Tryptofane
italian-regions|Lombardy|Lombardee;Lombardy region
italian-regions|Piedmont|Peidmont;Piedmontt
flowers|Chrysanthemum|Chrisanthemam;Chrysanthemun
flowers|Daffodil|Dafodil;Daffodill
bears|Spectacled bear|Spectakled bare;Spectacled
bears|Polar bear|Poler bare;Polar bearr
apples|Granny Smith|Grani Smitt;Granny Smth
apples|Honeycrisp|Honycrsip;Honeykrisp
tea|Chamomile|Camomille;Chamomyle
tea|Darjeeling|Darjeling;Darjeeleen
metals|Aluminium|Aluminyum;Alluminium
metals|Titanium|Tytanyum;Titaneum
planets-dwarf|Makemake|Makemakke;Makamake
planets-dwarf|Haumea|Haumaya;Haumeaa
greek-muses|Calliope|Kalliopee;Calliopee
greek-muses|Terpsichore|Terpsikore;Terpsichoree
mohs-minerals|Corundum|Korundam;Corrundum
mohs-minerals|Fluorite|Flourite;Fluoryte
rare-earth-elements|Praseodymium|Praseodimium;Praseodymiam
rare-earth-elements|Neodymium|Neodimium;Neodymiam
cat-family|Jaguar|Jaggwar;Jaguarr
cat-family|Cheetah|Cheetuh;Cheeta
gaseous-elements|Hydrogen|Hidrogen;Hydrojen
gaseous-elements|Nitrogen|Nitrojen;Nytrogen
eu-food-allergens|Crustaceans|Krustaceans;Crustacean
eu-food-allergens|Sulphites|Sulfites;Sulphytes
cranial-nerves|Trigeminal nerve|Trijeminal nerve;Trigemminal nerve
cranial-nerves|Glossopharyngeal nerve|Glossofaryngeal nerve;Glossopharangeal nerve
olympian-gods|Hephaestus|Hefestus;Hephaestos
olympian-gods|Aphrodite|Afrodyte;Aphroditee
canada-provinces|Saskatchewan|Saskachewan;Saskatchawan
canada-provinces|Newfoundland and Labrador|Newfoundland Labrador;Newfoundlend and Labradore
states-two-words|North Carolina|North Karolina;Nort Carolyna
states-two-words|New Hampshire|New Hampsheer;New Hampshirr
countries-with-z|Kazakhstan|Kazakstan;Kazakhstann
countries-with-z|Azerbaijan|Azerbijan;Azerbaijann
large-saturn-moons|Enceladus|Enkeladus;Enceladuss
large-saturn-moons|Hyperion|Hiperion;Hyperionn
cloud-genera|Cumulonimbus|Kumulonimbas;Cumulonimbuss
cloud-genera|Altostratus|Altostratous;Altostrattus
penguins|Emperor penguin|Emperer pengwin;Emperor penguen
true-seal-species|Leopard seal|Leoperd seel;Leopard seall
essential-amino-acids|Methionine|Methyonene;Methioninne
disney-princess-lineup|Cinderella|Sinderela;Cinderrella
nato-alphabet|Whiskey|Wiskey;Whiskee
si-prefixes|Quecto|Quekto;Quectoo
eightfold-path|Right mindfulness|Right mindfullnes;Mindfulness
egyptian-ennead|Nephthys|Nefthys;Nephthyss
`
  .trim()
  .split('\n')
  .flatMap((line) => {
    const [id, expected, inputs] = line.split('|');
    return inputs.split(';').map((input) => ({ id, expected, input }));
  });

const ids = [...new Set([...DIVE_SCHEDULE.flat(), ...handwritten.map(({ id }) => id)])];

it('keeps short, stopword, ambiguous and fishing guesses out; is deterministic', () => {
  const set = fixtureSet(
    'Lake Tahoe|s|\nNew York|r|\nDry Tortugas|g|\nabcdefghij|d|\nabcxefghik|m|',
  );
  for (const input of ['', '!!!', 'abc', 'ábc', 'none', 'unknown', 'lake', 'new'])
    expect(suggestAnswer(input, set), input).toBeNull();
  expect(suggestAnswer('Tortugas', set)?.canonical).toBe('Dry Tortugas');
  expect(suggestAnswer('Dry Tortugaz', set)).toEqual(suggestAnswer('Dry Tortugaz', set));
  const tie = fixtureSet('abcdefghij|s|\nabcxefghik|g|');
  expect(suggestAnswer('abcyefghil', tie)).toBeNull();
  const surname = fixtureSet('John Locke|s|locke\nNew York|g|');
  expect(suggestAnswer('lake', surname)).toBeNull();
  for (const input of ['Lake Tahoe', 'Lake Taho', 'Dry Tortugas', 'Dry Tortuga']) {
    const before = matchAnswer(input, set);
    suggestAnswer(input, set);
    expect(matchAnswer(input, set)).toEqual(before);
    expect(before.canonical).not.toBeNull();
  }
});

it('tunes scheduled and legacy positives and independent negatives with regression floors', async () => {
  const sets = new Map(
    await Promise.all(ids.map(async (id) => [id, await answerSet(id)] as const)),
  );
  expect(handwritten.length).toBeGreaterThanOrEqual(80);
  expect(new Set(handwritten.map(({ id }) => id)).size).toBeGreaterThanOrEqual(30);
  const generated: typeof handwritten = [];
  for (const [id, set] of sets) {
    const sample = decodedAnswers(set).filter(({ answer }) => normalizeAnswer(answer).length >= 10);
    for (const row of sample.filter((_, i) => i % 17 === 0).slice(0, 6)) {
      const key = normalizeAnswer(row.answer);
      // Two separated transpositions usually exceed auto-accept's two edits.
      const chars = [...key];
      for (const i of [1, key.length - 3]) [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
      generated.push({ id, expected: row.answer, input: chars.join('') });
    }
  }
  for (const [label, cases, floor] of [
    ['handwritten', handwritten, 0.75],
    ['generated', generated, 0.75],
  ] as const) {
    let eligible = 0,
      correct = 0,
      wrong = 0,
      automatic = 0;
    const misses: string[] = [];
    for (const { id, input, expected } of cases) {
      const set = sets.get(id)!;
      expect(set, id).toBeDefined();
      const canonical = matchAnswer(expected, set).canonical;
      expect(canonical, `${id}: ${expected}`).not.toBeNull();
      if (matchAnswer(input, set).canonical) {
        automatic++;
        continue;
      }
      eligible++;
      const suggestion = suggestAnswer(input, set)?.canonical;
      if (suggestion === canonical) correct++;
      else if (suggestion) {
        wrong++;
        misses.push(`${id}: ${input} -> ${suggestion} (wanted ${canonical})`);
      } else misses.push(`${id}: ${input} -> null`);
    }
    console.log(
      `${label}: total=${cases.length} auto=${automatic} eligible=${eligible} correct=${correct} wrong=${wrong} catch=${((100 * correct) / eligible).toFixed(2)}% wrong-rate=${((100 * wrong) / eligible).toFixed(2)}%`,
    );
    console.log(`${label} misses: ${misses.join('; ')}`);
    expect(correct / eligible).toBeGreaterThanOrEqual(floor);
    expect(wrong / eligible).toBeLessThanOrEqual(0.02);
  }
  let negatives = 0,
    falseSuggestions = 0,
    overlaps = 0;
  const falseCases: string[] = [];
  for (let i = 0; i < ids.length; i++) {
    const set = sets.get(ids[i])!;
    const foreign = decodedAnswers(sets.get(ids[(i + 13) % ids.length])!)
      .slice(0, 12)
      .map((r) => r.answer);
    for (const input of [
      ...foreign,
      'idk',
      'lake',
      'new',
      'cat',
      'xyz',
      'pizza',
      'banana',
      'Michael Jordan',
      'London',
      'blue',
      'United States',
      'potato',
      'I do not remember',
    ]) {
      // Exact and auto-accepted overlaps are not wrong guesses for this prompt.
      if (matchAnswer(input, set).canonical) {
        overlaps++;
        continue;
      }
      negatives++;
      const suggestion = suggestAnswer(input, set);
      if (suggestion) {
        falseSuggestions++;
        falseCases.push(`${ids[i]}: ${input} -> ${suggestion.canonical}`);
      }
    }
  }
  console.log(
    `negatives: eligible=${negatives} excluded-overlap=${overlaps} false=${falseSuggestions} false-rate=${((100 * falseSuggestions) / negatives).toFixed(2)}%`,
  );
  console.log(`false suggestions: ${falseCases.join('; ')}`);
  expect(falseSuggestions / negatives).toBeLessThanOrEqual(0.02);
});

it('reports cold and warm worst-case largest-set suggestion timings', async () => {
  const sets = await Promise.all(
    Object.keys(loaders).map(async (id) => ({ id, set: await answerSet(id) })),
  );
  sets.sort(
    (a, b) =>
      b.set.answers.length +
      Object.values(b.set.buckets).join('').length -
      a.set.answers.length -
      Object.values(a.set.buckets).join('').length,
  );
  const mostKeys = [...sets].sort(
    (a, b) =>
      Object.values(b.set.buckets).reduce((sum, bucket) => sum + bucket.split('\n').length - 2, 0) -
      Object.values(a.set.buckets).reduce((sum, bucket) => sum + bucket.split('\n').length - 2, 0),
  );
  const widest = [...sets].sort(
    (a, b) =>
      Math.max(...Object.values(b.set.buckets).map((bucket) => bucket.split('\n').length - 2)) -
      Math.max(...Object.values(a.set.buckets).map((bucket) => bucket.split('\n').length - 2)),
  );
  console.log(
    `scanned ${sets.length} loadable sets; largest key-count=${mostKeys[0].id}; widest bucket=${widest[0].id}`,
  );
  const largest = [
    ...new Map([...sets.slice(0, 5), mostKeys[0], widest[0]].map((row) => [row.id, row])).values(),
  ];
  for (const { id, set } of largest) {
    const inputs = [
      'xxxxxxxxxxxxxxxxxxxx',
      'Michael Aleksander',
      'the international association',
      'international university association',
      'university of international technologys',
      'national international museum of art',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'abcdefghijklmnopqrstuvwxyzabcdefghijklm',
      'a'.repeat(60),
      'abcdefghijklmnopqrstuvwxyz'.repeat(3).slice(0, 60),
      ...decodedAnswers(set)
        .slice(0, 20)
        .map(({ answer }) => normalizeAnswer(answer).slice(0, -3) + 'zz'),
    ];
    const times: number[] = [];
    for (let repeat = 0; repeat < 3; repeat++)
      for (const input of inputs) {
        const start = performance.now();
        suggestAnswer(input, set);
        times.push(performance.now() - start);
      }
    times.sort((a, b) => a - b);
    console.log(
      `timing ${id}: answers=${set.size} keys=${Object.values(set.buckets).reduce((sum, bucket) => sum + bucket.split('\n').length - 2, 0)} max-bucket=${Math.max(...Object.values(set.buckets).map((b) => b.split('\n').length - 2))} calls=${times.length} p95=${times[Math.floor(times.length * 0.95)].toFixed(3)}ms max=${times.at(-1)!.toFixed(3)}ms (Node wall time, not Worker CPU)`,
    );
  }
});
