import type { AuditLog, Page } from '../../../shared/types';
import type { Context } from '../context';
import type { Row } from './row';
import { invalid } from '../validate';
export function audit(
  ctx: Context,
  action: string,
  target: string,
  before: unknown,
  after: unknown,
) {
  ctx.storage.sql.exec(
    'INSERT INTO audit_log VALUES (?,?,?,?,?,?)',
    crypto.randomUUID(),
    ctx.user!.id,
    action,
    target,
    JSON.stringify({ before, after }),
    ctx.now.toISOString(),
  );
}
export function auditPage(ctx: Context): Page<AuditLog> {
  const cursor = new URL(ctx.request.url).searchParams.get('cursor');
  let parts: string[] = [];
  if (cursor !== null) {
    try {
      parts = JSON.parse(atob(cursor.replaceAll('-', '+').replaceAll('_', '/')));
      if (
        !Array.isArray(parts) ||
        parts.length !== 2 ||
        parts.some((p) => typeof p !== 'string') ||
        !/^\d{4}-\d{2}-\d{2}T/.test(parts[0]) ||
        !Number.isFinite(Date.parse(parts[0])) ||
        !/^[0-9a-f-]{36}$/.test(parts[1])
      )
        throw new Error();
    } catch {
      invalid('Cursor is invalid.');
    }
  }
  const rows = parts.length
    ? ctx.storage.sql
        .exec<Row<AuditLog>>(
          'SELECT * FROM audit_log WHERE created_at < ? OR (created_at = ? AND id < ?) ORDER BY created_at DESC,id DESC LIMIT ?',
          parts[0],
          parts[0],
          parts[1],
          51,
        )
        .toArray()
    : ctx.storage.sql
        .exec<Row<AuditLog>>('SELECT * FROM audit_log ORDER BY created_at DESC,id DESC LIMIT ?', 51)
        .toArray();
  const items = rows.slice(0, 50);
  const last = items.at(-1);
  return {
    items,
    next_cursor:
      rows.length > 50
        ? btoa(JSON.stringify([last!.created_at, last!.id]))
            .replaceAll('+', '-')
            .replaceAll('/', '_')
            .replaceAll('=', '')
        : null,
  };
}
