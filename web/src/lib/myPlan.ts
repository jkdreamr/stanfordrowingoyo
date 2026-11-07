import { addDays, TIME_ZONE } from '../../../shared/dates';
import { equivalentMeters, PLAN_COMPLETION_RATIO, ZONES } from '../../../shared/math';
import type {
  Config,
  Entry,
  Modality,
  MyPlan,
  MyPlanInput,
  MyPlanSessionInput,
  Plan,
  Zone,
} from '../../../shared/types';
import { slotDisplayText } from '../components/plan/schedule';

export function planDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`));
}

export function inferModality(text: string): Modality {
  return /bike|cycl/i.test(text) ? 'bike' : /\brun|jog/i.test(text) ? 'run' : 'erg';
}
export function sampleFortnight(sample: Plan, start_date: string): MyPlanInput {
  return {
    start_date,
    sessions: sample.slots
      .filter((row) => row.kind === 'oyo')
      .map((row) => ({
        week: row.week,
        day: row.day,
        slot: row.slot,
        modality: inferModality(row.text),
        zone: row.zone ?? 'E',
        distance_m: null,
        note: slotDisplayText(row).slice(0, 200),
      })),
    rest_days: [],
  };
}
export function repeatStart(previous: string, monday: string) {
  return [addDays(previous, 14), monday].sort().at(-1)!;
}
export function covers(plan: Pick<MyPlan, 'start_date'>, date: string) {
  return plan.start_date <= date && date <= addDays(plan.start_date, 13);
}
export function plannedTotals(
  sessions: MyPlanSessionInput[],
  factors: Pick<Config, 'mode_factors' | 'zone_factors'>,
): [number, number] {
  const totals: [number, number] = [0, 0];
  for (const row of sessions)
    if (row.distance_m !== null)
      totals[row.week - 1] += equivalentMeters(
        row.distance_m,
        row.modality,
        row.zone,
        factors.mode_factors,
        factors.zone_factors,
      );
  return totals;
}
export function personalPlan(
  input: MyPlanInput,
  factors: Pick<Config, 'mode_factors' | 'zone_factors'>,
  updated_at: string,
  entries: Pick<Entry, 'id' | 'date' | 'modality' | 'created_at' | 'equiv_m'>[] = [],
): MyPlan {
  const remaining = [...entries].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
  return {
    start_date: input.start_date,
    rest_days: input.rest_days,
    updated_at,
    planned_m: plannedTotals(input.sessions, factors),
    sessions: [...input.sessions]
      .sort((a, b) => a.week - b.week || a.day - b.day || a.slot.localeCompare(b.slot))
      .map((row) => {
        const date = addDays(input.start_date, (row.week - 1) * 7 + row.day);
        const equiv_m =
          row.distance_m === null
            ? null
            : equivalentMeters(
                row.distance_m,
                row.modality,
                row.zone,
                factors.mode_factors,
                factors.zone_factors,
              );
        const match = remaining.findIndex(
          (entry) =>
            entry.date === date &&
            entry.modality === row.modality &&
            (equiv_m === null || entry.equiv_m >= PLAN_COMPLETION_RATIO * equiv_m),
        );
        const completed_entry_id = match < 0 ? null : remaining.splice(match, 1)[0].id;
        return {
          ...row,
          equiv_m,
          completed_entry_id,
        };
      }),
  };
}
export function planLogLink(session: MyPlanSessionInput) {
  const query = new URLSearchParams({ modality: session.modality, zone: session.zone });
  if (session.distance_m !== null) query.set('distance', String(session.distance_m));
  return `/log?${query}`;
}
export function logPrefill(params: URLSearchParams): {
  modality?: Modality;
  zone?: Zone;
  distance?: string;
} {
  if (params.has('edit') || params.has('preset')) return {};
  const modality = params.get('modality');
  const zone = params.get('zone');
  const distance = params.get('distance');
  return {
    ...(['erg', 'bike', 'run'].includes(modality ?? '') ? { modality: modality as Modality } : {}),
    ...(ZONES.includes(zone as Zone) ? { zone: zone as Zone } : {}),
    ...(distance && /^\d+$/.test(distance) && Number(distance) >= 1 && Number(distance) <= 200000
      ? { distance: String(Number(distance)) }
      : {}),
  };
}
