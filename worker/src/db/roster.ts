import type { RosterRow } from '../../../shared/types';
import type { Row } from './row';
export function findRoster(storage: DurableObjectStorage, email: string) {
  return storage.sql
    .exec<Row<RosterRow>>('SELECT * FROM roster WHERE email = ?', email)
    .toArray()[0];
}
