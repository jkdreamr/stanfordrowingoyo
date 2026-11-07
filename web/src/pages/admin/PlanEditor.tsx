import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { ZONES } from '../../../../shared/math';
import type { GroupKey, Plan, PlanSlot, Zone } from '../../../../shared/types';
import {
  Button,
  ConfirmSheet,
  ListGroup,
  PageHeader,
  SegmentedControl,
  Sheet,
  TextArea,
  TextField,
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
  scheduleWeeks,
} from '../../components/plan/schedule';
import { useAdminPlan, useReplacePlan } from '../../lib/queries';
import { useUnsavedChanges } from '../../lib/useUnsavedChanges';
const GROUPS = [
  { value: 'frosh', label: 'Frosh' },
  { value: 'normal', label: 'Normal' },
  { value: 'u23', label: 'U23' },
] as const;
const WEEKS = [
  { value: '1', label: 'Week 1' },
  { value: '2', label: 'Week 2' },
] as const;
const KINDS = [
  { value: 'team', label: 'Team' },
  { value: 'oyo', label: 'OYO' },
  { value: 'off', label: 'Off' },
] as const;
export default function PlanEditor() {
  const query = useAdminPlan();
  return query.data ? (
    <PlanDraft initial={query.data} />
  ) : (
    <>
      <PageHeader title="Plan Editor" back="/admin" />
      <LoadState error={query.isError} retry={() => void query.refetch()} />
    </>
  );
}
function PlanDraft({ initial }: { initial: Plan }) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(() => structuredClone(initial));
  const [group, setGroup] = useState<GroupKey>('normal');
  const [week, setWeek] = useState<1 | 2>(1);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [editing, setEditing] = useState<PlanSlot>();
  const mutation = useReplacePlan();
  const { show } = useToast();
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const { blocker } = useUnsavedChanges(dirty);
  const error = planError(draft);
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
            disabled={!dirty || !!error || mutation.isPending}
            loading={mutation.isPending}
            onClick={() => void save()}
          >
            Save Plan
          </Button>
        }
      />
      <div className="screen-stack">
        <SegmentedControl label="Plan Group" value={group} onChange={setGroup} options={GROUPS} />
        <SegmentedControl
          label="Plan Week"
          value={week === 1 ? '1' : '2'}
          onChange={(value) => setWeek(value === '1' ? 1 : 2)}
          options={WEEKS}
        />
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
          <PlanWeek week={scheduleWeeks(draft, group)[week - 1]} preview />
        ) : (
          <>
            <TextField
              label="Week Total Label"
              value={
                draft.totals.find((row) => row.group_key === group && row.week === week)?.label ??
                ''
              }
              maxLength={200}
              disabled={mutation.isPending}
              onChange={(event) =>
                setDraft(replaceTotal(draft, { group_key: group, week, label: event.target.value }))
              }
            />
            {DAYS.map((dayName, day) => (
              <ListGroup key={dayName} header={dayName}>
                {SLOTS.map((slot) => {
                  const row = draft.slots.find(
                    (row) =>
                      row.group_key === group &&
                      row.week === week &&
                      row.day === day &&
                      row.slot === slot,
                  );
                  return (
                    <button
                      key={slot}
                      type="button"
                      aria-label={`Edit ${dayName} ${slot}`}
                      disabled={mutation.isPending}
                      onClick={() =>
                        setEditing(
                          row ?? {
                            group_key: group,
                            week,
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
                      <span className="w-10 shrink-0 text-caption text-muted">{slot}</span>
                      <span className="min-w-0 flex-1">
                        <span className="text-callout">
                          {row?.kind === 'team' ? 'Team' : row?.kind === 'oyo' ? 'OYO' : 'Off'}
                        </span>
                        {row?.kind !== 'off' && row?.text && (
                          <span className="mt-1 block truncate text-subhead text-muted">
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
        {editing && (
          <SlotEditor
            row={editing}
            onClose={() => setEditing(undefined)}
            onApply={(row) => {
              setDraft(replaceSlot(draft, row));
              setEditing(undefined);
            }}
          />
        )}
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
  onClose,
  onApply,
}: {
  row: PlanSlot;
  onClose: () => void;
  onApply: (row: PlanSlot) => void;
}) {
  const [slot, setSlot] = useState(row);
  return (
    <Sheet
      open
      title={`${DAYS[row.day]} ${row.slot}`}
      onClose={onClose}
      footer={
        <Button
          fullWidth
          disabled={slot.text.length > 2000}
          onClick={() => onApply(slot.kind === 'off' ? { ...slot, zone: null, text: '' } : slot)}
        >
          Apply To Draft
        </Button>
      }
    >
      <div className="space-y-5">
        <SegmentedControl
          label="Session Kind"
          value={slot.kind}
          onChange={(kind) => setSlot({ ...slot, kind })}
          options={KINDS}
        />
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
