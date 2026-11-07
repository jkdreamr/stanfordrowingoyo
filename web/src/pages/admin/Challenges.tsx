import { useState } from 'react';
import { Flag, Plus } from 'lucide-react';
import type {
  TeamChallenge,
  TeamChallengeInput,
  ChallengeUnit,
  Modality,
} from '../../../../shared/types';
import {
  useAdminChallenges,
  useCreateChallenge,
  useUpdateChallenge,
  useEndChallenge,
  useDeleteChallenge,
  useConfig,
} from '../../lib/queries';
import {
  Button,
  IconButton,
  Card,
  ConfirmSheet,
  EmptyState,
  PageHeader,
  Sheet,
  TextField,
  Select,
  SegmentedControl,
  useToast,
} from '../../components/ui';
import { ChallengeProgress, ChallengeDates } from '../../components/TeamChallenges';
import { LoadState } from '../../components/shell/LoadState';

export default function Challenges() {
  const query = useAdminChallenges(),
    config = useConfig(),
    end = useEndChallenge(),
    remove = useDeleteChallenge();
  const [editing, setEditing] = useState<TeamChallenge | 'new'>();
  const [confirm, setConfirm] = useState<{ row: TeamChallenge; action: 'end' | 'delete' }>();
  const toast = useToast(),
    busy = end.isPending || remove.isPending;
  async function confirmAction() {
    if (!confirm || busy) return;
    try {
      if (confirm.action === 'end') await end.mutateAsync({ params: { id: confirm.row.id } });
      else await remove.mutateAsync({ params: { id: confirm.row.id } });
      toast.show({ title: confirm.action === 'end' ? 'Challenge Ended' : 'Challenge Deleted' });
      setConfirm(undefined);
    } catch {
      toast.show({ title: 'Could Not Save Challenge', tone: 'error' });
    }
  }
  return (
    <>
      <PageHeader
        title="Challenges"
        back="/admin"
        trailing={
          <IconButton
            aria-label="New Challenge"
            disabled={!config.data}
            onClick={() => setEditing('new')}
          >
            <Plus size={22} strokeWidth={1.75} />
          </IconButton>
        }
      />
      <div className="screen-stack">
        {!query.data ? (
          <LoadState error={query.isError} retry={() => void query.refetch()} />
        ) : !query.data.length ? (
          <EmptyState icon={<Flag size={20} />} title="No Challenges Yet" />
        ) : (
          query.data.map((row) => (
            <Card key={row.id} className="space-y-3" role="article" aria-label={row.title}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-headline">{row.title}</h2>
                <span className="text-footnote text-muted">
                  {{ active: 'Active', upcoming: 'Upcoming', ended: 'Ended' }[row.status]}
                </span>
              </div>
              <ChallengeProgress challenge={row} />
              <ChallengeDates challenge={row} />
              <div className="flex flex-wrap gap-2">
                {row.status !== 'ended' && (
                  <>
                    <Button variant="secondary" onClick={() => setEditing(row)}>
                      Edit
                    </Button>
                    <Button
                      variant="plain"
                      disabled={busy}
                      onClick={() => setConfirm({ row, action: 'end' })}
                    >
                      End Challenge
                    </Button>
                  </>
                )}
                <Button
                  variant="plain"
                  disabled={busy}
                  onClick={() => setConfirm({ row, action: 'delete' })}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
      {editing && config.data && (
        <ChallengeEditor
          row={editing === 'new' ? undefined : editing}
          today={config.data.today}
          onClose={() => setEditing(undefined)}
        />
      )}
      <ConfirmSheet
        open={!!confirm}
        title={confirm?.action === 'end' ? 'End Challenge?' : 'Delete Challenge?'}
        body={confirm?.row.title ?? ''}
        confirmLabel={confirm?.action === 'end' ? 'End Challenge' : 'Delete Challenge'}
        cancelLabel="Cancel"
        loading={busy}
        onClose={() => {
          if (!busy) setConfirm(undefined);
        }}
        onConfirm={() => void confirmAction()}
      />
    </>
  );
}
function ChallengeEditor({
  row,
  today,
  onClose,
}: {
  row?: TeamChallenge;
  today: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(row?.title ?? ''),
    [unit, setUnit] = useState<ChallengeUnit>(row?.unit ?? 'km'),
    [goal, setGoal] = useState(row ? String(row.goal_m / (row.unit === 'km' ? 1000 : 1)) : '');
  const [modality, setModality] = useState<Modality | ''>(row?.modality ?? ''),
    [start, setStart] = useState(row?.start_date ?? today),
    [end, setEnd] = useState(row?.end_date ?? today);
  const create = useCreateChallenge(),
    update = useUpdateChallenge(),
    toast = useToast(),
    busy = create.isPending || update.isPending;
  const meters = Number(goal) * (unit === 'km' ? 1000 : 1);
  const goal_m = Math.round(meters);
  const validDate = (date: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date + 'T12:00:00Z')) &&
    new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) === date;
  const valid =
    title.trim().length > 0 &&
    title.trim().length <= 60 &&
    Number.isFinite(meters) &&
    Math.abs(meters - goal_m) < 1e-6 &&
    goal_m >= 1 &&
    goal_m <= 1000000000 &&
    validDate(start) &&
    validDate(end) &&
    end >= start &&
    (Date.parse(end) - Date.parse(start)) / 86400000 <= 366;
  async function save() {
    if (!valid || busy) return;
    const body: TeamChallengeInput = {
      title: title.trim(),
      unit,
      goal_m,
      modality: modality || null,
      start_date: start,
      end_date: end,
    };
    try {
      if (row) await update.mutateAsync({ params: { id: row.id }, body });
      else await create.mutateAsync({ body });
      toast.show({ title: row ? 'Challenge Updated' : 'Challenge Created' });
      onClose();
    } catch (error) {
      toast.show({
        title: error instanceof Error ? error.message : 'Could Not Save Challenge',
        tone: 'error',
      });
    }
  }
  return (
    <Sheet
      open
      title={row ? 'Edit Challenge' : 'New Challenge'}
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <Button fullWidth loading={busy} disabled={!valid} onClick={() => void save()}>
          Save Challenge
        </Button>
      }
    >
      <fieldset disabled={busy} className="space-y-5">
        <TextField
          label="Title"
          value={title}
          maxLength={60}
          placeholder="5,000 km by Thanksgiving"
          onChange={(e) => setTitle(e.target.value)}
        />
        <SegmentedControl
          label="Unit"
          value={unit}
          onChange={(next) => {
            if (next === unit) return;
            if (goal.trim() && Number.isFinite(Number(goal)))
              setGoal(String(Number(goal) * (next === 'km' ? 1 / 1000 : 1000)));
            setUnit(next);
          }}
          options={[
            { value: 'km', label: 'km' },
            { value: 'emeters', label: 'E-meters' },
          ]}
        />
        <TextField
          label="Goal"
          type="number"
          min={unit === 'km' ? 0.001 : 1}
          max={unit === 'km' ? 1000000 : 1000000000}
          step={unit === 'km' ? 0.001 : 1}
          suffix={unit === 'km' ? 'km' : 'E-meters'}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
        <Select
          label="Modality"
          value={modality}
          onChange={(e) => setModality(e.target.value as Modality | '')}
        >
          <option value="">All</option>
          <option value="erg">Erg</option>
          <option value="bike">Bike</option>
          <option value="run">Run</option>
        </Select>
        <TextField
          label="Start Date"
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <TextField
          label="End Date"
          type="date"
          value={end}
          min={start}
          onChange={(e) => setEnd(e.target.value)}
        />
      </fieldset>
    </Sheet>
  );
}
