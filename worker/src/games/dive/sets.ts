import { loaders } from './loaders';
import { parseAnswerSet, type AnswerSet } from './matcher';

const cache = new Map<string, Promise<AnswerSet>>();
const CACHE_LIMIT = 8;

export function answerSet(id: string): Promise<AnswerSet> {
  const existing = cache.get(id);
  if (existing) {
    cache.delete(id);
    cache.set(id, existing);
    return existing;
  }
  if (!Object.hasOwn(loaders, id)) throw new Error(`Unknown Dive prompt: ${id}`);
  const pending = loaders[id]().then((module) => parseAnswerSet(module.default));
  cache.set(id, pending);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  void pending.catch(() => {
    if (cache.get(id) === pending) cache.delete(id);
  });
  return pending;
}
