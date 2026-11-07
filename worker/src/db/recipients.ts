import { invalid } from '../validate';
import { toPublicUser, type UserRow } from './users';

export function recipients(storage: DurableObjectStorage, value: unknown, self: string) {
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string'))
    return invalid('Recipients must be an array of user IDs.');
  const ids = [...new Set(value as string[])].filter((id) => id !== self);
  if (ids.length > 10) return invalid('Select at most ten teammates.');
  if (!ids.length) return [];
  const users = storage.sql
    .exec<UserRow>(
      'SELECT * FROM users WHERE active = 1 AND id IN (SELECT value FROM json_each(?)) ORDER BY name,id',
      JSON.stringify(ids),
    )
    .toArray();
  if (users.length !== ids.length) return invalid('Recipients must be active users.');
  return users.map(toPublicUser);
}

export function mentioned(body: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`@${escaped}(?=$|\\s|\\p{P})`, 'iu').test(body);
}
