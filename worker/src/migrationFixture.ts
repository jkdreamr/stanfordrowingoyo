import { migrate } from './db/migrate';

export function migrateLegacyFixture(storage: DurableObjectStorage, teamCode?: string) {
  const version = storage.sql
    .exec<{ value_json: string }>("SELECT value_json FROM settings WHERE key='schema_version'")
    .toArray()[0];
  // Legacy fixtures rewind the version setting; restore the pre-v20 column layout too.
  if (
    Number(version?.value_json ?? 0) < 19 &&
    storage.sql
      .exec<{ name: string }>('PRAGMA table_info(team_plan_slots)')
      .toArray()
      .some((column) => column.name === 'counts_oyo')
  )
    storage.sql.exec('ALTER TABLE team_plan_slots DROP COLUMN counts_oyo');
  migrate(storage, teamCode);
}
