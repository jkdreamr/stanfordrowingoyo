import type { ContentReport, Entry, Comment, ReportTarget } from '../../../shared/types';
import type { Row } from './row';
import { toPublicUser, type UserRow } from './users';

export type ReportRow = Omit<ContentReport, 'reporter' | 'content'> & { reporter_id: string };

export function findReport(storage: DurableObjectStorage, id: string) {
  return storage.sql.exec<ReportRow>('SELECT * FROM content_reports WHERE id=?', id).toArray()[0];
}

export function reportDetails(storage: DurableObjectStorage, rows: ReportRow[]): ContentReport[] {
  if (!rows.length) return [];
  const entryIds = [...new Set(rows.map((row) => row.entry_id))];
  const entries = storage.sql
    .exec<Row<Entry>>(
      `SELECT * FROM entries WHERE id IN (${entryIds.map(() => '?').join(',')})`,
      ...entryIds,
    )
    .toArray();
  const commentIds = rows
    .filter((row) => row.target_type === 'comment')
    .map((row) => row.target_id);
  const comments = commentIds.length
    ? storage.sql
        .exec<Row<Comment>>(
          `SELECT * FROM comments WHERE id IN (${commentIds.map(() => '?').join(',')})`,
          ...commentIds,
        )
        .toArray()
    : [];
  const userIds = [
    ...new Set([
      ...rows.map((row) => row.reporter_id),
      ...entries.map((row) => row.user_id),
      ...comments.map((row) => row.user_id),
    ]),
  ];
  const users = new Map(
    storage.sql
      .exec<UserRow>(
        `SELECT * FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`,
        ...userIds,
      )
      .toArray()
      .map((user) => [user.id, toPublicUser(user)]),
  );
  return rows.map(({ reporter_id, ...row }) => {
    const entry = entries.find((entry) => entry.id === row.entry_id);
    const comment = comments.find(
      (comment) => comment.id === row.target_id && comment.entry_id === row.entry_id,
    );
    const content = row.target_type === 'entry' ? entry : entry && comment;
    return {
      ...row,
      reporter: users.get(reporter_id)!,
      content: content
        ? {
            author: users.get(content.user_id)!,
            body: row.target_type === 'entry' ? entry!.notes : comment!.body,
            title: row.target_type === 'entry' ? entry!.title : null,
          }
        : null,
    };
  });
}

export function closeReports(
  storage: DurableObjectStorage,
  target: ReportTarget,
  reviewer: string | null,
  timestamp: string,
) {
  storage.sql.exec(
    `UPDATE content_reports SET status='deleted',reviewed_at=?,reviewed_by=? WHERE status='open' AND ${target.target_type === 'entry' ? 'entry_id=?' : "target_type='comment' AND target_id=?"}`,
    timestamp,
    reviewer,
    target.target_id,
  );
}
