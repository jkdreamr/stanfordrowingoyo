import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Users } from 'lucide-react';
import { TeammatePicker } from '../components/social/TeammatePicker';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { addDays } from '../../../shared/dates';
import { equivalentMeters, targetPace } from '../../../shared/math';
import type { Config, EntryDetail, Preset, User } from '../../../shared/types';
import {
  useConfig,
  useCreateEntry,
  useDeleteEntry,
  useEntry,
  useMe,
  useUpdateEntry,
} from '../lib/queries';
import {
  distanceMeters,
  logDraft,
  logReceipt,
  logValues,
  suggestedTitle,
  type LogDraft,
} from '../lib/logForm';
import { formatEMeters, formatFactor, formatKm, formatSplit } from '../lib/format';
import { usePhotos, type DraftPhoto } from '../lib/usePhotos';
import { useUnsavedChanges } from '../lib/useUnsavedChanges';
import { authError } from '../lib/auth';
import { api, ApiClientError } from '../lib/api';
import {
  deleteLogDraft,
  loadLogDraft,
  restorePhotos,
  saveLogDraft,
  storePhotos,
  type StoredLogDraft,
} from '../lib/logDraftStore';
import { recordTargetFinish } from '../lib/targetFinish';
import {
  Button,
  Card,
  ConfirmSheet,
  Disclosure,
  ListGroup,
  ListRow,
  NumberField,
  PhotoPicker,
  SegmentedControl,
  Sheet,
  TaskHeader,
  TextArea,
  TextField,
  Toggle,
  useToast,
  ZoneChip,
  ZoneOption,
} from '../components/ui';
import { FormErrors } from '../components/auth/FormErrors';
import { logPrefill } from '../lib/myPlan';
import { LoadState } from '../components/shell/LoadState';
export default function Log() {
  const [params] = useSearchParams();
  const edit = params.get('edit') ?? '';
  const config = useConfig();
  const me = useMe();
  const entry = useEntry(edit);
  if (!config.data || !me.data || (edit && !entry.data))
    return (
      <LoadState
        error={config.isError || me.isError || (!!edit && entry.isError)}
        retry={() => {
          void config.refetch();
          void me.refetch();
          if (edit) void entry.refetch();
        }}
      />
    );
  return (
    <DraftLogForm
      key={`${edit}:${params.toString()}`}
      config={config.data}
      user={me.data}
      entry={edit ? entry.data : undefined}
      preset={config.data.presets.find((p) => p.id === params.get('preset') && p.active)}
      detailsOpen={params.get('details') === '1'}
      prefill={logPrefill(params)}
    />
  );
}
function DraftLogForm(props: Parameters<typeof LogForm>[0]) {
  const [loaded, setLoaded] = useState<{ value: StoredLogDraft | null; photos: DraftPhoto[] }>();
  useEffect(() => {
    let active = true;
    if (!props.entry)
      void loadLogDraft(props.user.id).then((value) => {
        if (active) setLoaded({ value, photos: value ? restorePhotos(value.photos) : [] });
      });
    return () => {
      active = false;
    };
  }, [props.entry, props.user.id]);
  if (!props.entry && !loaded) return <LoadState error={false} retry={() => {}} />;
  return (
    <LogForm {...props} restored={loaded?.value ?? undefined} restoredPhotos={loaded?.photos} />
  );
}
function LogForm({
  config,
  user,
  entry,
  preset,
  detailsOpen,
  prefill,
  restored,
  restoredPhotos,
}: {
  config: Config;
  user: User;
  entry?: EntryDetail;
  preset?: Preset;
  detailsOpen: boolean;
  prefill: ReturnType<typeof logPrefill>;
  restored?: StoredLogDraft;
  restoredPhotos?: DraftPhoto[];
}) {
  const initial = { ...logDraft(config.today, entry, preset), ...prefill };
  const initialDetails =
    detailsOpen ||
    !!entry?.duration_s ||
    !!entry?.avg_split_s ||
    !!entry?.stroke_rate ||
    !!entry?.avg_hr;
  const [draft, setDraft] = useState(restored?.draft ?? initial);
  const [idempotencyKey] = useState(() => restored?.idempotencyKey ?? crypto.randomUUID());
  const saving = useRef(false);
  const submitted = useRef(restored?.submitted ?? false);
  const [details, setDetails] = useState(restored?.details ?? initialDetails);
  const [tagged, setTagged] = useState(restored?.tagged ?? entry?.tagged ?? []);
  const [tagging, setTagging] = useState(false);
  const [receipt, setReceipt] = useState(false);
  const [menu, setMenu] = useState(false);
  const [allZones, setAllZones] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const create = useCreateEntry();
  const update = useUpdateEntry();
  const remove = useDeleteEntry();
  const navigate = useNavigate();
  const toast = useToast();
  const initialPhotos = (entry?.images ?? []).map((p) => ({
    key: p.id,
    id: p.id,
    url: `/api/images/${encodeURIComponent(p.id)}`,
  }));
  const [seedPhotos] = useState(() => restoredPhotos ?? initialPhotos);
  const photos = usePhotos(seedPhotos);
  const dirty =
    (!entry && submitted.current) ||
    JSON.stringify(draft) !== JSON.stringify(initial) ||
    (!entry && details !== initialDetails) ||
    JSON.stringify(tagged.map((u) => u.id).sort()) !==
      JSON.stringify((entry?.tagged ?? []).map((u) => u.id).sort()) ||
    photos.photos.some((p) => p.file || p.blob) ||
    photos.photos.length !== initialPhotos.length;
  const { blocker, allowNavigation } = useUnsavedChanges(dirty);
  const stopped = useRef(false);
  const latest = useRef({ draft, details, tagged, photos: photos.photos, dirty });
  latest.current = { draft, details, tagged, photos: photos.photos, dirty };
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const persist = () => {
    if (entry || stopped.current) return Promise.resolve();
    const value = latest.current;
    return value.dirty || submitted.current
      ? saveLogDraft(user.id, {
          draft: value.draft,
          details: value.details,
          tagged: value.tagged,
          photos: storePhotos(value.photos),
          idempotencyKey,
          submitted: submitted.current,
          savedAt: Date.now(),
        })
      : deleteLogDraft(user.id);
  };
  const persistRef = useRef(persist);
  persistRef.current = persist;
  async function clearStored() {
    stopped.current = true;
    submitted.current = false;
    clearTimeout(timer.current);
    if (!entry) await deleteLogDraft(user.id);
  }
  const restoredToast = useRef(false);
  useEffect(() => {
    if (!restored || restoredToast.current) return;
    restoredToast.current = true;
    toast.show({
      title: 'Draft Restored',
      action: {
        label: 'Discard',
        onClick: () => {
          void clearStored();
          setDraft(initial);
          setDetails(detailsOpen);
          setTagged([]);
          photos.reset();
          setMessage(undefined);
          setTouched({});
        },
      },
    });
  });
  useEffect(() => {
    if (entry) return;
    // Resume storage after a discarded draft is edited again.
    if (dirty) stopped.current = false;
    timer.current = setTimeout(() => {
      void persistRef.current();
    }, 400);
    return () => clearTimeout(timer.current);
  }, [draft, details, tagged, photos.photos, dirty, entry]);
  useEffect(() => {
    if (entry) return;
    const flush = () => {
      clearTimeout(timer.current);
      void persistRef.current();
    };
    const hidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [entry]);
  const values = logValues(draft, config, photos.photos);
  const valid = Object.keys(values.errors).length === 0;
  function field<K extends keyof LogDraft>(key: K, value: LogDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setTouched((current) => ({ ...current, [key]: true }));
  }
  const error = (key: string) =>
    touched[key] || (key === 'split' && (touched.duration || touched.distance))
      ? values.errors[key]
      : undefined;
  const pace =
    draft.modality === 'erg'
      ? targetPace(draft.zone, user.best6k_split_s, user.best2k_split_s)
      : null;
  function choose(p: Preset) {
    setDraft((current) => ({
      ...current,
      preset: p.id,
      modality: p.modality,
      zone: p.zone,
      title: p.name,
      distance:
        p.distance_m === null ? '' : String(p.distance_m / (current.unit === 'km' ? 1000 : 1)),
    }));
    setMenu(false);
    if (p.distance_m === null)
      requestAnimationFrame(() => document.getElementById('distance')?.focus());
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving.current || busy || !valid) return;
    saving.current = true;
    if (!entry) submitted.current = true;
    setBusy(true);
    setMessage(undefined);
    try {
      if (!entry) await persistRef.current();
      const ids = await photos.save();
      const body = { ...values.input, image_ids: ids, tagged_user_ids: tagged.map((u) => u.id) };
      if (!entry) await persistRef.current();
      const previous = await api('GET /api/stats/week', {}).catch(() => null);
      const saved = entry
        ? await update.mutateAsync({ params: { id: entry.id }, body })
        : await create.mutateAsync({ body, idempotencyKey, retry: true });
      if (!entry) await clearStored();
      const next = await api('GET /api/stats/week', {}).catch(() => null);
      if (next && saved.week_start === config.current_week_start)
        recordTargetFinish(previous, next, user.id, saved.week_start);
      allowNavigation();
      toast.show({
        title: 'Session saved',
        action: { label: 'View', onClick: () => navigate(`/entries/${saved.id}`) },
      });
      navigate('/');
    } catch (error) {
      if (!entry && error instanceof ApiClientError && error.detail.code === 'NETWORK_ERROR') {
        await persistRef.current();
        setMessage('No connection. Draft saved.');
      } else setMessage(authError(error));
      setBusy(false);
      saving.current = false;
    }
  }
  const formula = config.presets.find((p) => p.id === draft.preset)?.distance_m === null;
  return (
    <>
      <form onSubmit={(event) => void save(event)} noValidate>
        <TaskHeader
          title={entry ? 'Edit Session' : 'Log Session'}
          leading={
            <Button variant="plain" disabled={busy} onClick={() => navigate('/')}>
              Cancel
            </Button>
          }
          trailing={
            <Button type="submit" variant="plain" disabled={!valid} loading={busy}>
              Save
            </Button>
          }
        />
        <fieldset disabled={busy} className="screen-stack log-form">
          <FormErrors message={message} />
          <SegmentedControl
            label="Modality"
            value={draft.modality}
            onChange={(value) =>
              setDraft((current) => ({ ...current, modality: value, preset: null }))
            }
            options={[
              { value: 'erg', label: 'Erg' },
              { value: 'bike', label: 'Bike' },
              { value: 'run', label: 'Run' },
            ]}
          />
          <section>
            <h2 className="mb-2 text-subhead">Zone</h2>
            <fieldset aria-label="Zone" className="zone-grid">
              {config.zones.map((zone) => (
                <ZoneOption
                  key={zone}
                  zone={zone}
                  selected={draft.zone === zone}
                  onClick={() => setDraft((current) => ({ ...current, zone, preset: null }))}
                />
              ))}
            </fieldset>
            {pace !== null && (
              <p className="mt-2 text-footnote text-muted tabular-nums">
                Target {formatSplit(pace)} /500m
              </p>
            )}
            {draft.modality === 'erg' && pace === null && (
              <p className="mt-2 text-footnote text-muted">
                Add a best split in Edit Profile for zone paces
              </p>
            )}
          </section>
          <section>
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="text-subhead">Distance</h2>
              <div className="w-32">
                <SegmentedControl
                  label="Distance Unit"
                  size="sm"
                  value={draft.unit}
                  options={[
                    { value: 'm', label: 'm' },
                    { value: 'km', label: 'km' },
                  ]}
                  onChange={(unit) =>
                    setDraft((current) => ({
                      ...current,
                      unit,
                      distance: current.distance
                        ? String(distanceMeters(current) / (unit === 'km' ? 1000 : 1))
                        : '',
                    }))
                  }
                />
              </div>
            </div>
            <NumberField
              id="distance"
              label={draft.unit === 'm' ? 'Meters' : 'Kilometers'}
              suffix={draft.unit}
              value={draft.distance}
              onChange={(e) => field('distance', e.target.value)}
              onBlur={() => setTouched((current) => ({ ...current, distance: true }))}
              error={error('distance')}
              hint={formula ? 'Enter meters rowed' : undefined}
            />
            <div className="mt-4">
              <ListGroup>
                <ListRow title="Choose From Workout Menu" onClick={() => setMenu(true)} chevron />
              </ListGroup>
            </div>
          </section>
          <Card>
            <p className="text-caption text-muted">Equivalent Distance</p>
            {!values.errors.distance ? (
              <>
                <p className="mt-2 text-title1 tabular-nums">
                  ={' '}
                  {formatEMeters(
                    Number.isFinite(values.equivalent) && values.equivalent > 0
                      ? values.equivalent
                      : 0,
                  )}
                </p>
                <Disclosure
                  title={
                    <span className="text-footnote text-muted tabular-nums">
                      {logReceipt(draft, config)}
                    </span>
                  }
                  open={receipt}
                  onChange={setReceipt}
                >
                  <p className="text-footnote text-muted">
                    For {formatKm(distanceMeters(draft))} of{' '}
                    {draft.modality === 'erg'
                      ? 'rowing'
                      : draft.modality === 'bike'
                        ? 'cycling'
                        : 'running'}
                    , the configured mode factor {formatFactor(config.mode_factors[draft.modality])}{' '}
                    and Zone {draft.zone} factor {formatFactor(config.zone_factors[draft.zone])}{' '}
                    convert your actual distance to {formatEMeters(values.equivalent)}
                  </p>
                </Disclosure>
              </>
            ) : (
              <>
                <p className="mt-2 text-title1 text-muted">—</p>
                <p className="mt-2 text-footnote text-muted">Enter a distance</p>
              </>
            )}
          </Card>
          <Disclosure title="Add Details" open={details} onChange={setDetails}>
            <TextField
              id="duration"
              label="Time"
              placeholder="h:mm:ss"
              value={draft.duration}
              onChange={(e) => field('duration', e.target.value)}
              onBlur={() => setTouched((current) => ({ ...current, duration: true }))}
              error={error('duration')}
            />
            {draft.modality === 'erg' && (
              <TextField
                id="split"
                label="Split /500m"
                placeholder={values.derivedSplit ? formatSplit(values.derivedSplit) : 'm:ss.t'}
                value={draft.split}
                onChange={(e) => field('split', e.target.value)}
                onBlur={() => setTouched((current) => ({ ...current, split: true }))}
                hint={
                  values.derivedSplit
                    ? 'Calculated from time and distance unless you enter a split'
                    : 'Optional average split'
                }
                error={error('split')}
              />
            )}
            <div className="field-pair">
              <NumberField
                id="rate"
                label="Stroke Rate"
                suffix="spm"
                value={draft.rate}
                onChange={(e) => field('rate', e.target.value)}
                onBlur={() => setTouched((current) => ({ ...current, rate: true }))}
                error={error('rate')}
              />
              <NumberField
                id="hr"
                label="Average HR"
                suffix="bpm"
                value={draft.hr}
                onChange={(e) => field('hr', e.target.value)}
                onBlur={() => setTouched((current) => ({ ...current, hr: true }))}
                error={error('hr')}
              />
            </div>
          </Disclosure>
          <TextField
            id="title"
            label="Title"
            value={draft.title}
            placeholder={suggestedTitle(draft)}
            onChange={(e) => field('title', e.target.value)}
            error={error('title')}
          />
          <TextArea
            label="Notes"
            value={draft.notes}
            onChange={(e) => field('notes', e.target.value)}
            rows={3}
            placeholder="Optional session notes"
            error={error('notes')}
          />
          <ListGroup>
            <ListRow
              title="Tag Teammates"
              leading={<Users size={20} strokeWidth={1.75} />}
              trailing={
                tagged.length
                  ? `${tagged.length} ${tagged.length === 1 ? 'Teammate' : 'Teammates'}`
                  : undefined
              }
              chevron
              onClick={() => setTagging(true)}
            />
          </ListGroup>
          <PhotoPicker
            photos={photos.photos}
            onAdd={photos.add}
            onRemove={photos.remove}
            disabled={busy}
          />
          {values.errors.photos && (
            <p role="alert" className="text-footnote text-danger">
              {values.errors.photos}
            </p>
          )}
          <TextField
            id="date"
            label="Date"
            type="date"
            min="2020-01-01"
            max={addDays(config.today, 1)}
            value={draft.date}
            onChange={(e) => field('date', e.target.value)}
            onBlur={() => setTouched((current) => ({ ...current, date: true }))}
            error={error('date')}
          />
          {entry && (
            <Button variant="destructive" fullWidth onClick={() => setDeleting(true)}>
              Delete Session
            </Button>
          )}
        </fieldset>
      </form>
      {tagging && (
        <TeammatePicker
          self={entry?.user_id ?? user.id}
          selected={tagged}
          onChange={setTagged}
          onClose={() => setTagging(false)}
        />
      )}
      <Sheet open={menu} onClose={() => setMenu(false)} title="Workout Menu">
        <div className="mb-5">
          <Toggle label="All Zones" checked={allZones} onChange={setAllZones} />
          <p className="mt-2 text-footnote text-muted">
            {draft.modality === 'erg' ? 'Erg' : draft.modality === 'bike' ? 'Bike' : 'Run'} workouts
            {!allZones ? ` · Zone ${draft.zone}` : ''}
          </p>
        </div>
        <div className="space-y-5">
          {config.zones
            .filter((z) => allZones || z === draft.zone)
            .map((zone) => {
              const presets = config.presets.filter(
                (p) => p.active && p.modality === draft.modality && p.zone === zone,
              );
              return presets.length ? (
                <ListGroup key={zone} header={`Zone ${zone}`}>
                  {presets.map((p) => (
                    <ListRow
                      key={p.id}
                      title={p.name}
                      subtitle={
                        p.distance_m === null ? 'Enter meters rowed' : formatKm(p.distance_m)
                      }
                      trailing={
                        p.distance_m === null ? (
                          <ZoneChip zone={zone} />
                        ) : (
                          formatEMeters(
                            equivalentMeters(
                              p.distance_m,
                              p.modality,
                              p.zone,
                              config.mode_factors,
                              config.zone_factors,
                            ),
                            true,
                          ) + ' E-m'
                        )
                      }
                      onClick={() => choose(p)}
                    />
                  ))}
                </ListGroup>
              ) : null;
            })}
          {!config.presets.some(
            (p) => p.active && p.modality === draft.modality && (allZones || p.zone === draft.zone),
          ) && (
            <p className="text-subhead text-muted">
              No workouts in this zone. Show all zones or enter a distance
            </p>
          )}
        </div>
      </Sheet>
      <ConfirmSheet
        open={blocker.state === 'blocked'}
        title="Discard Changes?"
        body="Your unsaved session will be lost"
        confirmLabel="Discard Changes"
        onClose={() => blocker.reset?.()}
        onConfirm={() => {
          void clearStored().then(() => blocker.proceed?.());
        }}
      />
      <ConfirmSheet
        open={deleting}
        title="Delete Session?"
        body="This session and its photos will be removed from your log"
        confirmLabel="Delete Session"
        loading={remove.isPending}
        onClose={() => setDeleting(false)}
        onConfirm={() => {
          if (!entry) return;
          remove.mutate(
            { params: { id: entry.id } },
            {
              onSuccess: () => {
                allowNavigation();
                toast.show({ title: 'Session deleted' });
                navigate('/');
              },
              onError: (error) => {
                setDeleting(false);
                setMessage(authError(error));
              },
            },
          );
        }}
      />
    </>
  );
}
