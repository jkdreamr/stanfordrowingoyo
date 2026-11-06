import type { Plan, PlanSlot, PlanTotal } from '../../../shared/types';
import type { Row } from './row';
export function getPlan(storage: DurableObjectStorage, group?: string): Plan {
  const slots =
    group === undefined
      ? storage.sql
          .exec<Row<PlanSlot>>('SELECT * FROM plan_slots ORDER BY group_key,week,day,slot')
          .toArray()
      : storage.sql
          .exec<Row<PlanSlot>>(
            'SELECT * FROM plan_slots WHERE group_key = ? ORDER BY week,day,slot',
            group,
          )
          .toArray();
  const totals =
    group === undefined
      ? storage.sql
          .exec<Row<PlanTotal>>('SELECT * FROM plan_totals ORDER BY group_key,week')
          .toArray()
      : storage.sql
          .exec<Row<PlanTotal>>(
            'SELECT * FROM plan_totals WHERE group_key = ? ORDER BY week',
            group,
          )
          .toArray();
  return { slots, totals };
}
export function saveSlot(storage: DurableObjectStorage, row: PlanSlot) {
  storage.sql.exec(
    'INSERT OR REPLACE INTO plan_slots VALUES (?,?,?,?,?,?,?)',
    row.group_key,
    row.week,
    row.day,
    row.slot,
    row.kind,
    row.zone,
    row.text,
  );
}
export function replacePlan(storage: DurableObjectStorage, plan: Plan) {
  storage.sql.exec('DELETE FROM plan_slots');
  storage.sql.exec('DELETE FROM plan_totals');
  for (const slot of plan.slots) saveSlot(storage, slot);
  for (const row of plan.totals)
    storage.sql.exec('INSERT INTO plan_totals VALUES (?,?,?)', row.group_key, row.week, row.label);
}
