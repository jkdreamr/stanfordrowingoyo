import type {
  AccountDataExport,
  AccountExportMention,
  AccountExportPerson,
  AccountExportTag,
  Comment,
  Entry,
  ErgTest,
  ImageMetadata,
  Kudos,
  RosterRow,
  WeeklyTarget,
} from '../../../shared/types';
import type { Row } from './row';
import { toUser, type UserRow } from './users';
import { allMyPlans } from './myPlan';
import { csvCell } from '../csv';
import { closeReports } from './reports';

const OWN_ENTRIES = 'SELECT id FROM entries WHERE user_id = ?';
const OWN_IMAGES = 'SELECT id FROM images WHERE owner_id = ?';
export const REDACTED_AUDIT_DETAIL = JSON.stringify({
  before: null,
  after: null,
  redacted: 'account_removed',
});

function people<T extends { id: string; name: string }>(
  rows: (T & Record<string, unknown>)[],
  key: string,
) {
  const result = new Map<string, AccountExportPerson[]>();
  for (const row of rows) {
    const group = row[key] as string;
    const list = result.get(group) ?? [];
    list.push({ id: row.id, name: row.name });
    result.set(group, list);
  }
  return result;
}
function counts(rows: { entry_id: string; count: number }[]) {
  return new Map(rows.map((row) => [row.entry_id, row.count]));
}

export function accountExport(
  storage: DurableObjectStorage,
  user: UserRow,
  exportedAt: string,
): AccountDataExport {
  const sql = storage.sql;
  const id = user.id;
  const roster = sql
    .exec<Row<RosterRow>>('SELECT * FROM roster WHERE claimed_by_user_id = ?', id)
    .toArray()[0];
  const entries = sql
    .exec<Row<Entry>>('SELECT * FROM entries WHERE user_id = ? ORDER BY date,created_at,id', id)
    .toArray();
  const entryImages = sql
    .exec<Row<ImageMetadata> & { entry_id: string }>(
      'SELECT i.id,i.owner_id,i.mime,i.width,i.height,i.created_at,ei.entry_id FROM entry_images ei JOIN entries e ON e.id = ei.entry_id JOIN images i ON i.id = ei.image_id WHERE e.user_id = ? ORDER BY ei.entry_id,ei.position',
      id,
    )
    .toArray();
  const tags = people(
    sql
      .exec<{ id: string; name: string; entry_id: string }>(
        'SELECT u.id,u.name,t.entry_id FROM entry_tags t JOIN entries e ON e.id = t.entry_id JOIN users u ON u.id = t.user_id WHERE e.user_id = ? ORDER BY t.created_at,u.name,u.id',
        id,
      )
      .toArray(),
    'entry_id',
  );
  const imagesByEntry = new Map<string, ImageMetadata[]>();
  for (const { entry_id, ...image } of entryImages) {
    const images = imagesByEntry.get(entry_id) ?? [];
    images.push(image);
    imagesByEntry.set(entry_id, images);
  }
  const kudosCounts = counts(
    sql
      .exec<{ entry_id: string; count: number }>(
        'SELECT k.entry_id,COUNT(*) AS count FROM kudos k JOIN entries e ON e.id = k.entry_id WHERE e.user_id = ? GROUP BY k.entry_id',
        id,
      )
      .toArray(),
  );
  const commentCounts = counts(
    sql
      .exec<{ entry_id: string; count: number }>(
        'SELECT c.entry_id,COUNT(*) AS count FROM comments c JOIN entries e ON e.id = c.entry_id WHERE e.user_id = ? GROUP BY c.entry_id',
        id,
      )
      .toArray(),
  );
  const comments = sql
    .exec<Row<Comment>>('SELECT * FROM comments WHERE user_id = ? ORDER BY created_at,id', id)
    .toArray();
  const mentions = people(
    sql
      .exec<{ id: string; name: string; comment_id: string }>(
        'SELECT u.id,u.name,m.comment_id FROM comment_mentions m JOIN comments c ON c.id = m.comment_id JOIN users u ON u.id = m.user_id WHERE c.user_id = ? ORDER BY u.name,u.id',
        id,
      )
      .toArray(),
    'comment_id',
  );
  return {
    format_version: 1,
    exported_at: exportedAt,
    profile: toUser(user),
    roster: roster ?? null,
    weekly_targets: sql
      .exec<Row<WeeklyTarget>>(
        'SELECT * FROM weekly_targets WHERE user_id = ? ORDER BY week_start',
        id,
      )
      .toArray(),
    workouts: entries.map((entry) => ({
      ...entry,
      images: imagesByEntry.get(entry.id) ?? [],
      tagged: tags.get(entry.id) ?? [],
      kudos_count: kudosCounts.get(entry.id) ?? 0,
      comment_count: commentCounts.get(entry.id) ?? 0,
    })),
    images: sql
      .exec<Row<ImageMetadata>>(
        'SELECT id,owner_id,mime,width,height,created_at FROM images WHERE owner_id = ? ORDER BY created_at,id',
        id,
      )
      .toArray(),
    erg_tests: sql
      .exec<Row<Omit<ErgTest, 'is_pr'>>>(
        'SELECT * FROM erg_tests WHERE user_id = ? ORDER BY date,created_at,id',
        id,
      )
      .toArray(),
    comments: comments.map((comment) => ({ ...comment, mentions: mentions.get(comment.id) ?? [] })),
    kudos_given: sql
      .exec<Row<Kudos>>('SELECT * FROM kudos WHERE user_id = ? ORDER BY created_at,entry_id', id)
      .toArray(),
    plans: allMyPlans(storage, id),
    tagged_in: sql
      .exec<Row<AccountExportTag>>(
        'SELECT t.entry_id,e.user_id AS entry_owner_id,t.created_at AS tagged_at FROM entry_tags t JOIN entries e ON e.id = t.entry_id WHERE t.user_id = ? AND e.user_id != ? ORDER BY t.created_at,t.entry_id',
        id,
        id,
      )
      .toArray(),
    mentioned_in: sql
      .exec<Row<AccountExportMention>>(
        'SELECT m.comment_id,m.entry_id,c.user_id AS author_id,c.created_at FROM comment_mentions m JOIN comments c ON c.id = m.comment_id WHERE m.user_id = ? AND c.user_id != ? ORDER BY c.created_at,m.comment_id',
        id,
        id,
      )
      .toArray(),
  };
}

