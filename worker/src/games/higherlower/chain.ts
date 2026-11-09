export interface ChainFact {
  value: number;
  surprise?: boolean | number;
}

export function constructChain<T extends ChainFact>(facts: readonly T[], seed: number): T[] {
  const random = () => {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  if (facts.length < 21) return [];
  const first = Math.floor(random() * facts.length);
  const indices = [first];
  const used = new Set(indices);
  let higher = 0,
    run = 0,
    last = false;
  while (indices.length < 21) {
    const a = facts[indices.at(-1)!];
    const options: { index: number; up: boolean; weight: number }[] = [];
    let total = 0;
    for (let index = 0; index < facts.length; index++) {
      if (used.has(index)) continue;
      const b = facts[index];
      const ratio = Math.max(a.value, b.value) / Math.min(a.value, b.value);
      const up = b.value > a.value;
      if (ratio < 1.1 || ratio > 3 || (run === 4 && up === last)) continue;
      const remaining = 21 - indices.length;
      if ((up && higher === 13) || (!up && higher + remaining <= 7)) continue;
      const weight =
        (ratio <= 1.4 ? 8 : 1) * (1 + Number(a.surprise ?? 0) + Number(b.surprise ?? 0));
      options.push({ index, up, weight });
      total += weight;
    }
    if (!total) return [];
    let pick = random() * total;
    const selected = options.find((o) => (pick -= o.weight) < 0) ?? options.at(-1)!;
    higher += Number(selected.up);
    run = selected.up === last ? run + 1 : 1;
    last = selected.up;
    used.add(selected.index);
    indices.push(selected.index);
  }
  return indices.map((i) => facts[i]);
}
