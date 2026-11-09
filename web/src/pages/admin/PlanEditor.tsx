import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { addDays, weekStart } from '../../../../shared/dates';
import { ZONES } from '../../../../shared/math';
import type { Plan, PlanSlot, Zone } from '../../../../shared/types';
import {
  DialogPresence,
  Button,
  ConfirmSheet,
  ListGroup,
  PageHeader,
  SegmentedControl,
  Sheet,
  TextArea,
  TextField,
  Toggle,
  ZoneChip,
  ZoneOption,
  useToast,
} from '../../components/ui';
import { LoadState } from '../../components/shell/LoadState';
import { PlanWeek } from '../../components/plan/PlanWeek';
import {
  DAYS,
  SLOTS,
  planError,
  replaceSlot,
  replaceTotal,
  scheduleWeek,
  slotLabel,
} from '../../components/plan/schedule';
import { useAdminPlan, useReplacePlan, useConfig } from '../../lib/queries';
import { useUnsavedChanges } from '../../lib/useUnsavedChanges';
import { WeekStepper } from '../../components/plan/WeekStepper';
import { api } from '../../lib/api';
const KINDS = [
  { value: 'team', label: 'Team' },
  { value: 'oyo', label: 'OYO' },
  { value: 'off', label: 'Off' },
] as const;
export default function PlanEditor() {
  const config = useConfig();
  const [params, setParams] = useSearchParams();
  const week = params.get('week') ?? (config.data ? weekStart(config.data.today) : undefined);
  const query = useAdminPlan(week ? { week } : {});
  return query.data && config.data ? (
    <PlanDraft
      key={query.data.week_start}
      initial={query.data}
      today={config.data.today}
      onWeekChange={(week) => setParams({ week })}
    />
  ) : (
    <>
      <PageHeader title="Plan Editor" back="/admin" />
      <LoadState error={query.isError} retry={() => void query.refetch()} />
    </>
  );
}
function PlanDraft({
  initial,
  today,
  onWeekChange,
}: {
  initial: Plan;
  today: string;
  onWeekChange: (week: string) => void;
}) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(() => structuredClone(initial));
  const week = initial.week_start;
  const [copyConfirm, setCopyConfirm] = useState(false);
  const [copying, setCopying] = useState(false);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [editing, setEditing] = useState<PlanSlot>();
  const mutation = useReplacePlan();
  const { show } = useToast();
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const { blocker } = useUnsavedChanges(dirty);
  const error = planError(draft, today);
  const hasPM2 = draft.slots.some((row) => row.slot === 'PM2');
  async function copyPrevious() {
    setCopying(true);
    try {
      const previous = await api('GET /api/admin/plan', { query: { week: addDays(week, -7) } });
      setDraft({ ...previous, week_start: week });
      setCopyConfirm(false);
      show({
        title: previous.slots.length ? 'Previous week copied to draft' : 'Previous week is empty',
      });
    } catch (error) {
      show({
        title: error instanceof Error ? error.message : 'Could not copy previous week',
        tone: 'error',
      });
    } finally {
      setCopying(false);
    }
  }
  async function save() {
    try {
      const result = await mutation.mutateAsync({ body: draft });
      setSaved(result);
      setDraft(result);
      show({ title: 'Plan saved' });
    } catch (error) {
      show({
        title: error instanceof Error ? error.message : 'Could not save plan',
        tone: 'error',
      });
    }
  }
  return (
    <>
      <PageHeader
        title="Plan Editor"
        back="/admin"
        trailing={
          <Button
            variant="plain"
            disabled={!dirty || !!error || mutation.isPending || copying}
            loading={mutation.isPending}
            onClick={() => void save()}
          >
            Save Plan
          </Button>
        }
      />
      <div className="screen-stack">
        <WeekStepper
          week={week}
          today={today}
          onChange={onWeekChange}
          disabled={mutation.isPending || copying}
        />
        <Button
          variant="secondary"
          loading={copying}
          disabled={mutation.isPending || addDays(week, -7) < '2000-01-01'}
          onClick={() =>
            draft.slots.length || draft.totals.length ? setCopyConfirm(true) : void copyPrevious()
          }
        >
          Copy Previous Week
        </Button>
        <SegmentedControl
          label="Plan View"
          value={view}
          onChange={setView}
          options={[
            { value: 'edit', label: 'Edit' },
            { value: 'preview', label: 'Preview' },
          ]}
        />
        <p role="status" className="text-subhead text-muted">
          {dirty ? 'Unsaved changes' : 'Saved'}
        </p>
        {view === 'preview' ? (
          <PlanWeek week={scheduleWeek(draft)} today={today} preview />
        ) : (
          <>
            <TextField
              label="Week Total Label"
              value={draft.totals[0]?.label ?? ''}
              maxLength={200}
              disabled={mutation.isPending || copying}
              onChange={(event) => setDraft(replaceTotal(draft, { label: event.target.value }))}
            />
            {DAYS.map((dayName, day) => (
              <ListGroup key={dayName} header={dayName}>
                {SLOTS.map((slot) => {
                  const row = draft.slots.find((row) => row.day === day && row.slot === slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      aria-label={`Edit ${dayName} ${slotLabel(slot, hasPM2)}`}
                      disabled={mutation.isPending || copying}
                      onClick={() =>
                        setEditing(
                          row ?? {
                            day,
                            slot,
                            kind: 'off',
                            zone: null,
                            text: '',
                          },
                        )
                      }
                      className="flex min-h-11 w-full items-center gap-3 border-b border-divider p-4 text-left last:border-0"
                    >
                      <span className="w-10 shrink-0 text-caption text-muted">
                        {slotLabel(slot, hasPM2)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-callout">
                          {row?.kind === 'team' ? 'Team' : row?.kind === 'oyo' ? 'OYO' : 'Off'}
                        </span>
                        {row?.kind !== 'off' && row?.text && (
                          <span className="mt-1 block whitespace-pre-line text-subhead text-muted">
                            {row.text}
                          </span>
                        )}
                      </span>
                      {row?.kind !== 'off' && row?.zone && <ZoneChip zone={row.zone} />}
                      <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
                    </button>
                  );
                })}
              </ListGroup>
            ))}
          </>
        )}
        {error && (
          <p role="alert" className="text-subhead text-danger">
            {error}
          </p>
        )}
        <DialogPresence>
          {editing && (
            <SlotEditor
              row={editing}
              hasPM2={hasPM2}
              onClose={() => setEditing(undefined)}
              onApply={(row) => {
                setDraft(replaceSlot(draft, row));
                setEditing(undefined);
              }}
            />
          )}
        </DialogPresence>
        <ConfirmSheet
          open={copyConfirm}
          title="Replace Draft?"
          body="Replace this draft with the previous week's schedule? Nothing is published until Save Plan."
          confirmLabel="Copy Previous Week"
          loading={copying}
          onConfirm={() => void copyPrevious()}
          onClose={() => setCopyConfirm(false)}
        />
        <ConfirmSheet
          open={blocker.state === 'blocked'}
          title="Discard Changes?"
          body="Your unsaved training plan will be lost."
          confirmLabel="Discard Changes"
          onConfirm={() => blocker.state === 'blocked' && blocker.proceed()}
          onClose={() => blocker.state === 'blocked' && blocker.reset()}
        />
      </div>
    </>
  );
}
function SlotEditor({
  row,
  hasPM2,
  onClose,
  onApply,
}: {
  row: PlanSlot;
  hasPM2: boolean;
  onClose: () => void;
  onApply: (row: PlanSlot) => void;
}) {
  const [slot, setSlot] = useState(row);
  return (
    <Sheet
      open
      title={`${DAYS[row.day]} ${slotLabel(row.slot, hasPM2)}`}
      onClose={onClose}
      footer={
        <Button fullWidth disabled={slot.text.length > 2000} onClick={() => onApply(slot)}>
          Apply To Draft
        </Button>
      }
    >
      <div className="space-y-5">
        <SegmentedControl
          label="Session Kind"
          value={slot.kind}
          onChange={(kind) =>
            setSlot({ ...slot, kind, counts_oyo: kind === 'team' && !!slot.counts_oyo })
          }
          options={KINDS}
        />
        {slot.kind === 'team' && (
          <Toggle
            label="Counts toward OYO meters"
            checked={slot.counts_oyo ?? false}
            onChange={(counts_oyo) => setSlot({ ...slot, counts_oyo })}
          />
        )}
        {slot.kind !== 'off' ? (
          <>
            <fieldset>
              <legend className="mb-2 text-subhead">Zone (Optional)</legend>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  aria-pressed={slot.zone === null}
                  onClick={() => setSlot({ ...slot, zone: null })}
                >
                  No Zone
                </Button>
                {ZONES.map((zone: Zone) => (
                  <ZoneOption
                    key={zone}
                    zone={zone}
                    selected={slot.zone === zone}
                    onClick={() => setSlot({ ...slot, zone })}
                  />
                ))}
              </div>
            </fieldset>
            <TextArea
              label="Session Text"
              value={slot.text}
              maxLength={2000}
              onChange={(event) => setSlot({ ...slot, text: event.target.value })}
            />
          </>
        ) : (
          <p className="text-subhead text-muted">No session scheduled.</p>
        )}
        <p className="text-footnote text-muted">Apply edits the draft. Save Plan publishes it.</p>
      </div>
    </Sheet>
  );
}
