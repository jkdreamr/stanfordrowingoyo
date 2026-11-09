import { dayNumber, hashSeed, mulberry32 } from '../../../shared/games/daily';

// Worker-only: never announce the replay or send the future schedule to clients.
export const REPLAY_DATE = '2026-12-03';
export const REPLAY_SOURCE = '2026-11-08';
export const CONTENT_CUTOVER = '2026-12-14';
const cutoverDay = dayNumber(CONTENT_CUTOVER);
const replayDay = dayNumber(REPLAY_DATE);
const sourceDay = dayNumber(REPLAY_SOURCE);

export function replaySource(date: string): string {
  return date === REPLAY_DATE ? REPLAY_SOURCE : date;
}

function shuffle(values: number[], seed: string): number[] {
  const random = mulberry32(hashSeed(seed));
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

/** Freeze the legacy prefix, then exhaust never-served content before any repeats. */
export function contentRotation(
  game: string,
  legacyCount: number,
  totalCount: number,
  legacyIndex: (day: number) => number,
  keyOf: (index: number) => string | number = (index) => index,
): (date: string) => number {
  let order: number[] | undefined;
  return (date) => {
    const day = dayNumber(replaySource(date));
    if (day < cutoverDay) return legacyIndex(day);
    if (!order) {
      // Reserve every legacy date since the game's 2026-01-01 seed epoch,
      // conservatively including dates before launch. The displaced replay-day
      // puzzle is still fresh unless another legacy day served it.
      const served = new Set<string | number>();
      for (let d = 0; d < cutoverDay; d++)
        served.add(keyOf(legacyIndex(d === replayDay ? sourceDay : d)));
      const fresh: number[] = [];
      const used: number[] = [];
      const added: number[] = [];
      const unique = new Set<string | number>();
      for (let i = 0; i < totalCount; i++) {
        const key = keyOf(i);
        if (unique.has(key)) continue;
        unique.add(key);
        (i >= legacyCount ? added : served.has(key) ? used : fresh).push(i);
      }
      order = [
        ...shuffle(added, `${game}:content-v2:new`),
        ...shuffle(fresh, `${game}:content-v2:fresh`),
        ...shuffle(used, `${game}:content-v2:used`),
      ];
    }
    return order[(day - cutoverDay) % order.length];
  };
}
