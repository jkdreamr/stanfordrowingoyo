import type { ContentReport, Page } from '../../../shared/types';
import type { Context } from '../context';
import { refreshUser, requireStaff } from '../auth/guards';
import { audit } from '../db/audit';
import { deleteEntry, findEntry, visibleEntry } from '../db/entries';
import { deleteComment, findComment } from '../db/social';
import { notify } from '../db/notifications';
import { findReport, reportDetails, type ReportRow } from '../db/reports';
import { HttpError, json, readJson } from '../http';
import { enumeration, invalid, string } from '../validate';

export async function create(ctx: Context) {
  const body = await readJson(ctx.request);
  const user = refreshUser(ctx);
  const type = enumeration(body.target_type, ['entry', 'comment'], 'Report target');
  const id = string(body.target_id, 'Target ID', 1, 200);
  const reason = body.reason === undefined ? '' : string(body.reason, 'Reason', 0, 300, true);
  const previous = ctx.storage.sql
    .exec<{ id: string }>(
      'SELECT id FROM content_reports WHERE reporter_id=? AND target_type=? AND target_id=?',
      user.id,
      type,
      id,
    )
    .toArray()[0];
  if (previous) return json({ id: previous.id });
  const comment = type === 'comment' ? findComment(ctx.storage, id) : undefined;
  if (type === 'comment' && !comment) throw new HttpError(404, 'NOT_FOUND', 'Comment not found.');
  const entry = visibleEntry(ctx.storage, comment?.entry_id ?? id, user.id);
  const reportId = crypto.randomUUID();
  const timestamp = ctx.now.toISOString();
  ctx.storage.transactionSync(() => {
    ctx.storage.sql.exec(
      "INSERT INTO content_reports VALUES (?,?,?,?,?,?,'open',?,NULL,NULL)",
      reportId,
      type,
      id,
      entry.id,
      user.id,
      reason,
      timestamp,
    );
    const staff = ctx.storage.sql
      .exec<{ id: string }>(
        "SELECT id FROM users WHERE active=1 AND role IN ('coxswain','coach','admin')",
      )
      .toArray();
    for (const recipient of staff)
      notify(ctx.storage, recipient.id, user.id, 'report', entry.id, timestamp);
  });
  return json({ id: reportId }, 201);
}

export function list(ctx: Context) {
  requireStaff(ctx);
  const params = new URL(ctx.request.url).searchParams;
  const status = enumeration(
    params.get('status') ?? 'open',
    ['open', 'dismissed', 'deleted'],
    'Report status',
  );
  let cursor: string[] = [];
  if (params.has('cursor')) {
    try {
      const encoded = params.get('cursor')!;
      if (encoded.length > 200 || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error();
      const value: unknown = JSON.parse(atob(encoded.replaceAll('-', '+').replaceAll('_', '/')));
      if (
        !Array.isArray(value) ||
        value.length !== 2 ||
        value.some((part) => typeof part !== 'string') ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value[0]) ||
        !Number.isFinite(Date.parse(value[0])) ||
        !/^[0-9a-f-]{36}$/.test(value[1])
      )
        throw new Error();
      cursor = value;
    } catch {
      invalid('Cursor is invalid.');
    }
  }
  const rows = ctx.storage.sql
    .exec<ReportRow>(
      `SELECT * FROM content_reports WHERE status=? ${cursor.length ? 'AND (created_at < ? OR (created_at = ? AND id < ?))' : ''} ORDER BY created_at DESC,id DESC LIMIT 51`,
      status,
      ...(cursor.length ? [cursor[0], cursor[0], cursor[1]] : []),
    )
    .toArray();
  const items = reportDetails(ctx.storage, rows.slice(0, 50));
  const last = items.at(-1);
  const page: Page<ContentReport> = {
    items,
    next_cursor:
      rows.length > 50
        ? btoa(JSON.stringify([last!.created_at, last!.id]))
            .replaceAll('+', '-')
            .replaceAll('/', '_')
            .replaceAll('=', '')
        : null,
  };
  return json(page);
}

export async function review(ctx: Context) {
  const body = await readJson(ctx.request);
  refreshUser(ctx);
  const user = requireStaff(ctx);
  const action = enumeration(body.action, ['dismiss', 'delete'], 'Report action');
  const report = findReport(ctx.storage, ctx.params.id);
  if (!report) throw new HttpError(404, 'NOT_FOUND', 'Report not found.');
  const status = action === 'dismiss' ? 'dismissed' : 'deleted';
  if (report.status !== 'open') {
    if (report.status !== status)
      throw new HttpError(409, 'CONFLICT', 'Report has already been reviewed.');
    return json(reportDetails(ctx.storage, [report])[0]);
  }
  const timestamp = ctx.now.toISOString();
  ctx.storage.transactionSync(() => {
    if (action === 'delete') {
      if (report.target_type === 'entry') {
        const entry = findEntry(ctx.storage, report.target_id);
        deleteEntry(ctx.storage, report.target_id, user.id, timestamp);
        if (entry) audit(ctx, 'entry.delete', entry.id, entry, null);
      } else {
        const comment = findComment(ctx.storage, report.target_id);
        deleteComment(ctx.storage, report.target_id, user.id, timestamp);
        if (comment) audit(ctx, 'comment.delete', comment.id, comment, null);
      }
    }
    ctx.storage.sql.exec(
      'UPDATE content_reports SET status=?,reviewed_at=?,reviewed_by=? WHERE id=?',
      status,
      timestamp,
      user.id,
      report.id,
    );
    audit(ctx, `report.${action}`, report.id, report, findReport(ctx.storage, report.id));
  });
  return json(reportDetails(ctx.storage, [findReport(ctx.storage, report.id)!])[0]);
}
