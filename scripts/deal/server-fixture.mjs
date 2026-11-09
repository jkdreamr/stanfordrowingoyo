import { DatabaseSync } from 'node:sqlite';
import { dealRound } from '../../worker/src/games/deal/generate';

// A real in-memory SQLite adapter for Node-only feature checks and CPU timing.
// Worker integration tests use the official Cloudflare runtime instead.
export function serverFixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT, role TEXT, active INTEGER, must_change_password INTEGER);
    CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT, expires_at TEXT, created_at TEXT);
    CREATE TABLE game_progress (user_id TEXT, game TEXT, date TEXT, state_json TEXT, updated_at TEXT, PRIMARY KEY(user_id,game,date));
    CREATE TABLE game_results (game_id TEXT, date TEXT, user_id TEXT, score INTEGER, payload_json TEXT, created_at TEXT, updated_at TEXT, PRIMARY KEY(game_id,date,user_id));
  `);
  const storage = {
    sql: {
      exec(sql, ...params) {
        const statement = db.prepare(sql);
        const rows = statement.columns().length
          ? statement.all(...params)
          : (statement.run(...params), []);
        return { toArray: () => rows };
      },
    },
    transactionSync(fn) {
      db.exec('BEGIN');
      try {
        const result = fn();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
  const now = '2026-11-16T18:00:00Z',
    date = '2026-11-16';
  db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run(
    'session',
    'u0',
    '2027-01-01T00:00:00Z',
    now,
  );
  const rounds = Array.from({ length: 5 }, (_, r) => {
    const { cards, goal, parMs } = dealRound(date, r);
    return { cards, goal, parMs, timeMs: 10000, skipped: false };
  });
  for (let i = 0; i < 40; i++) {
    db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run(
      `u${i}`,
      `Rower ${i}`,
      `u${i}@example.com`,
      'admin',
      1,
      0,
    );
    db.prepare('INSERT INTO game_progress VALUES (?,?,?,?,?)').run(
      `u${i}`,
      'deal',
      date,
      JSON.stringify({ rounds, active: null }),
      now,
    );
  }
  const ctx = {
    storage,
    env: {},
    tokenHash: 'session',
    params: {},
    now: new Date(now),
    request: new globalThis.Request('https://oyo.test/api/games'),
  };
  function resetAnswer() {
    db.prepare("DELETE FROM game_results WHERE user_id='u0'").run();
    db.prepare("UPDATE game_progress SET state_json=? WHERE user_id='u0'").run(
      JSON.stringify({ rounds: rounds.slice(0, 4), active: { round: 4, started_at: now } }),
    );
    ctx.now = new Date(Date.parse(now) + 10000);
    ctx.request = new globalThis.Request('https://oyo.test/api/games/deal/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ round: 4, steps: dealRound(date, 4).solution, elapsedMs: 10000 }),
    });
  }
  return { db, ctx, resetAnswer };
}