const workoutColumns = [
  'id',
  'date',
  'week_start',
  'modality',
  'zone',
  'distance_m',
  'duration_s',
  'avg_split_s',
  'stroke_rate',
  'avg_hr',
  'mode_factor',
  'zone_factor',
  'equiv_m',
  'title',
  'notes',
  'created_at',
  'updated_at',
] as const;
export function workoutsCsv(storage: DurableObjectStorage, userId: string): string {
  const rows = storage.sql
    .exec<Record<string, string | number | null>>(
      `SELECT ${workoutColumns.join(',')} FROM entries WHERE user_id = ? ORDER BY date,created_at,id`,
      userId,
    )
    .toArray();
  return (
    [
      workoutColumns.join(','),
      ...rows.map((row) => workoutColumns.map((key) => csvCell(row[key])).join(',')),
    ].join('\r\n') + '\r\n'
  );
}

export interface RemovalCounts {
  workouts: number;
  comments: number;
  kudos: number;
  images: number;
  plans: number;
  weekly_targets: number;
  erg_tests: number;
  challenges: number;
}
/**
 * Permanently deletes one account and everything that is its personal data or a structured
 * reference to it. Callers must run inside a transaction and authorize first.
 */
export function removeAccount(storage: DurableObjectStorage, user: UserRow): RemovalCounts {
  const sql = storage.sql;
  const id = user.id;
  const removed = sql
    .exec<Row<RemovalCounts>>(
      `SELECT (SELECT COUNT(*) FROM entries WHERE user_id = ?1) AS workouts,
(SELECT COUNT(*) FROM comments WHERE user_id = ?1) AS comments,
(SELECT COUNT(*) FROM kudos WHERE user_id = ?1) AS kudos,
(SELECT COUNT(*) FROM images WHERE owner_id = ?1) AS images,
(SELECT COUNT(*) FROM my_plans WHERE user_id = ?1) AS plans,
(SELECT COUNT(*) FROM weekly_targets WHERE user_id = ?1) AS weekly_targets,
(SELECT COUNT(*) FROM erg_tests WHERE user_id = ?1) AS erg_tests,
(SELECT COUNT(*) FROM challenges WHERE created_by = ?1) AS challenges`,
      id,
    )
    .one();
  const roster = sql
    .exec<{ id: string }>('SELECT id FROM roster WHERE claimed_by_user_id = ?', id)
    .toArray()[0];
  const timestamp = new Date().toISOString();
  for (const entry of sql.exec<{ id: string }>(OWN_ENTRIES, id).toArray())
    closeReports(storage, { target_type: 'entry', target_id: entry.id }, null, timestamp);
  for (const comment of sql
    .exec<{ id: string }>('SELECT id FROM comments WHERE user_id=?', id)
    .toArray())
    closeReports(storage, { target_type: 'comment', target_id: comment.id }, null, timestamp);
  sql.exec('DELETE FROM content_reports WHERE reporter_id=?', id);
  sql.exec('UPDATE content_reports SET reviewed_by=NULL WHERE reviewed_by=?', id);
  sql.exec(
    `DELETE FROM comment_mention_history WHERE user_id=?1 OR entry_id IN (${OWN_ENTRIES.replace('?', '?1')}) OR comment_id IN (SELECT id FROM comments WHERE user_id=?1)`,
    id,
  );
  sql.exec(
    `DELETE FROM push_outbox WHERE endpoint IN (SELECT endpoint FROM push_subscriptions WHERE user_id=?1) OR notification_id IN (SELECT id FROM notifications WHERE user_id=?1 OR actor_id=?1 OR (kind!='announcement' AND entry_id IN (${OWN_ENTRIES.replace('?', '?1')})))`,
    id,
  );
  sql.exec(
    `DELETE FROM comment_mentions WHERE user_id = ?1 OR entry_id IN (${OWN_ENTRIES.replace('?', '?1')}) OR comment_id IN (SELECT id FROM comments WHERE user_id = ?1)`,
    id,
  );
  for (const table of ['comments', 'entry_tags', 'kudos'])
    sql.exec(
      `DELETE FROM ${table} WHERE user_id = ?1 OR entry_id IN (${OWN_ENTRIES.replace('?', '?1')})`,
      id,
    );
  sql.exec(
    `DELETE FROM notifications WHERE user_id = ?1 OR actor_id = ?1 OR (kind!='announcement' AND entry_id IN (${OWN_ENTRIES.replace('?', '?1')}))`,
    id,
  );
  sql.exec(
    `DELETE FROM entry_images WHERE entry_id IN (${OWN_ENTRIES.replace('?', '?1')}) OR image_id IN (${OWN_IMAGES.replace('?', '?1')})`,
    id,
  );
  sql.exec(
    `UPDATE users SET avatar_image_id = NULL WHERE id != ?1 AND avatar_image_id IN (${OWN_IMAGES.replace('?', '?1')})`,
    id,
  );
  for (const statement of [
    'DELETE FROM images WHERE owner_id = ?',
    'DELETE FROM entries WHERE user_id = ?',
    'DELETE FROM erg_tests WHERE user_id = ?',
    'DELETE FROM challenges WHERE created_by = ?',
    'DELETE FROM my_plan_sessions WHERE user_id = ?',
    'DELETE FROM my_plans WHERE user_id = ?',
    'DELETE FROM weekly_targets WHERE user_id = ?',
    'DELETE FROM sessions WHERE user_id = ?',
    'DELETE FROM reauth_grants WHERE user_id = ?',
    'DELETE FROM entry_idempotency WHERE user_id = ?',
    'DELETE FROM push_subscriptions WHERE user_id = ?',
    'DELETE FROM passkeys WHERE user_id = ?',
    'DELETE FROM webauthn_challenges WHERE user_id = ?',
    'DELETE FROM announcements WHERE author_id = ?',
    'UPDATE roster SET added_by = NULL WHERE added_by = ?',
    'DELETE FROM roster WHERE claimed_by_user_id = ?',
  ])
    sql.exec(statement, id);
  sql.exec(
    "DELETE FROM rate_limits WHERE email = ? AND ip = ''",
    'auth-email:' + user.email.toLowerCase(),
  );
  if (
    sql.exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'user_intro'").toArray()
      .length
  )
    sql.exec('DELETE FROM user_intro WHERE user_id = ?', id);
  sql.exec('DELETE FROM users WHERE id = ?', id);
  sql.exec('DELETE FROM stats_versions WHERE user_id = ?', id);
  sql.exec(
    `UPDATE audit_log SET detail_json = ?1 WHERE detail_json != ?1 AND (target IN (?2,?3) OR actor_id = ?2 OR instr(detail_json, ?2) > 0 OR instr(detail_json, ?3) > 0 OR instr(lower(detail_json), ?4) > 0 OR instr(lower(detail_json), ?5) > 0)`,
    REDACTED_AUDIT_DETAIL,
    id,
    roster?.id ?? id,
    user.email.toLowerCase(),
    ('"name":' + JSON.stringify(user.name)).toLowerCase(),
  );
  return removed;
}
