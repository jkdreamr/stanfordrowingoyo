import type { Context } from '../context';
import type { Entry, Settings } from '../../../shared/types';
import type { Row } from './row';
import { equivalentMeters } from '../../../shared/math';
import { csvCell } from '../csv';
import { audit } from './audit';
export function recalculate(ctx: Context, settings: Settings): number {
  let updated = 0;
  ctx.storage.transactionSync(() => {
    for (const entry of ctx.storage.sql.exec<Row<Entry>>('SELECT * FROM entries').toArray()) {
      const mode = settings.mode_factors[entry.modality];
      const zone = settings.zone_factors[entry.zone];
      const meters = equivalentMeters(
        entry.distance_m,
        entry.modality,
        entry.zone,
        settings.mode_factors,
        settings.zone_factors,
      );
      if (entry.mode_factor !== mode || entry.zone_factor !== zone || entry.equiv_m !== meters) {
        ctx.storage.sql.exec(
          'UPDATE entries SET mode_factor = ?,zone_factor = ?,equiv_m = ? WHERE id = ?',
          mode,
          zone,
          meters,
          entry.id,
        );
        updated++;
      }
    }
    audit(ctx, 'entries.recalculate', 'entries', null, { updated });
  });
  return updated;
}
const columns = [
  'date',
  'week_start',
  'name',
  'email',
  'group',
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
  'visibility',
  'title',
  'notes',
  'created_at',
];
export function exportEntries(ctx: Context, start: string, end: string): string {
  const rows = ctx.storage.sql
    .exec<Record<string, string | number | null>>(
      'SELECT e.date,e.week_start,u.name,u.email,u.group_key AS "group",e.modality,e.zone,e.distance_m,e.duration_s,e.avg_split_s,e.stroke_rate,e.avg_hr,e.mode_factor,e.zone_factor,e.equiv_m,e.visibility,e.title,e.notes,e.created_at FROM entries e JOIN users u ON u.id = e.user_id WHERE e.date >= ? AND e.date <= ? ORDER BY e.date,e.created_at,e.id',
      start,
      end,
    )
    .toArray();
  return (
    [
      columns.join(','),
      ...rows.map((row) => columns.map((key) => csvCell(row[key])).join(',')),
    ].join('\r\n') + '\r\n'
  );
}
