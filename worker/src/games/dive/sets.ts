import { loaders } from './loaders';
import type { AnswerSet } from './matcher';

const cache = new Map<string, Promise<AnswerSet>>();

export interface DiveAssets {
  fetch(url: string): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
}

export function answerSet(env: { ASSETS: DiveAssets }, id: string): Promise<AnswerSet> {
  if (!Object.hasOwn(loaders, id)) throw new Error(`Unknown Dive prompt: ${id}`);
  let pending = cache.get(id);
  if (!pending) {
    pending = Promise.resolve()
      .then(async () => {
        const response = await env.ASSETS.fetch(
          `https://assets.invalid/_private/dive/${loaders[id]}`,
        );
        if (!response.ok) throw new Error(`Could not load Dive prompt: ${id} (${response.status})`);
        const set = (await response.json()) as AnswerSet;
        if (
          !set ||
          typeof set.answers !== 'string' ||
          !set.buckets ||
          !set.gem ||
          !Array.isArray(set.notable) ||
          !Number.isInteger(set.size) ||
          set.size < 1
        )
          throw new Error(`Invalid Dive prompt asset: ${id}`);
        return set;
      })
      .catch((error: unknown) => {
        cache.delete(id);
        throw error;
      });
    cache.set(id, pending);
  }
  return pending;
}
