// Leaves are card identities, including when their values coincide. Commutative
// children are unordered; associativity is not collapsed.
export function dealSolver(values: number[], division = true) {
  if (!values.length || values.length > 8 || !values.every((v) => Number.isSafeInteger(v) && v > 0))
    throw new Error('Invalid solver hand');
  const full = (1 << values.length) - 1;
  const maps: Map<number, number>[] = Array.from({ length: full }, () => new Map());
  for (let mask = 1; mask < full; mask++) {
    const out = maps[mask];
    if ((mask & (mask - 1)) === 0) {
      out.set(values[Math.log2(mask)], 1);
      continue;
    }
    const add = (v: number, c: number) => {
      if (v > 0 && Number.isSafeInteger(v)) out.set(v, (out.get(v) ?? 0) + c);
    };
    for (let a = (mask - 1) & mask; a; a = (a - 1) & mask) {
      const b = mask ^ a;
      if (a >= b) continue;
      for (const [x, cx] of maps[a])
        for (const [y, cy] of maps[b]) {
          const c = cx * cy;
          add(x + y, c);
          add(x * y, c);
          if (x > y) add(x - y, c);
          if (y > x) add(y - x, c);
          if (division) {
            if (x % y === 0) add(x / y, c);
            if (y % x === 0) add(y / x, c);
          }
        }
    }
  }
  return {
    maps,
    count(goal: number) {
      if (!Number.isSafeInteger(goal) || goal <= 0) return 0;
      if (values.length === 1) return Number(values[0] === goal);
      let count = 0;
      for (let a = (full - 1) & full; a; a = (a - 1) & full) {
        const b = full ^ a;
        if (a >= b) continue;
        const right = maps[b];
        for (const [x, c] of maps[a]) {
          const hit = (y: number) => {
            if (y > 0 && Number.isSafeInteger(y)) count += c * (right.get(y) ?? 0);
          };
          hit(goal - x);
          if (goal % x === 0) hit(goal / x);
          hit(x - goal);
          hit(x + goal);
          if (division) {
            if (x % goal === 0) hit(x / goal);
            hit(x * goal);
          }
        }
      }
      return count;
    },
  };
}
