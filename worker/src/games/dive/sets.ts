import { loaders } from './loaders';
import type { AnswerSet } from './matcher';

export function answerSet(id: string): Promise<AnswerSet> {
  if (!Object.hasOwn(loaders, id)) throw new Error(`Unknown Dive prompt: ${id}`);
  return loaders[id]().then((module) => module.default);
}
