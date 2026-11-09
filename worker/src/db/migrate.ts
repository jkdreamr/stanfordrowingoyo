import { MODE_FACTORS, ZONE_FACTORS } from '../../../shared/math';
import { today } from '../../../shared/dates';
import { TEAM_PLAN_SEED_SLOTS, TEAM_PLAN_SEED_WEEK } from '../../../shared/teamPlan';
import { GROUP_TARGETS, PRESETS, PLAN_SLOTS, PLAN_TOTALS, ROSTER } from '../../../shared/seed';
import {
  TEAM_CODE_MIN_LENGTH,
  TEAM_CODE_MAX_LENGTH,
  isValidTeamCode,
} from '../../../shared/teamCode';
function migrateV1(storage: DurableObjectStorage, teamCode?: string): void {
  const sql = storage.sql;
  sql.exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL)');
  const version = sql
    .exec<{ value_json: string }>("SELECT value_json FROM settings WHERE key = 'schema_version'")
    .toArray()[0];
  if (version && Number(JSON.parse(version.value_json)) >= 1) return;
  storage.transactionSync(() => {
    sql.exec(`CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE COLLATE NOCASE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL,
  group_key TEXT NOT NULL,
  side TEXT,
  class_year INTEGER,
  bio TEXT NOT NULL DEFAULT '',
  avatar_image_id TEXT,
  best6k_split_s REAL,
  best2k_split_s REAL,
  on_leaderboard INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS roster (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  group_key TEXT NOT NULL,
  side TEXT,
  class_year INTEGER,
  added_by TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS weekly_targets (
  user_id TEXT NOT NULL,
  week_start TEXT NOT NULL,
  target_m INTEGER NOT NULL,
  PRIMARY KEY(user_id, week_start)
);
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  week_start TEXT NOT NULL,
  modality TEXT NOT NULL,
  zone TEXT NOT NULL,
  distance_m INTEGER NOT NULL,
  duration_s INTEGER,
  avg_split_s REAL,
  stroke_rate INTEGER,
  avg_hr INTEGER,
  title TEXT NOT NULL,
  notes TEXT NOT NULL,
  preset_id TEXT,
  mode_factor REAL NOT NULL,
  zone_factor REAL NOT NULL,
  equiv_m INTEGER NOT NULL,
  visibility TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  mime TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  bytes BLOB NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS entry_images (
  entry_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY(entry_id,position)
);
CREATE TABLE IF NOT EXISTS kudos (
  entry_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(entry_id,user_id)
);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL CHECK(length(body)<=1000),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  pinned INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS presets (
  id TEXT PRIMARY KEY,
  modality TEXT NOT NULL,
  zone TEXT NOT NULL,
  name TEXT NOT NULL,
  distance_m INTEGER,
  sort INTEGER NOT NULL,
  active INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS plan_slots (
  group_key TEXT NOT NULL,
  week INTEGER NOT NULL CHECK(week IN (1,2)),
  day INTEGER NOT NULL CHECK(day BETWEEN 0 AND 6),
  slot TEXT NOT NULL,
  kind TEXT NOT NULL,
  zone TEXT,
  text TEXT NOT NULL,
  PRIMARY KEY(group_key,week,day,slot)
);
CREATE TABLE IF NOT EXISTS plan_totals (
  group_key TEXT NOT NULL,
  week INTEGER NOT NULL,
  label TEXT NOT NULL,
  PRIMARY KEY(group_key,week)
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  entry_id TEXT,
  created_at TEXT NOT NULL,
  read_at TEXT
);
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  detail_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
  email TEXT NOT NULL,
  ip TEXT NOT NULL,
  window_start TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  PRIMARY KEY(email,ip)
);
CREATE INDEX IF NOT EXISTS entries_week ON entries(week_start);
CREATE INDEX IF NOT EXISTS entries_user_date ON entries(user_id,date);`);
    let initialCode = teamCode?.trim();
    if (initialCode !== undefined && !isValidTeamCode(initialCode)) {
      console.error(
        `TEAM_CODE secret is invalid; expected ${TEAM_CODE_MIN_LENGTH}-${TEAM_CODE_MAX_LENGTH} letters, numbers, or hyphens. Using a generated code.`,
      );
      initialCode = undefined;
    }
    const settings = {
      team_code: initialCode ?? crypto.randomUUID(),
      zone_factors: ZONE_FACTORS,
      mode_factors: MODE_FACTORS,
      group_targets: GROUP_TARGETS,
      season_start: '09-01',
    };
    for (const [key, value] of Object.entries(settings))
      sql.exec('INSERT OR IGNORE INTO settings VALUES (?,?)', key, JSON.stringify(value));
    for (const p of PRESETS)
      sql.exec(
        'INSERT OR IGNORE INTO presets VALUES (?,?,?,?,?,?,?)',
        p.id,
        p.modality,
        p.zone,
        p.name,
        p.distance_m,
        p.sort,
        Number(p.active),
      );
    for (const p of PLAN_SLOTS)
      sql.exec(
        'INSERT OR IGNORE INTO plan_slots VALUES (?,?,?,?,?,?,?)',
        p.group_key,
        p.week,
        p.day,
        p.slot,
        p.kind,
        p.zone,
        p.text,
      );
    for (const p of PLAN_TOTALS)
      sql.exec('INSERT OR IGNORE INTO plan_totals VALUES (?,?,?)', p.group_key, p.week, p.label);
    sql.exec(
      "INSERT INTO settings VALUES ('schema_version','1') ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json",
    );
  });
}
export function migrate(storage: DurableObjectStorage, teamCode?: string): void {
  migrateV1(storage, teamCode);
  const sql = storage.sql;
  const version = Number(
    JSON.parse(
      sql
        .exec<{ value_json: string }>(
          'SELECT value_json FROM settings WHERE key = ?',
          'schema_version',
        )
        .one().value_json,
    ),
  );
  if (version < 2)
    storage.transactionSync(() => {
      const targets = sql
        .exec<{ value_json: string }>(
          'SELECT value_json FROM settings WHERE key = ?',
          'group_targets',
        )
        .one();
      sql.exec(
        'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json',
        'group_target_history',
        JSON.stringify([{ week_start: '2000-01-01', targets: JSON.parse(targets.value_json) }]),
      );
      sql.exec(
        'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json',
        'schema_version',
        '2',
      );
    });
  if (version < 3)
    storage.transactionSync(() => {
      sql.exec(`DROP TABLE roster;
CREATE TABLE roster (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NULL,
  role TEXT NOT NULL,
  group_key TEXT NULL,
  side TEXT,
  class_year INTEGER,
  claimed_by_user_id TEXT NULL REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED,
  added_by TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX roster_email ON roster(lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX roster_claim ON roster(claimed_by_user_id) WHERE claimed_by_user_id IS NOT NULL;`);
      seedRoster(storage);
      sql.exec(
        'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json',
        'schema_version',
        '3',
      );
    });
  if (version < 4)
    storage.transactionSync(() => {
      sql.exec(`CREATE INDEX IF NOT EXISTS entries_feed ON entries(visibility,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS entries_user_feed ON entries(user_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS comments_entry_created ON comments(entry_id,created_at,id);
CREATE INDEX IF NOT EXISTS entry_images_image ON entry_images(image_id);
CREATE INDEX IF NOT EXISTS notifications_user_created ON notifications(user_id,created_at DESC,id DESC);`);
      sql.exec(
        'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json',
        'schema_version',
        '4',
      );
    });
  if (version < 5)
    storage.transactionSync(() => {
      sql.exec(`CREATE TABLE IF NOT EXISTS reauth_grants (
  token_hash TEXT PRIMARY KEY,
  session_hash TEXT NOT NULL,
  user_id TEXT NOT NULL,
  credential_hash TEXT NOT NULL,
  credential_salt TEXT NOT NULL,
  expires_at TEXT NOT NULL
);`);
      sql.exec(
        'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json',
        'schema_version',
        '5',
      );
    });
  if (version < 6)
    storage.transactionSync(() => {
      sql.exec("UPDATE entries SET visibility = 'team' WHERE visibility = 'private'");
      sql.exec(
        'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json',
        'schema_version',
        '6',
      );
    });
  if (version < 7)
    storage.transactionSync(() => {
      sql.exec(`CREATE TABLE IF NOT EXISTS entry_tags (
  entry_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(entry_id,user_id)
);
CREATE INDEX IF NOT EXISTS entry_tags_user ON entry_tags(user_id);
CREATE TABLE IF NOT EXISTS comment_mentions (
  comment_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY(comment_id,user_id)
);
CREATE INDEX IF NOT EXISTS comment_mentions_entry ON comment_mentions(entry_id);`);
      sql.exec(
        'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json',
        'schema_version',
        '7',
      );
    });
  if (version < 8)
    storage.transactionSync(() => {
      sql.exec(`CREATE TABLE IF NOT EXISTS my_plans (
  user_id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  rest_days_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, start_date)
);
CREATE TABLE IF NOT EXISTS my_plan_sessions (
  user_id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  week INTEGER NOT NULL CHECK(week IN (1,2)),
  day INTEGER NOT NULL CHECK(day BETWEEN 0 AND 6),
  slot TEXT NOT NULL CHECK(slot IN ('AM','PM1','PM2')),
  modality TEXT NOT NULL,
  zone TEXT NOT NULL,
  distance_m INTEGER,
  note TEXT NOT NULL,
  PRIMARY KEY(user_id, start_date, week, day, slot)
);`);
      sql.exec(
        'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json',
        'schema_version',
        '8',
      );
    });
  if (version < 9)
    storage.transactionSync(() => {
      sql.exec(`CREATE TABLE IF NOT EXISTS stats_versions (
  user_id TEXT PRIMARY KEY,
  version INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS stats_counters (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  global_version INTEGER NOT NULL,
  any_version INTEGER NOT NULL
);
INSERT OR IGNORE INTO stats_counters VALUES (1,0,0);
CREATE INDEX IF NOT EXISTS entries_user_week ON entries(user_id,week_start);`);
      for (const table of ['entries', 'weekly_targets'])
        for (const event of ['INSERT', 'UPDATE', 'DELETE']) {
          const ids = event === 'INSERT' ? ['NEW'] : event === 'DELETE' ? ['OLD'] : ['NEW', 'OLD'];
          sql.exec(`CREATE TRIGGER IF NOT EXISTS stats_${table}_${event.toLowerCase()}
AFTER ${event} ON ${table} BEGIN
${ids.map((row) => `INSERT INTO stats_versions SELECT ${row}.user_id,1 WHERE ${event === 'UPDATE' && row === 'OLD' ? 'OLD.user_id != NEW.user_id' : '1'} ON CONFLICT(user_id) DO UPDATE SET version=version+1;`).join('\n')}
UPDATE stats_counters SET any_version=any_version+1 WHERE id=1;
END;`);
        }
      sql.exec(`CREATE TRIGGER IF NOT EXISTS stats_users_update
AFTER UPDATE OF id,name,role,group_key,side,class_year,bio,avatar_image_id,best6k_split_s,best2k_split_s,on_leaderboard,active,created_at ON users BEGIN
INSERT INTO stats_versions VALUES (NEW.id,1) ON CONFLICT(user_id) DO UPDATE SET version=version+1;
INSERT INTO stats_versions SELECT OLD.id,1 WHERE OLD.id != NEW.id ON CONFLICT(user_id) DO UPDATE SET version=version+1;
UPDATE stats_counters SET any_version=any_version+1 WHERE id=1;
END;`);
      for (const table of ['settings', 'users'])
        for (const event of table === 'users'
          ? ['INSERT', 'DELETE']
          : ['INSERT', 'UPDATE', 'DELETE'])
          sql.exec(`CREATE TRIGGER IF NOT EXISTS stats_${table}_${event.toLowerCase()}
AFTER ${event} ON ${table} BEGIN
UPDATE stats_counters SET global_version=global_version+1,any_version=any_version+1 WHERE id=1;
END;`);
      sql.exec(
        'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json',
        'schema_version',
        '9',
      );
    });
  if (version < 10)
    storage.transactionSync(() => {
      sql.exec(`CREATE TABLE IF NOT EXISTS erg_tests (
id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('2k','6k')),
date TEXT NOT NULL, time_s REAL NOT NULL, split_s REAL NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS erg_tests_user_kind_date ON erg_tests(user_id,kind,date);
CREATE TABLE IF NOT EXISTS challenges (
id TEXT PRIMARY KEY, title TEXT NOT NULL, unit TEXT NOT NULL CHECK(unit IN ('emeters','km')),
goal_m INTEGER NOT NULL, modality TEXT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL,
created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, ended_at TEXT NULL);
CREATE INDEX IF NOT EXISTS entries_date ON entries(date);`);
      const now = new Date().toISOString();
      for (const user of sql
        .exec<{
          id: string;
          updated_at: string;
          best2k_split_s: number | null;
          best6k_split_s: number | null;
        }>('SELECT id,updated_at,best2k_split_s,best6k_split_s FROM users')
        .toArray())
        for (const kind of ['2k', '6k'] as const) {
          const split = user[kind === '2k' ? 'best2k_split_s' : 'best6k_split_s'];
          if (split !== null)
            sql.exec(
              'INSERT INTO erg_tests SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM erg_tests WHERE user_id=? AND kind=?)',
              crypto.randomUUID(),
              user.id,
              kind,
              today(new Date(user.updated_at)),
              Math.round(split * (kind === '2k' ? 4 : 12) * 10) / 10,
              split,
              now,
              now,
              user.id,
              kind,
            );
        }
      sql.exec(
        "INSERT INTO settings VALUES ('schema_version','10') ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json",
      );
    });
  if (version < 11)
    storage.transactionSync(() => {
      if (
        !sql
          .exec<{ name: string }>('PRAGMA table_info(comments)')
          .toArray()
          .some((column) => column.name === 'edited_at')
      )
        sql.exec('ALTER TABLE comments ADD COLUMN edited_at TEXT NULL');
      sql.exec(`CREATE TABLE IF NOT EXISTS comment_mention_history (
  comment_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY(comment_id,user_id)
);
CREATE INDEX IF NOT EXISTS comment_mention_history_entry ON comment_mention_history(entry_id);
INSERT OR IGNORE INTO comment_mention_history SELECT comment_id,entry_id,user_id FROM comment_mentions;
CREATE TABLE IF NOT EXISTS content_reports (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK(target_type IN ('entry','comment')),
  target_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK(length(reason)<=300),
  status TEXT NOT NULL CHECK(status IN ('open','dismissed','deleted')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT NULL,
  reviewed_by TEXT NULL,
  UNIQUE(reporter_id,target_type,target_id)
);
CREATE INDEX IF NOT EXISTS content_reports_queue ON content_reports(status,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS content_reports_target ON content_reports(target_type,target_id,status);
CREATE INDEX IF NOT EXISTS content_reports_entry ON content_reports(entry_id,status);`);
      sql.exec(
        'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json',
        'schema_version',
        '11',
      );
    });
  if (version < 12)
    storage.transactionSync(() => {
      sql.exec(`CREATE TABLE IF NOT EXISTS user_intro (
  user_id TEXT PRIMARY KEY,
  completed_at TEXT NOT NULL
);`);
      sql.exec(
        'INSERT OR IGNORE INTO user_intro (user_id, completed_at) SELECT id, ? FROM users',
        new Date().toISOString(),
      );
      sql.exec(
        'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json',
        'schema_version',
        '12',
      );
    });
  if (version < 13)
    storage.transactionSync(() => {
      sql.exec(`CREATE TABLE IF NOT EXISTS entry_idempotency (
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id,key)
);
CREATE INDEX IF NOT EXISTS entry_idempotency_created_at ON entry_idempotency(created_at);`);
      sql.exec(
        'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json',
        'schema_version',
        '13',
      );
    });
  if (version < 14)
    storage.transactionSync(() => {
      sql.exec(`CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user ON push_subscriptions(user_id,updated_at);
CREATE TABLE IF NOT EXISTS push_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS push_outbox_due ON push_outbox(next_at,id);`);
      sql.exec(
        'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json',
        'schema_version',
        '14',
      );
    });
  if (version < 15)
    storage.transactionSync(() => {
      sql.exec(`CREATE TABLE IF NOT EXISTS passkeys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  alg INTEGER NOT NULL,
  public_key TEXT NOT NULL,
  sign_count INTEGER NOT NULL,
  transports TEXT NOT NULL,
  aaguid TEXT NOT NULL,
  backup_eligible INTEGER NOT NULL,
  backed_up INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS passkeys_user ON passkeys(user_id,created_at);
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  challenge TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('register','login')),
  user_id TEXT,
  session_hash TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS webauthn_challenges_expiry ON webauthn_challenges(expires_at);`);
      sql.exec(
        'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json',
        'schema_version',
        '15',
      );
    });
  if (version < 16)
    storage.transactionSync(() => {
      sql.exec(`CREATE TABLE IF NOT EXISTS game_results (
  game_id TEXT NOT NULL, date TEXT NOT NULL, user_id TEXT NOT NULL,
  score INTEGER NOT NULL, payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY(game_id, date, user_id));
CREATE INDEX IF NOT EXISTS game_results_user ON game_results(user_id, date);
CREATE INDEX IF NOT EXISTS game_results_date ON game_results(date, game_id);
CREATE TABLE IF NOT EXISTS dive_answers (
  date TEXT NOT NULL, user_id TEXT NOT NULL, prompt_index INTEGER NOT NULL CHECK(prompt_index BETWEEN 0 AND 6),
  answer TEXT NOT NULL, normalized TEXT NOT NULL,
  canonical TEXT, tier TEXT NOT NULL, points INTEGER NOT NULL,
  hidden_at TEXT, hidden_by TEXT, created_at TEXT NOT NULL,
  PRIMARY KEY(date, user_id, prompt_index));
CREATE INDEX IF NOT EXISTS dive_answers_group ON dive_answers(date, prompt_index, normalized);`);
      sql.exec(
        'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json',
        'schema_version',
        '16',
      );
    });
  if (version < 17)
    storage.transactionSync(() => {
      sql.exec(`CREATE TABLE IF NOT EXISTS game_progress (
  user_id TEXT NOT NULL, game TEXT NOT NULL, date TEXT NOT NULL,
  state_json TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, game, date));`);
      sql.exec(
        'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json',
        'schema_version',
        '17',
      );
    });
  if (version < 18)
    storage.transactionSync(() => {
      const columns = sql.exec<{ name: string }>('PRAGMA table_info(users)').toArray();
      if (!columns.some((column) => column.name === 'evening_reminder'))
        sql.exec('ALTER TABLE users ADD COLUMN evening_reminder INTEGER NOT NULL DEFAULT 1');
      const outbox = sql.exec<{ name: string }>('PRAGMA table_info(push_outbox)').toArray();
      if (!outbox.some((column) => column.name === 'reminder_date'))
        sql.exec('ALTER TABLE push_outbox ADD COLUMN reminder_date TEXT');
      sql.exec(`CREATE TABLE IF NOT EXISTS reminder_sends (
        user_id TEXT NOT NULL, date TEXT NOT NULL, PRIMARY KEY(user_id,date));`);
      sql.exec(
        'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json',
        'schema_version',
        '18',
      );
    });
  if (version < 19)
    storage.transactionSync(() => {
      sql.exec(`CREATE TABLE IF NOT EXISTS team_plan_slots (
        week_start TEXT NOT NULL, day INTEGER NOT NULL CHECK(day BETWEEN 0 AND 6),
        slot TEXT NOT NULL CHECK(slot IN ('AM','PM1','PM2')),
        kind TEXT NOT NULL CHECK(kind IN ('team','oyo','off')), zone TEXT, text TEXT NOT NULL,
        PRIMARY KEY(week_start,day,slot));
        CREATE TABLE IF NOT EXISTS team_plan_totals (
        week_start TEXT PRIMARY KEY NOT NULL, label TEXT NOT NULL);`);
      for (const row of TEAM_PLAN_SEED_SLOTS)
        sql.exec(
          'INSERT OR IGNORE INTO team_plan_slots VALUES (?,?,?,?,?,?)',
          TEAM_PLAN_SEED_WEEK,
          row.day,
          row.slot,
          row.kind,
          row.zone,
          row.text,
        );
      sql.exec(
        'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json',
        'schema_version',
        '19',
      );
    });
  if (version < 20)
    storage.transactionSync(() => {
      const columns = sql.exec<{ name: string }>('PRAGMA table_info(team_plan_slots)').toArray();
      if (!columns.some((column) => column.name === 'counts_oyo'))
        sql.exec('ALTER TABLE team_plan_slots ADD COLUMN counts_oyo INTEGER NOT NULL DEFAULT 0');
      const mondayErg = TEAM_PLAN_SEED_SLOTS.find((row) => row.day === 0 && row.slot === 'PM1')!;
      sql.exec(
        "UPDATE team_plan_slots SET zone='B' WHERE week_start=? AND day=0 AND slot='PM1' AND text=?",
        TEAM_PLAN_SEED_WEEK,
        mondayErg.text,
      );
      const row = ROSTER.find((row) => row.name === 'Thomas Kelley')!;
      sql.exec(
        'INSERT INTO roster (id,name,email,role,group_key,side,class_year,claimed_by_user_id,added_by,created_at) SELECT ?,?,?,?,?,?,?,NULL,NULL,? WHERE NOT EXISTS (SELECT 1 FROM roster WHERE lower(name)=lower(?))',
        crypto.randomUUID(),
        row.name,
        row.email,
        row.role,
        row.group_key,
        row.side,
        row.class_year,
        new Date().toISOString(),
        row.name,
      );
      sql.exec(
        'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json',
        'schema_version',
        '20',
      );
    });
}
export function seedRoster(storage: DurableObjectStorage): void {
  for (const row of ROSTER)
    storage.sql.exec(
      'INSERT INTO roster (id,name,email,role,group_key,side,class_year,claimed_by_user_id,added_by,created_at) SELECT ?,?,?,?,?,?,?,NULL,NULL,? WHERE NOT EXISTS (SELECT 1 FROM roster WHERE lower(name)=lower(?))',
      crypto.randomUUID(),
      row.name,
      row.email,
      row.role,
      row.group_key,
      row.side,
      row.class_year,
      new Date().toISOString(),
      row.name,
    );
}
