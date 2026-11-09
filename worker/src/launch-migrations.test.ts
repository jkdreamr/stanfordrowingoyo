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
  'game_results',
  'dive_answers',
  'dive_attempts',
  'game_progress',
  'reminder_sends',
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
  expect(getSetting(storage, 'schema_version')).toBe(21);
  expect(
    storage.sql
      .exec<{ name: string }>('PRAGMA table_info(users)')
      .toArray()
      .map((c) => c.name),
  ).toContain('evening_reminder');
  expect(
    storage.sql
      .exec<{ name: string }>('PRAGMA table_info(push_outbox)')
      .toArray()
      .map((c) => c.name),
  ).toContain('reminder_date');
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

it('migrates an empty database from 0 to 21 and is idempotent', async () => {
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

it('upgrades v18 transactionally with exactly 14 team-wide slots and never overwrites or reseeds edits', async () => {
  const stub = bindings.TEAM.get(bindings.TEAM.idFromName(crypto.randomUUID()));
  await runInDurableObject(stub, (_, state) => {
    const storage = state.storage;
    reset(storage);
    migrate({
      sql: storage.sql,
      transactionSync: (callback: () => unknown) => {
        const version = storage.sql
          .exec<{ value_json: string }>(
            "SELECT value_json FROM settings WHERE key='schema_version'",
          )
          .toArray()[0];
        if (!version || Number(version.value_json) < 18) return storage.transactionSync(callback);
      },
    } as DurableObjectStorage);
    expect(getSetting(storage, 'schema_version')).toBe(18);
    const legacy = ['plan_slots', 'plan_totals'].map((table) =>
      storage.sql.exec(`SELECT * FROM ${table}`).toArray(),
    );
    migrate({
      sql: storage.sql,
      transactionSync: (callback: () => unknown) => {
        if (getSetting<number>(storage, 'schema_version') < 19)
          return storage.transactionSync(callback);
      },
    } as DurableObjectStorage);
    expect(getSetting(storage, 'schema_version')).toBe(19);
    const rows = storage.sql
      .exec<{ week_start: string; day: number; slot: string; zone: string | null; text: string }>(
        'SELECT * FROM team_plan_slots ORDER BY day,slot',
      )
      .toArray();
    expect(rows).toHaveLength(14);
    expect(rows.every((row) => row.week_start === '2026-11-09' && row.zone === null)).toBe(true);
    expect(rows[0].text).toBe(
      "6:55 @ BH\n1) 15' Mobility/Activation\n2) E - 16k - w/up + 3 x 4k\n1x/2-/4-",
    );
    expect(rows.map((row) => [row.day, row.slot])).toEqual(
      Array.from({ length: 7 }, (_, day) => [
        [day, 'AM'],
        [day, 'PM1'],
      ]).flat(),
    );
    expect(storage.sql.exec('SELECT * FROM team_plan_totals').toArray()).toEqual([]);
    expect(
      storage.sql
        .exec('PRAGMA table_info(team_plan_slots)')
        .toArray()
        .some((row) => row.name === 'group_key'),
    ).toBe(false);
    storage.sql.exec("UPDATE team_plan_slots SET text='Staff edit' WHERE day=0 AND slot='AM'");
    storage.sql.exec("UPDATE settings SET value_json='18' WHERE key='schema_version'");
    migrate({
      sql: storage.sql,
      transactionSync: (callback: () => unknown) => {
        if (getSetting<number>(storage, 'schema_version') < 19)
          return storage.transactionSync(callback);
      },
    } as DurableObjectStorage);
    expect(
      storage.sql
        .exec<{ text: string }>("SELECT text FROM team_plan_slots WHERE day=0 AND slot='AM'")
        .one().text,
    ).toBe('Staff edit');
    storage.sql.exec("DELETE FROM team_plan_slots WHERE week_start='2026-11-09'");
    migrate(storage);
    expect(storage.sql.exec('SELECT * FROM team_plan_slots').toArray()).toEqual([]);
    expect(
      ['plan_slots', 'plan_totals'].map((table) =>
        storage.sql.exec(`SELECT * FROM ${table}`).toArray(),
      ),
    ).toEqual(legacy);
  });
});

it('adds private Dive attempts to v20 without changing existing answers and is idempotent', async () => {
  const stub = bindings.TEAM.get(bindings.TEAM.idFromName(crypto.randomUUID()));
  await runInDurableObject(stub, (_, state) => {
    const storage = state.storage;
    reset(storage);
    migrate({
      sql: storage.sql,
      transactionSync: (callback: () => unknown) => {
        const version = storage.sql
          .exec<{ value_json: string }>(
            "SELECT value_json FROM settings WHERE key='schema_version'",
          )
          .toArray()[0];
        if (!version || Number(version.value_json) < 20) return storage.transactionSync(callback);
      },
    } as DurableObjectStorage);
    expect(getSetting(storage, 'schema_version')).toBe(20);
    storage.sql.exec(
      "INSERT INTO dive_answers VALUES ('2026-03-09','u',0,'','',NULL,'miss',0,NULL,NULL,?)",
      now,
    );
    const before = storage.sql.exec('SELECT * FROM dive_answers').toArray();
    storage.sql.exec(
      "CREATE TRIGGER fail_dive_upgrade BEFORE UPDATE ON settings WHEN NEW.key='schema_version' AND NEW.value_json='21' BEGIN SELECT RAISE(ABORT,'attempt migration failed'); END",
    );
    expect(() => migrate(storage)).toThrow('attempt migration failed');
    expect(getSetting(storage, 'schema_version')).toBe(20);
    expect(
      storage.sql.exec("SELECT name FROM sqlite_master WHERE name='dive_attempts'").toArray(),
    ).toEqual([]);
    expect(storage.sql.exec('SELECT * FROM dive_answers').toArray()).toEqual(before);
    storage.sql.exec('DROP TRIGGER fail_dive_upgrade');
    migrate(storage);
    expectLatest(storage);
    storage.sql.exec(
      "INSERT INTO dive_attempts (date,user_id,prompt_index,started_at) VALUES ('2026-03-09','u',1,?)",
      now,
    );
    migrate(storage);
    expect(storage.sql.exec('SELECT * FROM dive_answers').toArray()).toEqual(before);
    expect(storage.sql.exec('SELECT * FROM dive_attempts').toArray()).toMatchObject([
      { user_id: 'u', prompt_index: 1, started_at: now, wrong_count: 0 },
    ]);
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
          : table === 'users'
            ? rows.map(({ evening_reminder, ...row }) => {
                expect(evening_reminder).toBe(1);
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

it('upgrades a v16 database through v17 to v21 without losing results', async () => {
  const stub = bindings.TEAM.get(bindings.TEAM.idFromName(crypto.randomUUID()));
  await runInDurableObject(stub, (_, state) => {
    const storage = state.storage;
    reset(storage);
    migrate({
      sql: storage.sql,
      transactionSync(fn: () => unknown) {
        const version = storage.sql
          .exec<{ value_json: string }>(
            "SELECT value_json FROM settings WHERE key='schema_version'",
          )
          .toArray()[0];
        if (!version || Number(version.value_json) < 16) return storage.transactionSync(fn);
      },
    } as DurableObjectStorage);
    expect(getSetting(storage, 'schema_version')).toBe(16);
    storage.sql.exec(
      "INSERT INTO game_results VALUES ('wordguess','2026-03-09','u',6,'{}',?,?)",
      now,
      now,
    );
    const versions: number[] = [];
    migrate({
      sql: storage.sql,
      transactionSync(fn: () => unknown) {
        const result = storage.transactionSync(fn);
        versions.push(getSetting<number>(storage, 'schema_version')!);
        return result;
      },
    } as DurableObjectStorage);
    expect(versions).toEqual([17, 18, 19, 20, 21]);
    expectLatest(storage);
    storage.sql.exec("INSERT INTO game_progress VALUES ('u','wordguess','2026-03-10','{}',?)", now);
    storage.sql.exec("INSERT INTO reminder_sends VALUES ('u','2026-03-10')");
    migrate(storage);
    expectLatest(storage);
    expect(storage.sql.exec('SELECT score FROM game_results').toArray()).toEqual([{ score: 6 }]);
    expect(storage.sql.exec('SELECT user_id FROM game_progress').toArray()).toEqual([
      { user_id: 'u' },
    ]);
    expect(storage.sql.exec('SELECT user_id FROM reminder_sends').toArray()).toEqual([
      { user_id: 'u' },
    ]);
  });
});
