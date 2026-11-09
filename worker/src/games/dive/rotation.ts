import { DIVE_PROMPTS_PER_DAY } from '../../../../shared/games/dive';
import type { DivePrompt } from './prompts';

export function validateDiveSchedule(
  schedule: readonly (readonly string[])[],
  prompts: readonly DivePrompt[],
) {
  if (schedule.length < 64) throw new Error('Dive schedule needs at least 64 days');
  const bank = new Map(prompts.map((prompt) => [prompt.id, prompt]));
  const seen = new Set<string>();
  for (const day of schedule) {
    if (day.length !== DIVE_PROMPTS_PER_DAY) throw new Error('Dive day needs five prompts');
    const themes = new Set<string>();
    const clusters = new Set<string>();
    const sizes: number[] = [];
    let constrained = 0;
    for (const id of day) {
      const prompt = bank.get(id);
      if (!prompt || seen.has(id)) throw new Error(`Unknown or repeated Dive prompt: ${id}`);
      seen.add(id);
      if (!prompt.theme || themes.has(prompt.theme)) throw new Error('Repeated daily Dive theme');
      themes.add(prompt.theme);
      if (prompt.cluster) {
        if (clusters.has(prompt.cluster)) throw new Error('Repeated daily Dive cluster');
        clusters.add(prompt.cluster);
      }
      constrained += Number(prompt.constrained);
      sizes.push(prompt.size);
    }
    if (constrained < 3) throw new Error('Dive day needs three constrained prompts');
    if (sizes.every((size) => size <= 24) || sizes.every((size) => size > 120))
      throw new Error('Dive day needs mixed difficulties');
  }
  if (prompts.some((prompt) => prompt.constrained && !seen.has(prompt.id)))
    throw new Error('Dive schedule omitted a constrained prompt');
}
