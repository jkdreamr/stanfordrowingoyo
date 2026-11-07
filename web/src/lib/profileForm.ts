import type { ProfilePatch, User } from '../../../shared/types';
import { formatSplit, parseSplit } from './format';
export function profileDraft(user: User) {
  return {
    name: user.name,
    group: user.group_key,
    bio: user.bio,
    side: user.side ?? '',
    year: user.class_year === null ? '' : String(user.class_year),
    six: user.best6k_split_s === null ? '' : formatSplit(user.best6k_split_s),
    two: user.best2k_split_s === null ? '' : formatSplit(user.best2k_split_s),
  };
}
export function profileValues(draft: ReturnType<typeof profileDraft>) {
  const errors: Record<string, string> = {};
  if (!draft.name.trim() || draft.name.trim().length > 100)
    errors.name = 'Enter a name up to 100 characters';
  if (draft.bio.length > 160) errors.bio = 'Keep your bio to 160 characters';
  for (const key of ['six', 'two'] as const)
    if (draft[key] && (!parseSplit(draft[key]) || parseSplit(draft[key])! <= 0))
      errors[key] = 'Use m:ss.t for your split';
  const body: ProfilePatch = {
    name: draft.name.trim(),
    group_key: draft.group,
    bio: draft.bio,
    side: draft.side ? (draft.side as User['side']) : null,
    class_year: draft.year ? Number(draft.year) : null,
    best6k_split_s: draft.six ? parseSplit(draft.six) : null,
    best2k_split_s: draft.two ? parseSplit(draft.two) : null,
  };
  return { errors, body };
}
