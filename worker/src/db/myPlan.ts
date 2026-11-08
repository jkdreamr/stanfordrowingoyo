import type { MyPlan, MyPlanInput, MyPlanSessionInput, Settings } from '../../../shared/types';
import { addDays } from '../../../shared/dates';
import { equivalentMeters } from '../../../shared/math';
import { getSettings } from './settings';
import type { Row } from './row';
import { HttpError } from '../http';

interface PlanRow {
  start_date: string;
  rest_days_json: string;
  updated_at: string;
}
interface LoggedEntry {
  date: string;
  equiv_m: number;
}
export function getMyPlan(
  storage: DurableObjectStorage,
  userId: string,
  date: string,
): MyPlan | null {
  const row = storage.sql
    .exec<Row<PlanRow>>(
      'SELECT start_date, rest_days_json, updated_at FROM my_plans WHERE user_id = ? AND start_date BETWEEN ? AND ? ORDER BY start_date DESC LIMIT 1',
      userId,
      addDays(date, -13),
      date,
    )
    .toArray()[0];
  if (!row) return null;
  const sessions = storage.sql
    .exec<Row<MyPlanSessionInput>>(
      'SELECT week, day, slot, modality, zone, distance_m, note FROM my_plan_sessions WHERE user_id = ? AND start_date = ? ORDER BY week, day, slot',
      userId,
      row.start_date,
    )
    .toArray();
  const entries = storage.sql
    .exec<Row<LoggedEntry>>(
      'SELECT date, equiv_m FROM entries WHERE user_id = ? AND date BETWEEN ? AND ?',
      userId,
      row.start_date,
      addDays(row.start_date, 13),
    )
    .toArray();
  return buildPlan(row, sessions, entries, getSettings(storage));
}
function buildPlan(
  row: Row<PlanRow>,
  sessions: Row<MyPlanSessionInput>[],
  entries: Row<LoggedEntry>[],
  settings: Settings,
): MyPlan {
  const logged_m: [number, number] = [0, 0];
  for (const entry of entries) {
    if (entry.date >= row.start_date && entry.date <= addDays(row.start_date, 13))
      logged_m[entry.date < addDays(row.start_date, 7) ? 0 : 1] += entry.equiv_m;
  }
  const planned_m: [number, number] = [0, 0];
  return {
    start_date: row.start_date,
    updated_at: row.updated_at,
    rest_days: JSON.parse(row.rest_days_json),
    planned_m,
    logged_m,
    sessions: sessions.map((session) => {
      const equiv_m =
        session.distance_m === null
          ? null
          : equivalentMeters(
              session.distance_m,
              session.modality,
              session.zone,
              settings.mode_factors,
              settings.zone_factors,
            );
      planned_m[session.week - 1] += equiv_m ?? 0;
      return {
        ...session,
        equiv_m,
      };
    }),
  };
}
/** Every personal plan of one user, using three queries regardless of plan count. */
export function allMyPlans(storage: DurableObjectStorage, userId: string): MyPlan[] {
  const rows = storage.sql
    .exec<Row<PlanRow>>(
      'SELECT start_date, rest_days_json, updated_at FROM my_plans WHERE user_id = ? ORDER BY start_date',
      userId,
    )
    .toArray();
  if (!rows.length) return [];
  const sessions = storage.sql
    .exec<Row<MyPlanSessionInput & { start_date: string }>>(
      'SELECT start_date, week, day, slot, modality, zone, distance_m, note FROM my_plan_sessions WHERE user_id = ? ORDER BY start_date, week, day, slot',
      userId,
    )
    .toArray();
  const entries = storage.sql
    .exec<Row<LoggedEntry>>(
      'SELECT date, equiv_m FROM entries WHERE user_id = ? AND date BETWEEN ? AND ?',
      userId,
      rows[0].start_date,
      addDays(rows[rows.length - 1].start_date, 13),
    )
    .toArray();
  const settings = getSettings(storage);
  const sessionsByStart = new Map<string, Row<MyPlanSessionInput>[]>();
  for (const { start_date, ...session } of sessions) {
    const group = sessionsByStart.get(start_date) ?? [];
    group.push(session);
    sessionsByStart.set(start_date, group);
  }
  const entriesByDate = new Map<string, Row<LoggedEntry>[]>();
  for (const entry of entries) {
    const group = entriesByDate.get(entry.date) ?? [];
    group.push(entry);
    entriesByDate.set(entry.date, group);
  }
  return rows.map((row) => {
    return buildPlan(
      row,
      sessionsByStart.get(row.start_date) ?? [],
      Array.from(
        { length: 14 },
        (_, day) => entriesByDate.get(addDays(row.start_date, day)) ?? [],
      ).flat(),
      settings,
    );
  });
}
export function replaceMyPlan(
  storage: DurableObjectStorage,
  userId: string,
  input: MyPlanInput,
  now: string,
) {
  storage.transactionSync(() => {
    const overlap = storage.sql
      .exec(
        'SELECT 1 FROM my_plans WHERE user_id = ? AND start_date != ? AND start_date BETWEEN ? AND ? LIMIT 1',
        userId,
        input.start_date,
        addDays(input.start_date, -13),
        addDays(input.start_date, 13),
      )
      .toArray();
    if (overlap.length) throw new HttpError(409, 'CONFLICT', 'Personal plans cannot overlap.');
    storage.sql.exec(
      'INSERT INTO my_plans VALUES (?,?,?,?) ON CONFLICT(user_id,start_date) DO UPDATE SET rest_days_json=excluded.rest_days_json,updated_at=excluded.updated_at',
      userId,
      input.start_date,
      JSON.stringify(input.rest_days),
      now,
    );
    storage.sql.exec(
      'DELETE FROM my_plan_sessions WHERE user_id = ? AND start_date = ?',
      userId,
      input.start_date,
    );
    for (const session of input.sessions)
      storage.sql.exec(
        'INSERT INTO my_plan_sessions VALUES (?,?,?,?,?,?,?,?,?)',
        userId,
        input.start_date,
        session.week,
        session.day,
        session.slot,
        session.modality,
        session.zone,
        session.distance_m,
        session.note,
      );
  });
}
export function deleteMyPlan(storage: DurableObjectStorage, userId: string, start: string) {
  storage.transactionSync(() => {
    const deleted = storage.sql
      .exec(
        'DELETE FROM my_plans WHERE user_id = ? AND start_date = ? RETURNING start_date',
        userId,
        start,
      )
      .toArray();
    if (!deleted.length) throw new HttpError(404, 'NOT_FOUND', 'Personal plan not found.');
    storage.sql.exec(
      'DELETE FROM my_plan_sessions WHERE user_id = ? AND start_date = ?',
      userId,
      start,
    );
  });
}
