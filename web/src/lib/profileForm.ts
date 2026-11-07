import type { ProfilePatch, User } from '../../../shared/types';
export function profileDraft(user: User) {
  return {
    name: user.name,
    group: user.group_key,
    bio: user.bio,
    side: user.side ?? '',
    year: user.class_year === null ? '' : String(user.class_year),
  };
}
export function profileValues(draft: ReturnType<typeof profileDraft>) {
  const errors: Record<string, string> = {};
  if (!draft.name.trim() || draft.name.trim().length > 100)
    errors.name = 'Enter a name up to 100 characters';
  if (draft.bio.length > 160) errors.bio = 'Keep your bio to 160 characters';
  const body: ProfilePatch = {
    name: draft.name.trim(),
    group_key: draft.group,
    bio: draft.bio,
    side: draft.side ? (draft.side as User['side']) : null,
    class_year: draft.year ? Number(draft.year) : null,
  };
  return { errors, body };
}
