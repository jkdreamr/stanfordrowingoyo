import { useEffect, useState } from 'react';
import { Check, MoreHorizontal, Plus } from 'lucide-react';
import { addDays } from '../../../../shared/dates';
import { ZONES } from '../../../../shared/math';
import type {
  Config,
  GroupKey,
  MyPlan,
  MyPlanInput,
  MyPlanSessionInput,
} from '../../../../shared/types';
import {
  useMyPlan,
  usePlan,
  useExamplePlan,
  usePutMyPlan,
  useDeleteMyPlan,
  useTarget,
} from '../../lib/queries';
import { planDate, plannedTotals, repeatStart, sampleFortnight } from '../../lib/myPlan';
import { formatMeters, formatNumber } from '../../lib/format';
import {
  DialogPresence,
  Button,
  ConfirmSheet,
  EmptyState,
  IconButton,
  ListGroup,
  ListRow,
  NumberField,
  SegmentedControl,
  Sheet,
  TextField,
  ZoneChip,
  ZoneOption,
} from '../ui';
import { LoadState } from '../shell/LoadState';
import { ModalityIcon } from '../shell/ModalityIcon';
import { DAYS, SLOTS, slotLabel } from './schedule';
import { SlotItem } from './PlanWeek';

type Day = { week: 1 | 2; day: number };
type Editor = Day & { session?: MyPlanSessionInput };
const sameSession = (a: MyPlanSessionInput, b?: MyPlanSessionInput) =>
  !!b && a.week === b.week && a.day === b.day && a.slot === b.slot;
