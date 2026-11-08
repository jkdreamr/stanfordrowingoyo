import type { StoredUser, User, PublicUser } from '../../../shared/types';
import type { Row } from './row';
export type UserRow = Row<StoredUser>;
export function byEmail(storage: DurableObjectStorage, email: string) {
  return storage.sql.exec<UserRow>('SELECT * FROM users WHERE email = ?', email).toArray()[0];
}
export function byId(storage: DurableObjectStorage, id: string) {
  return storage.sql.exec<UserRow>('SELECT * FROM users WHERE id = ?', id).toArray()[0];
}
export function toUser(row: UserRow): User {
  const { password_hash: _hash, password_salt: _salt, ...user } = row;
  void _hash;
  void _salt;
  return {
    ...user,
    active: !!user.active,
    on_leaderboard: !!user.on_leaderboard,
    must_change_password: !!user.must_change_password,
    evening_reminder: !!user.evening_reminder,
  };
}
export function toPublicUser(row: UserRow): PublicUser {
  const {
    email: _email,
    must_change_password: _change,
    evening_reminder: _reminder,
    ...user
  } = toUser(row);
  void _reminder;
  void _email;
  void _change;
  return user;
}
