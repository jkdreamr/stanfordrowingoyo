import type {
  ExamplePlan,
  ExamplePlanSlot,
  ExamplePlanTotal,
  Plan,
  PlanSlot,
  PlanTotal,
} from '../../../shared/types';
import type { Row } from './row';

export function getPlan(storage: DurableObjectStorage, week: string): Plan {
  const slots = storage.sql
    .exec<Row<PlanSlot>>(
      'SELECT day,slot,kind,zone,text FROM team_plan_slots WHERE week_start=? ORDER BY day,slot',
      week,
    )
    .toArray();
  const totals = storage.sql
    .exec<Row<PlanTotal>>('SELECT label FROM team_plan_totals WHERE week_start=?', week)
    .toArray();
  return { week_start: week, slots, totals };
}

export function getExamplePlan(storage: DurableObjectStorage, group: string): ExamplePlan {
  return {
    slots: storage.sql
      .exec<Row<ExamplePlanSlot>>(
        'SELECT * FROM plan_slots WHERE group_key=? ORDER BY week,day,slot',
        group,
      )
      .toArray(),
    totals: storage.sql
      .exec<Row<ExamplePlanTotal>>(
        'SELECT * FROM plan_totals WHERE group_key=? ORDER BY week',
        group,
      )
      .toArray(),
  };
}

export function replacePlan(storage: DurableObjectStorage, plan: Plan) {
  storage.sql.exec('DELETE FROM team_plan_slots WHERE week_start=?', plan.week_start);
  storage.sql.exec('DELETE FROM team_plan_totals WHERE week_start=?', plan.week_start);
  for (const row of plan.slots)
    storage.sql.exec(
      'INSERT INTO team_plan_slots VALUES (?,?,?,?,?,?)',
      plan.week_start,
      row.day,
      row.slot,
      row.kind,
      row.zone,
      row.text,
    );
  for (const row of plan.totals)
    storage.sql.exec('INSERT INTO team_plan_totals VALUES (?,?)', plan.week_start, row.label);
}