export function MyFortnight({ config, group }: { config: Config; group: GroupKey }) {
  const nextMonday = addDays(config.current_week_start, 7);
  const current = useMyPlan();
  const upcoming = useMyPlan(nextMonday, current.data === null);
  const previous = useMyPlan(
    addDays(config.today, -14),
    current.data === null && upcoming.data === null,
  );
  const sample = useExamplePlan({ group });
  const target = useTarget();
  const put = usePutMyPlan();
  const remove = useDeleteMyPlan();
  const [start, setStart] = useState<'this' | 'next'>('this');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [preview, setPreview] = useState<MyPlanSessionInput | null>(null);
  const [dayMenu, setDayMenu] = useState<Day | null>(null);
  const [restConfirm, setRestConfirm] = useState<Day | null>(null);
  const [more, setMore] = useState(false);
  const [setup, setSetup] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const plan = current.data ?? upcoming.data;
  const firstTeamWeek = usePlan({ week: plan?.start_date }, !!plan);
  const secondTeamWeek = usePlan({ week: plan ? addDays(plan.start_date, 7) : undefined }, !!plan);
  const teamWeeks = [firstTeamWeek, secondTeamWeek];
  const busy = put.isPending || remove.isPending;
  const failed =
    current.isError ||
    (current.data === null && upcoming.isError) ||
    (!plan && previous.isError) ||
    sample.isError ||
    target.isError;
  const loading =
    failed ||
    current.isPending ||
    (current.data === null && upcoming.isPending) ||
    (!plan && previous.isPending) ||
    !sample.data ||
    !target.data;
  const save = (body: MyPlanInput, onSuccess?: () => void) => {
    if (!busy)
      put.mutate(body, {
        onSuccess: () => {
          setSetup(false);
          onSuccess?.();
        },
      });
  };
  const start_date = start === 'this' ? config.current_week_start : nextMonday;
  const closeEditor = () => {
    setEditor(null);
    setPreview(null);
  };
  const display =
    plan && preview && editor
      ? [...plan.sessions.filter((row) => !sameSession(row, editor.session)), preview]
      : (plan?.sessions ?? []);
  const totals = preview ? plannedTotals(display, config) : (plan?.planned_m ?? [0, 0]);
  const markRest = (day: Day) =>
    plan &&
    save(
      {
        ...plan,
        sessions: plan.sessions.filter((row) => row.week !== day.week || row.day !== day.day),
        rest_days: [...plan.rest_days, day],
      },
      () => setRestConfirm(null),
    );
  return (
    <>
      <div className={plan ? 'my-fortnight screen-stack' : 'screen-stack'}>
        {loading ? (
          <LoadState
            error={failed}
            retry={() => {
              void current.refetch();
              void upcoming.refetch();
              void previous.refetch();
              void sample.refetch();
              void target.refetch();
            }}
          />
        ) : !plan ? (
          <EmptyState
            icon={<Plus size={20} />}
            title="No Plan"
            action={<Button onClick={() => setSetup(true)}>Start Plan</Button>}
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-title3 tabular-nums">
                {planDate(plan.start_date)} – {planDate(addDays(plan.start_date, 13))}
              </h2>
              <IconButton aria-label="More" onClick={() => setMore(true)}>
                <MoreHorizontal size={20} strokeWidth={1.75} />
              </IconButton>
            </div>
            {([1, 2] as const).map((week) => (
              <section key={week} aria-label={`Week ${week}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-title3">Week {week}</h3>
                  {totals[week - 1] > 0 && plan.logged_m[week - 1] >= totals[week - 1] && (
                    <span className="target-hit inline-flex items-center gap-1 text-subhead">
                      <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                      Complete
                    </span>
                  )}
                </div>
                <p
                  className="mt-1 text-subhead tabular-nums"
                  aria-label={`Week ${week} Logged vs Planned E-meters`}
                >
                  {formatNumber(plan.logged_m[week - 1])} / {formatNumber(totals[week - 1])} m
                </p>
                <p className="mt-1 text-footnote tabular-nums text-muted">
                  Planned / Target · {formatNumber(totals[week - 1])} /{' '}
                  {formatNumber(target.data!.target_m)} E-meters
                </p>
                <progress
                  className="my-plan-progress mt-3"
                  aria-label={`Week ${week} Logged vs Planned E-meters`}
                  aria-valuetext={`${formatNumber(plan.logged_m[week - 1])} of ${formatNumber(totals[week - 1])} E-meters`}
                  value={totals[week - 1] > 0 ? plan.logged_m[week - 1] : 0}
                  max={Math.max(1, totals[week - 1])}
                />
                {teamWeeks[week - 1].isError ? (
                  <p className="mt-3 text-footnote text-muted">
                    Could not load team schedule.{' '}
                    <Button variant="plain" onClick={() => void teamWeeks[week - 1].refetch()}>
                      Try Again
                    </Button>
                  </p>
                ) : !teamWeeks[week - 1].data ? (
                  <p className="mt-3 text-footnote text-muted">Loading team schedule…</p>
                ) : (
                  !teamWeeks[week - 1].data!.slots.length && (
                    <p className="mt-3 text-footnote text-muted">Team schedule coming soon</p>
                  )
                )}
                <div className="mt-4 grid gap-4 lg:grid-cols-7">
                  {DAYS.map((name, day) => {
                    const sessions = plan.sessions.filter(
                      (row) => row.week === week && row.day === day,
                    );
                    const rest = plan.rest_days.some((row) => row.week === week && row.day === day);
                    const dated = teamWeeks[week - 1].data;
                    const team = (dated?.slots ?? [])
                      .filter((row) => row.day === day)
                      .sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
                    const hasPM2 = dated?.slots.some((row) => row.slot === 'PM2') ?? false;
                    return (
                      <section key={day} aria-label={`${name} Week ${week}`} className="min-w-0">
                        <div className="flex min-h-11 items-center justify-between gap-2">
                          <h4 className="text-headline lg:text-footnote">{name}</h4>
                          <IconButton
                            aria-label={`${name} Week ${week} Options`}
                            disabled={busy}
                            onClick={() => setDayMenu({ week, day })}
                          >
                            <MoreHorizontal size={20} strokeWidth={1.75} />
                          </IconButton>
                        </div>
                        <div className="space-y-2">
                          {team.map((row) => (
                            <div
                              key={row.slot}
                              aria-label={`Team schedule ${name} ${row.slot} Week ${week}`}
                            >
                              <SlotItem item={row} label={slotLabel(row.slot, hasPM2)} secondary />
                            </div>
                          ))}
                          {rest ? (
                            <p className="py-3 text-subhead text-muted">Rest</p>
                          ) : (
                            sessions.map((row) => (
                              <div key={row.slot} className="relative min-w-0">
                                <Button
                                  variant="secondary"
                                  disabled={busy}
                                  title={row.note}
                                  aria-label={`Edit ${row.slot} ${name} Week ${week}`}
                                  className="my-plan-session min-w-0 w-full"
                                  onClick={() => setEditor({ week, day, session: row })}
                                >
                                  <SessionLine session={row} />
                                </Button>
                              </div>
                            ))
                          )}
                          {!rest && sessions.length < 3 && (
                            <Button
                              variant="plain"
                              disabled={busy}
                              leading={<Plus size={20} strokeWidth={1.75} />}
                              aria-label={`Add Session ${name} Week ${week}`}
                              onClick={() => setEditor({ week, day })}
                            >
                              Add
                            </Button>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
      <DialogPresence>
        {!loading && !plan && (
          <Sheet open={setup} onClose={() => setSetup(false)} title="Start Plan">
            <div className="space-y-4">
              <SegmentedControl
                label="Start Date"
                value={start}
                onChange={setStart}
                options={[
                  { value: 'this', label: 'This Week' },
                  { value: 'next', label: 'Next Week' },
                ]}
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={busy}
                  onClick={() => save(sampleFortnight(sample.data!, start_date))}
                >
                  Start from Sample
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => save({ start_date, sessions: [], rest_days: [] })}
                >
                  Start Blank
                </Button>
              </div>
              {previous.data && (
                <Button
                  variant="plain"
                  disabled={busy}
                  onClick={() =>
                    save({
                      ...previous.data!,
                      start_date: repeatStart(previous.data!.start_date, config.current_week_start),
                    })
                  }
                >
                  Repeat Fortnight
                </Button>
              )}
            </div>
          </Sheet>
        )}
      </DialogPresence>
      <DialogPresence>
        {plan && editor && (
          <SessionSheet
            key={`${editor.week}:${editor.day}:${editor.session?.slot ?? 'new'}`}
            editor={editor}
            plan={plan}
            busy={busy}
            onClose={closeEditor}
            onPreview={setPreview}
            onSave={(session) =>
              save(
                {
                  ...plan,
                  sessions: [
                    ...plan.sessions.filter((row) => !sameSession(row, editor.session)),
                    session,
                  ],
                },
                closeEditor,
              )
            }
            onDelete={() =>
              save(
                {
                  ...plan,
                  sessions: plan.sessions.filter((row) => !sameSession(row, editor.session)),
                },
                closeEditor,
              )
            }
          />
        )}
      </DialogPresence>
      <DialogPresence>
        {plan && dayMenu && (
          <Sheet
            open
            title={`${DAYS[dayMenu.day]} Week ${dayMenu.week}`}
            onClose={() => setDayMenu(null)}
          >
            <ListGroup>
              <ListRow
                title={
                  plan.rest_days.some((row) => row.week === dayMenu.week && row.day === dayMenu.day)
                    ? 'Clear Rest Day'
                    : 'Rest Day'
                }
                onClick={() => {
                  const day = dayMenu;
                  setDayMenu(null);
                  if (plan.rest_days.some((row) => row.week === day.week && row.day === day.day))
                    save({
                      ...plan,
                      rest_days: plan.rest_days.filter(
                        (row) => row.week !== day.week || row.day !== day.day,
                      ),
                    });
                  else if (
                    plan.sessions.some((row) => row.week === day.week && row.day === day.day)
                  )
                    setRestConfirm(day);
                  else markRest(day);
                }}
              />
            </ListGroup>
          </Sheet>
        )}
      </DialogPresence>
      <DialogPresence>
        {plan && restConfirm && (
          <ConfirmSheet
            open
            title="Mark Rest Day"
            body=""
            confirmLabel="Rest Day"
            cancelLabel="Cancel"
            loading={busy}
            onClose={() => setRestConfirm(null)}
            onConfirm={() => markRest(restConfirm)}
          />
        )}
      </DialogPresence>
      <DialogPresence>
        {plan && more && (
          <Sheet open title="Plan Actions" onClose={() => setMore(false)}>
            <ListGroup>
              <ListRow
                title="Delete Plan"
                tone="destructive"
                onClick={() => {
                  setMore(false);
                  setDeleting(true);
                }}
              />
            </ListGroup>
          </Sheet>
        )}
      </DialogPresence>
      <DialogPresence>
        {plan && deleting && (
          <ConfirmSheet
            open
            title="Delete Plan"
            body=""
            confirmLabel="Delete Plan"
            cancelLabel="Cancel"
            loading={busy}
            onClose={() => setDeleting(false)}
            onConfirm={() =>
              remove.mutate(plan.start_date, { onSuccess: () => setDeleting(false) })
            }
          />
        )}
      </DialogPresence>
    </>
  );
}
export function SessionLine({ session }: { session: MyPlanSessionInput }) {
  return (
    <span className="my-plan-line flex min-w-0 items-center gap-2 text-footnote font-normal">
      <span className="my-plan-metadata flex min-w-0 shrink-0 flex-wrap items-center gap-2">
        <ModalityIcon modality={session.modality} />
        <ZoneChip zone={session.zone} />
        {session.distance_m !== null && (
          <span className="shrink-0 tabular-nums">{formatMeters(session.distance_m)}</span>
        )}
      </span>
      <span className="my-plan-note min-w-0 truncate lg:line-clamp-2 lg:break-words lg:whitespace-normal">
        {session.note}
      </span>
    </span>
  );
}
function SessionSheet({
  editor,
  plan,
  busy,
  onClose,
  onPreview,
  onSave,
  onDelete,
}: {
  editor: Editor;
  plan: MyPlan;
  busy: boolean;
  onClose: () => void;
  onPreview: (value: MyPlanSessionInput | null) => void;
  onSave: (value: MyPlanSessionInput) => void;
  onDelete: () => void;
}) {
  const slots = SLOTS.filter(
    (slot) =>
      !plan.sessions.some(
        (row) => row.week === editor.week && row.day === editor.day && row.slot === slot,
      ) || editor.session?.slot === slot,
  );
  const [draft, setDraft] = useState<MyPlanSessionInput>(
    editor.session ?? {
      week: editor.week,
      day: editor.day,
      slot: slots[0],
      modality: 'erg',
      zone: 'E',
      distance_m: null,
      note: '',
    },
  );
  const [distance, setDistance] = useState(
    draft.distance_m === null ? '' : String(draft.distance_m),
  );
  const [unit, setUnit] = useState<'m' | 'km'>('m');
  const meters = distance.trim() === '' ? null : Number(distance) * (unit === 'km' ? 1000 : 1);
  const valid =
    meters === null ||
    (/^\d+(\.\d+)?$/.test(distance) && Number.isInteger(meters) && meters >= 1 && meters <= 200000);
  useEffect(() => {
    onPreview(valid ? { ...draft, distance_m: meters } : null);
  }, [draft, meters, valid, onPreview]);
  return (
    <Sheet
      open
      title={editor.session ? 'Edit Session' : 'Add Session'}
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          {editor.session && (
            <Button variant="destructive" className="flex-1" disabled={busy} onClick={onDelete}>
              Delete Session
            </Button>
          )}
          <Button
            className="flex-1"
            disabled={!valid}
            loading={busy}
            onClick={() => onSave({ ...draft, distance_m: meters, note: draft.note.trim() })}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <SegmentedControl
          label="Slot"
          value={draft.slot}
          onChange={(slot) => setDraft({ ...draft, slot })}
          options={slots.map((value) => ({ value, label: value }))}
        />
        <SegmentedControl
          label="Modality"
          value={draft.modality}
          onChange={(modality) => setDraft({ ...draft, modality })}
          options={[
            { value: 'erg', label: 'Erg' },
            { value: 'bike', label: 'Bike' },
            { value: 'run', label: 'Run' },
          ]}
        />
        <fieldset>
          <legend className="mb-2 text-subhead">Zone</legend>
          <div className="flex flex-wrap gap-2">
            {ZONES.map((zone) => (
              <ZoneOption
                key={zone}
                zone={zone}
                selected={draft.zone === zone}
                onClick={() => setDraft({ ...draft, zone })}
              />
            ))}
          </div>
        </fieldset>
        <section>
          <div className="mb-3 flex items-center justify-between gap-4">
            <h3 className="text-subhead">Distance</h3>
            <div className="w-32">
              <SegmentedControl
                label="Distance Unit"
                value={unit}
                options={[
                  { value: 'm', label: 'm' },
                  { value: 'km', label: 'km' },
                ]}
                onChange={(next) => {
                  if (meters !== null && Number.isFinite(meters))
                    setDistance(String(meters / (next === 'km' ? 1000 : 1)));
                  setUnit(next);
                }}
              />
            </div>
          </div>
          <NumberField
            label={unit === 'm' ? 'Meters' : 'Kilometers'}
            suffix={unit}
            value={distance}
            onChange={(event) => setDistance(event.target.value)}
            error={!valid ? '1–200,000 Meters' : undefined}
          />
        </section>
        <TextField
          label="Note"
          value={draft.note}
          maxLength={200}
          onChange={(event) => setDraft({ ...draft, note: event.target.value })}
        />
      </div>
    </Sheet>
  );
}
