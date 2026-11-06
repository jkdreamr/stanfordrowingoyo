import type { RosterRow } from '../../../shared/types';
import type { Row } from './row';
export function findRoster(storage: DurableObjectStorage, email: string) {
  return storage.sql
    .exec<Row<RosterRow>>('SELECT * FROM roster WHERE lower(email) = lower(?)', email)
    .toArray()[0];
}
export function rosterById(storage: DurableObjectStorage, id: string) {
  return storage.sql.exec<Row<RosterRow>>('SELECT * FROM roster WHERE id = ?', id).toArray()[0];
}
