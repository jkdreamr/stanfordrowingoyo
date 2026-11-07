import { useState } from 'react';
import type { Settings } from '../../../../shared/types';
import { ZONES } from '../../../../shared/math';
import {
  Button,
  ConfirmSheet,
  ListGroup,
  NumberField,
  PageHeader,
  Select,
  useToast,
} from '../../components/ui';
import { LoadState } from '../../components/shell/LoadState';
import { useRecalculate, useSettings, useUpdateSettings } from '../../lib/queries';
import { useUnsavedChanges } from '../../lib/useUnsavedChanges';
import { formatNumber } from '../../lib/format';
import { groups, groupLabels } from './roster';
import { factorError, seasonError, targetError } from './operations';
import { generateJoinCode } from './joinCode';

export default function TeamSettings() {
  const query = useSettings();
  return (
    <>
      <PageHeader title="Team Settings" back="/admin" />
      {query.data ? (
        <SettingsForm key={JSON.stringify(query.data)} settings={query.data} />
      ) : (
        <LoadState error={query.isError} retry={() => void query.refetch()} />
      )}
    </>
  );
}
function SettingsForm({ settings }: { settings: Settings }) {
  const strings = (values: Record<string, number>) =>
    Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)]));
  const [zones, setZones] = useState(() => strings(settings.zone_factors));
  const [modes, setModes] = useState(() => strings(settings.mode_factors));
  const [targets, setTargets] = useState(() => strings(settings.group_targets));
  const [season, setSeason] = useState(settings.season_start);
  const snapshot = JSON.stringify({ zones, modes, targets, season });
  const [saved, setSaved] = useState(snapshot);
  const [confirm, setConfirm] = useState<'code' | 'recalculate'>();
  const [result, setResult] = useState<number>();
  const update = useUpdateSettings();
  const recalculate = useRecalculate();
  const { show } = useToast();
  const toast = (title: string, tone: 'default' | 'error' = 'default') => show({ title, tone });
  const numeric = (values: Record<string, string>) =>
    Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(value)]));
  const body = {
    zone_factors: numeric(zones) as Settings['zone_factors'],
    mode_factors: numeric(modes) as Settings['mode_factors'],
    group_targets: numeric(targets) as Settings['group_targets'],
    season_start: season,
  };
  const dirty = snapshot !== saved;
  const { blocker } = useUnsavedChanges(dirty);
  const invalid =
    [...Object.values(zones), ...Object.values(modes)].some((value) => factorError(value)) ||
    Object.values(targets).some((value) => targetError(value)) ||
    !!seasonError(season);
  const busy = update.isPending || recalculate.isPending;
  async function save() {
    try {
      await update.mutateAsync({ body });
      setSaved(snapshot);
      toast('Team settings saved');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save team settings', 'error');
    }
  }
  async function run() {
    try {
      if (confirm === 'code') {
        await update.mutateAsync({
          body: { team_code: generateJoinCode() },
        });
        toast('Join code regenerated');
      } else {
        const value = await recalculate.mutateAsync({});
        setResult(value.updated);
        toast(`Updated ${formatNumber(value.updated)} entries`);
      }
      setConfirm(undefined);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not complete this action', 'error');
    }
  }
  return (
    <div className="screen-stack">
      <ListGroup
        header="Join Code"
        footer="Share this code with teammates so they can find their name at signup."
      >
        <div className="space-y-3 p-4">
          <p className="text-subhead text-muted">Team Join Code</p>
          <p aria-label="Team Join Code" className="select-all break-all text-title1 font-semibold">
            {settings.team_code}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() =>
                void navigator.clipboard.writeText(settings.team_code).then(
                  () => toast('Join code copied'),
                  () =>
                    toast('Could not copy. Select the join code and copy it manually.', 'error'),
                )
              }
            >
              Copy Code
            </Button>
            <Button variant="plain" disabled={dirty || busy} onClick={() => setConfirm('code')}>
              Regenerate
            </Button>
          </div>
        </div>
      </ListGroup>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!invalid) void save();
        }}
      >
        <fieldset disabled={busy} className="space-y-6">
          <ListGroup
            header="Zone Factors"
            footer="Factors must be from 0.01 to 100. Changes apply to new entries; recalculate to update existing entries."
          >
            {ZONES.map((zone) => (
              <div
                className="border-b border-divider p-4 last:border-0 [&_.ui-field]:grid [&_.ui-field]:grid-cols-2 [&_.ui-field]:items-center [&_.ui-field>div]:col-start-2"
                key={zone}
              >
                <NumberField
                  label={`Zone ${zone}`}
                  value={zones[zone]}
                  error={factorError(zones[zone])}
                  onChange={(e) => setZones({ ...zones, [zone]: e.target.value })}
                />
              </div>
            ))}
          </ListGroup>
          <ListGroup header="Mode Factors">
            {(['erg', 'bike', 'run'] as const).map((mode) => (
              <div
                className="border-b border-divider p-4 last:border-0 [&_.ui-field]:grid [&_.ui-field]:grid-cols-2 [&_.ui-field]:items-center [&_.ui-field>div]:col-start-2"
                key={mode}
              >
                <NumberField
                  label={{ erg: 'Erg', bike: 'Bike', run: 'Run' }[mode]}
                  value={modes[mode]}
                  error={factorError(modes[mode])}
                  onChange={(e) => setModes({ ...modes, [mode]: e.target.value })}
                />
              </div>
            ))}
          </ListGroup>
          <ListGroup
            header="Group Weekly Targets"
            footer="Whole E-meters from 1,000 to 1,000,000. Changes take effect this week onward; personal overrides stay in place."
          >
            {groups.map((group) => (
              <div className="p-4" key={group}>
                <NumberField
                  label={groupLabels[group]}
                  suffix="m"
                  value={targets[group]}
                  error={targetError(targets[group])}
                  onChange={(e) => setTargets({ ...targets, [group]: e.target.value })}
                />
              </div>
            ))}
          </ListGroup>
          <ListGroup header="Season Start">
            <div className="space-y-2 p-4">
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Month"
                  value={season.slice(0, 2)}
                  onChange={(e) => setSeason(`${e.target.value}-${season.slice(3)}`)}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={String(i + 1).padStart(2, '0')}>
                      {new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(
                        new Date(Date.UTC(2000, i, 1)),
                      )}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Day"
                  value={season.slice(3)}
                  onChange={(e) => setSeason(`${season.slice(0, 2)}-${e.target.value}`)}
                >
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i} value={String(i + 1).padStart(2, '0')}>
                      {formatNumber(i + 1)}
                    </option>
                  ))}
                </Select>
              </div>
              {seasonError(season) && (
                <p role="alert" className="text-subhead text-danger">
                  {seasonError(season)}
                </p>
              )}
            </div>
          </ListGroup>
          <Button
            type="submit"
            fullWidth
            disabled={!dirty || invalid || busy}
            loading={update.isPending}
          >
            Save Settings
          </Button>
        </fieldset>
      </form>
      <ListGroup
        header="Existing Entries"
        footer="Recalculation uses the saved mode and zone factors. It does not change dates, distances or personal targets."
      >
        <div className="space-y-3 p-4">
          <Button
            variant="secondary"
            disabled={dirty || busy}
            onClick={() => setConfirm('recalculate')}
          >
            Recalculate All Entries
          </Button>
          {dirty && (
            <p className="text-subhead text-muted">
              Save or discard your changes before regenerating the code or recalculating.
            </p>
          )}
          {result !== undefined && (
            <p role="status" className="text-callout">
              Updated {formatNumber(result)} entries
            </p>
          )}
        </div>
      </ListGroup>
      <ConfirmSheet
        open={!!confirm}
        onClose={() => setConfirm(undefined)}
        onConfirm={() => void run()}
        loading={busy}
        title={confirm === 'code' ? 'Regenerate Join Code?' : 'Recalculate All Entries?'}
        body={
          confirm === 'code'
            ? 'The old join code will stop working immediately. Share the new code with teammates who have not joined yet.'
            : 'Apply the saved mode and zone factors to every existing entry. This changes training totals and cannot be undone automatically.'
        }
        confirmLabel={confirm === 'code' ? 'Regenerate Code' : 'Recalculate Entries'}
        cancelLabel="Cancel"
      />
      <ConfirmSheet
        open={blocker.state === 'blocked'}
        title="Discard Changes?"
        body="Your unsaved team settings will be lost."
        confirmLabel="Discard Changes"
        onConfirm={() => blocker.state === 'blocked' && blocker.proceed()}
        onClose={() => blocker.state === 'blocked' && blocker.reset()}
      />
    </div>
  );
}
