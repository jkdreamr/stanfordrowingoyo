import { useState } from 'react';
import { ChevronDown, ChevronUp, ListFilter, Plus } from 'lucide-react';
import type { Modality, Preset, PresetInput, Settings } from '../../../../shared/types';
import { ZONES } from '../../../../shared/math';
import {
  DialogPresence,
  Button,
  ConfirmSheet,
  EmptyState,
  IconButton,
  ListGroup,
  NumberField,
  PageHeader,
  SegmentedControl,
  Select,
  Sheet,
  TextField,
  Toggle,
  ZoneChip,
  useToast,
} from '../../components/ui';
import { LoadState } from '../../components/shell/LoadState';
import {
  useCreatePreset,
  useDeletePreset,
  usePresets,
  useSettings,
  useUpdatePreset,
} from '../../lib/queries';
import { formatEMeters, formatNumber } from '../../lib/format';
import {
  formatPresetFactor,
  movePreset,
  orderedPresets,
  presetErrors,
  presetMeters,
} from './content';
const modalities = [
  { value: 'erg', label: 'Erg' },
  { value: 'bike', label: 'Bike' },
  { value: 'run', label: 'Run' },
] as const;
export default function Presets() {
  const query = usePresets();
  const settings = useSettings();
  const update = useUpdatePreset();
  const remove = useDeletePreset();
  const [modality, setModality] = useState<Modality>('erg');
  const [editing, setEditing] = useState<Preset | 'new'>();
  const [deleting, setDeleting] = useState<Preset>();
  const [moving, setMoving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const { show } = useToast();
  const busy = moving || update.isPending || remove.isPending;
  async function move(row: Preset, direction: -1 | 1) {
    setMoving(true);
    try {
      for (const change of movePreset(query.data ?? [], row.id, direction))
        await update.mutateAsync({ params: { id: change.id }, body: { sort: change.sort } });
      show({ title: 'Preset order saved' });
    } catch (error) {
      show({
        title:
          error instanceof Error
            ? `${error.message} Some positions may have saved. Try again.`
            : 'Could not save order. Some positions may have saved.',
        tone: 'error',
      });
      void query.refetch();
    } finally {
      setMoving(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Presets"
        back="/admin"
        trailing={
          <div className="flex items-center gap-1">
            <Button
              variant="plain"
              disabled={busy || !query.data}
              onClick={() => setReordering(!reordering)}
            >
              {reordering ? 'Done' : 'Reorder'}
            </Button>
            <IconButton
              aria-label="Add Preset"
              onClick={() => setEditing('new')}
              disabled={reordering || !settings.data || !query.data}
            >
              <Plus size={22} />
            </IconButton>
          </div>
        }
      />
      <div className="screen-stack">
        <SegmentedControl
          label="Preset Modality"
          value={modality}
          onChange={setModality}
          options={modalities}
        />
        {!query.data || !settings.data ? (
          <LoadState
            error={query.isError || settings.isError}
            retry={() => {
              void query.refetch();
              void settings.refetch();
            }}
          />
        ) : (
          <>
            {!query.data.some((row) => row.modality === modality) && (
              <EmptyState
                icon={<ListFilter size={20} />}
                title="No Presets Yet"
                action={
                  <Button disabled={reordering || !settings.data} onClick={() => setEditing('new')}>
                    Add Preset
                  </Button>
                }
              />
            )}
            {ZONES.map((zone) => {
              const rows = orderedPresets(
                query.data.filter((row) => row.modality === modality && row.zone === zone),
              );
              if (!rows.length) return null;
              return (
                <section key={zone} aria-label={`Zone ${zone} Presets`} className="space-y-2">
                  <h2 className="flex items-center gap-2 px-4 text-subhead text-muted">
                    <ZoneChip zone={zone} /> Zone {zone}
                  </h2>
                  <ListGroup>
                    {rows.map((row, index) => (
                      <article
                        key={row.id}
                        aria-label={row.name}
                        className="border-b border-divider p-4 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className="block min-h-11 min-w-0 flex-1 text-left disabled:opacity-100"
                            disabled={reordering}
                            onClick={() => setEditing(row)}
                            aria-label={`Edit ${row.name}`}
                          >
                            <span className="block text-headline">{row.name}</span>
                            <span className="mt-1 block text-subhead text-muted">
                              {row.distance_m === null
                                ? `Enter meters · × ${formatPresetFactor(settings.data!.mode_factors[modality] * settings.data!.zone_factors[zone])}`
                                : `${formatNumber(row.distance_m)} m · ${formatEMeters(presetMeters(row, settings.data!)!)}`}
                            </span>
                          </button>
                          {reordering ? (
                            <span className="text-footnote text-muted">
                              {row.active ? 'Active' : 'Inactive'}
                            </span>
                          ) : (
                            <div className="shrink-0 [&_label]:sr-only">
                              <Toggle
                                label="Active"
                                checked={row.active}
                                disabled={busy}
                                onChange={(active) =>
                                  update.mutate(
                                    { params: { id: row.id }, body: { active } },
                                    {
                                      onError: (error) =>
                                        show({ title: error.message, tone: 'error' }),
                                      onSuccess: () =>
                                        show({
                                          title: active ? 'Preset activated' : 'Preset deactivated',
                                        }),
                                    },
                                  )
                                }
                              />
                            </div>
                          )}
                        </div>
                        {reordering && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              variant="secondary"
                              leading={<ChevronUp size={18} />}
                              aria-label={`Move Up: ${row.name}`}
                              disabled={busy || index === 0}
                              onClick={() => void move(row, -1)}
                            >
                              Move Up
                            </Button>
                            <Button
                              variant="secondary"
                              leading={<ChevronDown size={18} />}
                              aria-label={`Move Down: ${row.name}`}
                              disabled={busy || index === rows.length - 1}
                              onClick={() => void move(row, 1)}
                            >
                              Move Down
                            </Button>
                          </div>
                        )}
                      </article>
                    ))}
                  </ListGroup>
                </section>
              );
            })}
          </>
        )}
      </div>
      <DialogPresence>
        {editing && settings.data && (
          <PresetEditor
            row={editing === 'new' ? undefined : editing}
            modality={modality}
            rows={query.data ?? []}
            settings={settings.data}
            onClose={() => setEditing(undefined)}
            onDelete={(row) => {
              setEditing(undefined);
              setDeleting(row);
            }}
          />
        )}
      </DialogPresence>
      <ConfirmSheet
        open={!!deleting}
        title="Delete Preset?"
        body={`Remove “${deleting?.name ?? ''}” from the session picker? Existing entries are not changed.`}
        confirmLabel="Delete Preset"
        loading={remove.isPending}
        onClose={() => setDeleting(undefined)}
        onConfirm={() =>
          deleting &&
          remove.mutate(
            { params: { id: deleting.id } },
            {
              onSuccess: () => {
                setDeleting(undefined);
                show({ title: 'Preset deleted' });
              },
              onError: (error) => show({ title: error.message, tone: 'error' }),
            },
          )
        }
      />
    </>
  );
}
function PresetEditor({
  row,
  modality,
  rows,
  settings,
  onClose,
  onDelete,
}: {
  row?: Preset;
  modality: Modality;
  rows: Preset[];
  settings: Settings;
  onClose: () => void;
  onDelete: (row: Preset) => void;
}) {
  const [input, setInput] = useState<PresetInput>(
    () =>
      row ?? {
        name: '',
        modality,
        zone: 'E',
        distance_m: 10000,
        active: true,
        sort: Math.min(1000000, Math.max(0, ...rows.map((item) => item.sort)) + 10),
      },
  );
  const [distance, setDistance] = useState(
    row?.distance_m == null ? '10000' : String(row.distance_m),
  );
  const create = useCreatePreset();
  const update = useUpdatePreset();
  const { show } = useToast();
  const errors = presetErrors(input);
  const pending = create.isPending || update.isPending;
  const preview = presetMeters(input, settings);
  async function save() {
    try {
      if (row) await update.mutateAsync({ params: { id: row.id }, body: input });
      else await create.mutateAsync({ body: input });
      show({ title: row ? 'Preset saved' : 'Preset created' });
      onClose();
    } catch (error) {
      show({
        title: error instanceof Error ? error.message : 'Could not save preset',
        tone: 'error',
      });
    }
  }
  return (
    <Sheet
      open
      title={row ? 'Edit Preset' : 'Add Preset'}
      onClose={pending ? () => {} : onClose}
      footer={
        <Button
          fullWidth
          disabled={pending || !!errors.name || !!errors.distance}
          loading={pending}
          onClick={() => void save()}
        >
          Save Preset
        </Button>
      }
    >
      <fieldset disabled={pending} className="space-y-5">
        <TextField
          label="Name"
          value={input.name}
          maxLength={120}
          error={errors.name}
          onChange={(e) => setInput({ ...input, name: e.target.value })}
        />
        <SegmentedControl
          label="Modality"
          value={input.modality}
          options={modalities}
          onChange={(modality) => setInput({ ...input, modality })}
        />
        <Select
          label="Zone"
          value={input.zone}
          onChange={(e) => setInput({ ...input, zone: e.target.value as PresetInput['zone'] })}
        >
          {ZONES.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </Select>
        <Toggle
          label="Enter Meters Each Time"
          checked={input.distance_m === null}
          onChange={(variable) =>
            setInput({ ...input, distance_m: variable ? null : Number(distance) })
          }
        />
        {input.distance_m !== null && (
          <NumberField
            label="Distance"
            suffix="m"
            value={distance}
            error={errors.distance}
            onChange={(e) => {
              setDistance(e.target.value);
              setInput({ ...input, distance_m: Number(e.target.value) });
            }}
          />
        )}
        <p role="status" className="rounded-xl bg-surface-2 p-4 text-callout">
          {input.distance_m === null
            ? `E-meters = distance × ${formatPresetFactor(settings.mode_factors[input.modality] * settings.zone_factors[input.zone])}`
            : preview === null
              ? 'Enter a valid distance.'
              : formatEMeters(preview)}
        </p>
        <Toggle
          label="Active"
          checked={input.active}
          onChange={(active) => setInput({ ...input, active })}
        />
        {row && (
          <Button variant="destructive" onClick={() => onDelete(row)}>
            Delete Preset
          </Button>
        )}
      </fieldset>
    </Sheet>
  );
}
