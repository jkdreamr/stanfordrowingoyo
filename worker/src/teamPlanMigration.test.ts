/// <reference types="@cloudflare/vitest-plugin/types" />
import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import type { Env } from './index';
import { migrate } from './db/migrate';
import { getPlan } from './db/plan';
import { getSetting } from './db/settings';
import { TEAM_PLAN_CURRENT_SLOTS } from '../../shared/teamPlan';

const bindings = env as unknown as Env;
it('adds Thomas Kelley once on v19 upgrades and preserves a case-insensitive manual roster row', async () => {
  await database((storage) => {
    v19(storage);
    migrate(storage);
    const rows = storage.sql
      .exec("SELECT * FROM roster WHERE lower(name)='thomas kelley'")
      .toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'Thomas Kelley',
      role: 'rower',
      email: null,
      group_key: null,
      side: null,
      class_year: null,
      claimed_by_user_id: null,
    });
    expect(rows[0].id).toMatch(/^[0-9a-f-]{36}$/);
    migrate(storage);
    expect(
      storage.sql.exec("SELECT * FROM roster WHERE lower(name)='thomas kelley'").toArray(),
    ).toEqual(rows);
  });
  await database((storage) => {
    v19(storage);
    storage.sql.exec(
      "INSERT INTO roster (id,name,email,role,group_key,side,class_year,created_at) VALUES ('manual-thomas','tHoMaS kElLeY','thomas@example.com','rower','u23','port',2028,'2026-11-01T00:00:00Z')",
    );
    const before = storage.sql
      .exec("SELECT * FROM roster WHERE lower(name)='thomas kelley'")
      .toArray();
    migrate(storage);
    expect(
      storage.sql.exec("SELECT * FROM roster WHERE lower(name)='thomas kelley'").toArray(),
    ).toEqual(before);
  });
});
function database(callback: (storage: DurableObjectStorage) => void) {
  const stub = bindings.TEAM.get(bindings.TEAM.idFromName(crypto.randomUUID()));
  return runInDurableObject(stub, (_, state) => {
    for (const { name } of state.storage.sql
      .exec<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      .toArray())
      state.storage.sql.exec(`DROP TABLE "${name}"`);
    callback(state.storage);
  });
}
function v19(storage: DurableObjectStorage) {
  migrate({
    sql: storage.sql,
    transactionSync: (callback: () => unknown) => {
      const row = storage.sql
        .exec<{ value_json: string }>("SELECT value_json FROM settings WHERE key='schema_version'")
        .toArray()[0];
      if (!row || Number(row.value_json) < 19) return storage.transactionSync(callback);
    },
  } as DurableObjectStorage);
  expect(getSetting(storage, 'schema_version')).toBe(19);
  storage.sql.exec("DELETE FROM roster WHERE lower(name)='thomas kelley'");
}
it('upgrades v19 with only the exact seeded Monday erg set to zone B and no seeded flags', async () => {
  await database((storage) => {
    v19(storage);
    migrate(storage);
    expect(getSetting(storage, 'schema_version')).toBe(20);
    expect(
      storage.sql.exec("SELECT * FROM roster WHERE lower(name)='thomas kelley'").toArray(),
    ).toHaveLength(1);
    expect(getPlan(storage, '2026-11-09').slots).toEqual(TEAM_PLAN_CURRENT_SLOTS);
    expect(
      storage.sql.exec('SELECT counts_oyo FROM team_plan_slots WHERE counts_oyo=1').toArray(),
    ).toEqual([]);
  });
});
it('preserves staff-edited text and zone, other weeks, and a deleted target row', async () => {
  await database((storage) => {
    v19(storage);
    storage.sql.exec(
      "UPDATE team_plan_slots SET text='Staff revised erg',zone='C' WHERE day=0 AND slot='PM1'",
    );
    storage.sql.exec(
      "INSERT INTO team_plan_slots SELECT '2026-11-16',day,slot,kind,zone,text FROM team_plan_slots WHERE day=0 AND slot='AM'",
    );
    migrate(storage);
    expect(
      getPlan(storage, '2026-11-09').slots.find((row) => row.day === 0 && row.slot === 'PM1'),
    ).toMatchObject({ text: 'Staff revised erg', zone: 'C', counts_oyo: false });
    expect(getPlan(storage, '2026-11-16').slots[0]).toMatchObject({
      counts_oyo: false,
      zone: null,
    });
  });
  await database((storage) => {
    v19(storage);
    storage.sql.exec("DELETE FROM team_plan_slots WHERE day=0 AND slot='PM1'");
    migrate(storage);
    expect(getPlan(storage, '2026-11-09').slots).toHaveLength(13);
  });
});
it('guards an existing column and never reapplies the data change after v20', async () => {
  await database((storage) => {
    v19(storage);
    storage.sql.exec(
      'ALTER TABLE team_plan_slots ADD COLUMN counts_oyo INTEGER NOT NULL DEFAULT 0',
    );
    storage.sql.exec("UPDATE team_plan_slots SET counts_oyo=1,zone='D' WHERE day=0 AND slot='AM'");
    migrate(storage);
    expect(getPlan(storage, '2026-11-09').slots[0]).toMatchObject({ counts_oyo: true, zone: 'D' });
    storage.sql.exec(
      "UPDATE team_plan_slots SET counts_oyo=0,zone=NULL WHERE day=0 AND slot='PM1'",
    );
    migrate(storage);
    expect(getPlan(storage, '2026-11-09').slots[1]).toMatchObject({
      counts_oyo: false,
      zone: null,
    });
  });
});
it('produces the same final state on fresh databases', async () => {
  await database((storage) => {
    migrate(storage);
    expect(getSetting(storage, 'schema_version')).toBe(20);
    expect(getPlan(storage, '2026-11-09').slots).toEqual(TEAM_PLAN_CURRENT_SLOTS);
  });
});
it('rolls back the column and version if the guarded data update fails', async () => {
  await database((storage) => {
    v19(storage);
    storage.sql.exec(
      "CREATE TRIGGER fail_plan_upgrade BEFORE UPDATE ON team_plan_slots BEGIN SELECT RAISE(ABORT,'upgrade failed'); END",
    );
    expect(() => migrate(storage)).toThrow('upgrade failed');
    expect(getSetting(storage, 'schema_version')).toBe(19);
    expect(
      storage.sql
        .exec<{ name: string }>('PRAGMA table_info(team_plan_slots)')
        .toArray()
        .some((column) => column.name === 'counts_oyo'),
    ).toBe(false);
  });
});
