/// <reference types="@cloudflare/vitest-plugin/types" />
import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import type { Env } from './index';
import { migrate } from './db/migrate';
import { getSetting } from './db/settings';

const bindings = env as unknown as Env;
const now = '2026-03-09T18:00:00Z';
const featureTables = [
  'comment_mention_history',
  'content_reports',
  'user_intro',
  'entry_idempotency',
  'push_subscriptions',
  'push_outbox',
  'passkeys',
  'webauthn_challenges',
];

function reset(storage: DurableObjectStorage) {
  for (const { name } of storage.sql
    .exec<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .toArray())
    storage.sql.exec(`DROP TABLE "${name}"`);
}

function expectLatest(storage: DurableObjectStorage) {
  expect(getSetting(storage, 'schema_version')).toBe(16);
  for (const table of featureTables)
    expect(
      storage.sql
        .exec('SELECT name FROM sqlite_master WHERE type=? AND name=?', 'table', table)
        .toArray(),
    ).toHaveLength(1);
  expect(
    storage.sql
      .exec<{ name: string }>('PRAGMA table_info(comments)')
      .toArray()
      .map((column) => column.name),
  ).toContain('edited_at');
}

it('migrates an empty database from 0 to 15 and is idempotent', async () => {
  const stub = bindings.TEAM.get(bindings.TEAM.idFromName(crypto.randomUUID()));
  await runInDurableObject(stub, (_, state) => {
    const storage = state.storage;
    reset(storage);
    migrate(storage);
    expectLatest(storage);
    migrate(storage);
    expectLatest(storage);
    for (const table of featureTables)
      expect(storage.sql.exec(`SELECT * FROM ${table}`).toArray()).toEqual([]);
  });
});

it('upgrades populated v10 tables to 15 without changing existing rows', async () => {
  const stub = bindings.TEAM.get(bindings.TEAM.idFromName(crypto.randomUUID()));
  await runInDurableObject(stub, (_, state) => {
    const storage = state.storage;
    reset(storage);
    // Run only the unchanged v1–v10 transactions to construct the pre-launch schema.
    migrate({
      sql: storage.sql,
      transactionSync: (callback: () => unknown) => {
        const version = storage.sql
          .exec<{ value_json: string }>(
            "SELECT value_json FROM settings WHERE key='schema_version'",
          )
          .toArray()[0];
        if (!version || Number(version.value_json) < 10) return storage.transactionSync(callback);
      },
    } as DurableObjectStorage);
    expect(getSetting(storage, 'schema_version')).toBe(10);
    for (const table of featureTables)
      expect(
        storage.sql.exec('SELECT name FROM sqlite_master WHERE name=?', table).toArray(),
      ).toEqual([]);
    expect(
      storage.sql
        .exec<{ name: string }>('PRAGMA table_info(comments)')
        .toArray()
        .map((column) => column.name),
    ).not.toContain('edited_at');
    const sql = storage.sql;
    sql.exec(
      "INSERT INTO users (id,email,name,password_hash,password_salt,role,group_key,created_at,updated_at) VALUES ('u','rower@example.com','Rower','hash','salt','rower','normal',?,?)",
      now,
      now,
    );
    sql.exec(
      "INSERT INTO entries (id,user_id,date,week_start,modality,zone,distance_m,title,notes,mode_factor,zone_factor,equiv_m,visibility,created_at,updated_at) VALUES ('e','u','2026-03-09','2026-03-09','erg','E',6000,'Morning','Steady',1,1,6000,'team',?,?)",
      now,
      now,
    );
    sql.exec("INSERT INTO comments VALUES ('c','e','u','Keep this comment',?)", now);
    sql.exec("INSERT INTO comment_mentions VALUES ('c','e','u')");
    sql.exec("INSERT INTO notifications VALUES ('n','u','comment','u','e',?,NULL)", now);
    sql.exec("INSERT INTO sessions VALUES ('session','u',?,?)", now, now);
    sql.exec("INSERT INTO weekly_targets VALUES ('u','2026-03-09',90000)");
    sql.exec("INSERT INTO kudos VALUES ('e','u',?)", now);
    sql.exec("INSERT INTO entry_tags VALUES ('e','u',?)", now);
    sql.exec("INSERT INTO my_plans VALUES ('u','2026-03-09','[]',?)", now);
    sql.exec("INSERT INTO audit_log VALUES ('a','u','entry.create','e','{}',?)", now);
    const tables = [
      'users',
      'entries',
      'comments',
      'comment_mentions',
      'notifications',
      'sessions',
      'weekly_targets',
      'kudos',
      'entry_tags',
      'my_plans',
      'audit_log',
      'roster',
      'presets',
      'plan_slots',
      'plan_totals',
    ];
    const before = new Map(
      tables.map((table) => [table, sql.exec(`SELECT * FROM ${table} ORDER BY rowid`).toArray()]),
    );
    migrate(storage);
    expectLatest(storage);
    for (const table of tables) {
      const rows = sql.exec(`SELECT * FROM ${table} ORDER BY rowid`).toArray();
      expect(
        table === 'comments'
          ? rows.map(({ edited_at, ...row }) => {
              expect(edited_at).toBeNull();
              return row;
            })
          : rows,
      ).toEqual(before.get(table));
    }
    expect(sql.exec('SELECT * FROM comment_mention_history').toArray()).toEqual([
      { comment_id: 'c', entry_id: 'e', user_id: 'u' },
    ]);
    expect(sql.exec('SELECT user_id FROM user_intro').toArray()).toEqual([{ user_id: 'u' }]);
    sql.exec(
      "INSERT INTO content_reports VALUES ('r','entry','e','e','u','Reason','open',?,NULL,NULL)",
      now,
    );
    sql.exec("INSERT INTO entry_idempotency VALUES ('u','key','e',?)", now);
    sql.exec("INSERT INTO push_subscriptions VALUES ('endpoint','u','key','auth',?,?)", now, now);
    sql.exec(
      "INSERT INTO push_outbox (notification_id,endpoint,next_at) VALUES ('n','endpoint',0)",
    );
    sql.exec("INSERT INTO passkeys VALUES ('p','u',-7,'{}',0,'[]','','0','0','Phone',?,NULL)", now);
    sql.exec(
      "INSERT INTO webauthn_challenges VALUES ('challenge','login',NULL,NULL,?,?)",
      now,
      now,
    );
    const features = new Map(
      featureTables.map((table) => [table, sql.exec(`SELECT * FROM ${table}`).toArray()]),
    );
    migrate(storage);
    expectLatest(storage);
    for (const table of featureTables)
      expect(sql.exec(`SELECT * FROM ${table}`).toArray()).toEqual(features.get(table));
  });
});
