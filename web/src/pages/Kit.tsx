import { useState } from 'react';
import { Activity, Plus, Settings, Trash2, X } from 'lucide-react';
import * as UI from '../components/ui';
import { useTheme } from '../lib/theme';
import { ZONES } from '../../../shared/math';
export default function Kit() {
  const { theme, setTheme } = useTheme();
  const toast = UI.useToast();
  const [mode, setMode] = useState('erg');
  const [on, setOn] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [tab, setTab] = useState('week');
  const [zone, setZone] = useState('E');
  return (
    <main className="mx-auto max-w-[720px] pb-24">
      <UI.PageHeader
        title="Training Kit"
        trailing={
          <UI.IconButton aria-label="Settings" onClick={() => setSheet(true)}>
            <Settings size={20} strokeWidth={1.75} />
          </UI.IconButton>
        }
      />
      <div className="space-y-8 px-4">
        <p className="text-muted">Stanford Rowing · Frontend Foundation</p>
        <UI.SegmentedControl
          label="Appearance"
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
        <section className="space-y-4">
          <h2 className="text-title2">Weekly Progress</h2>
          <div className="flex flex-wrap gap-6">
            <UI.ProgressRing value={52000} max={80000} label="Weekly Target">
              <strong className="text-title2">65%</strong>
              <span className="text-caption text-muted">52.0k E-meters</span>
            </UI.ProgressRing>
            <UI.ProgressRing value={80000} max={80000} label="Target Hit">
              <strong className="text-title2">100%</strong>
              <span className="text-caption text-muted">Target Hit</span>
            </UI.ProgressRing>
            <UI.ProgressRing value={0} max={0} size={88} label="No Target">
              <span className="text-caption">No Target</span>
            </UI.ProgressRing>
          </div>
        </section>
        <section className="space-y-4">
          <h2 className="text-title2">Actions</h2>
          {(['primary', 'secondary', 'plain', 'destructive'] as const).map((variant) => (
            <div key={variant} className="flex flex-wrap items-center gap-3">
              <UI.Button variant={variant} size="sm">
                Small
              </UI.Button>
              <UI.Button variant={variant}>Medium</UI.Button>
              <UI.Button variant={variant} size="lg">
                Large
              </UI.Button>
              <UI.Button variant={variant} disabled>
                Disabled
              </UI.Button>
              <UI.Button variant={variant} loading>
                Saving
              </UI.Button>
            </div>
          ))}
          <UI.Button fullWidth leading={<Plus size={20} strokeWidth={1.75} />}>
            Log Session
          </UI.Button>
          <UI.Button to="/dev/kit" variant="plain">
            Link Button
          </UI.Button>
          <UI.IconButton aria-label="Remove Session">
            <Trash2 size={20} strokeWidth={1.75} />
          </UI.IconButton>
          <UI.IconButton aria-label="Unavailable" disabled>
            <X size={20} strokeWidth={1.75} />
          </UI.IconButton>
        </section>
        <section className="space-y-4">
          <h2 className="text-title2">Training Controls</h2>
          {(['sm', 'md', 'lg'] as const).map((size) => (
            <UI.SegmentedControl
              key={size}
              size={size}
              label={`Modality ${size}`}
              value={mode}
              onChange={setMode}
              options={[
                { value: 'erg', label: 'Erg' },
                { value: 'bike', label: 'Bike' },
                { value: 'run', label: 'Run' },
                { value: 'swim', label: 'Swim', disabled: true },
              ]}
            />
          ))}
          <div className="flex flex-wrap">
            {ZONES.map((z) => (
              <UI.ZoneOption key={z} zone={z} selected={zone === z} onClick={() => setZone(z)} />
            ))}
          </div>
          <UI.Toggle label="Share With Team" checked={on} onChange={setOn} />
          <UI.Toggle label="Private Session" checked={false} disabled onChange={() => {}} />
        </section>
        <UI.ListGroup header="Session Settings" footer="Only your team can see shared sessions">
          <UI.ListRow
            title="Josh Koo"
            subtitle="Normal · Senior"
            avatar={<UI.Avatar name="Josh Koo" />}
            trailing="80.0k"
            to="/dev/kit"
          />
          <UI.ListRow
            title="Modality"
            subtitle="Indoor Training"
            leading={<Activity size={20} strokeWidth={1.75} />}
            trailing="Erg"
            onClick={() => setSheet(true)}
          />
          <UI.ListRow title="Zone" trailing={<UI.ZoneChip zone="E" />} />
          <UI.ListRow
            title="Delete Session"
            tone="destructive"
            leading={<Trash2 size={20} strokeWidth={1.75} />}
            onClick={() =>
              toast.show({ title: 'Session Deleted', action: { label: 'Undo', onClick: () => {} } })
            }
          />
        </UI.ListGroup>
        <section className="space-y-4">
          <h2 className="text-title2">Fields</h2>
          <UI.TextField
            label="Session Name"
            placeholder="Morning Erg"
            hint="Give this session a short name"
          />
          <UI.NumberField label="Distance" suffix="m" defaultValue="12000" />
          <UI.NumberField
            label="Distance In Kilometers"
            suffix="km"
            inputMode="decimal"
            defaultValue="12.0"
          />
          <UI.TextField label="Split" defaultValue="1:72" error="Use a split like 1:52.4" />
          <UI.TextField label="Unavailable Field" disabled value="Team Setting" />
          <UI.TextArea label="Notes" placeholder="How did it feel?" />
          <UI.Select label="Visibility" hint="Choose who sees your session">
            <option>Team</option>
            <option>Only Me</option>
          </UI.Select>
        </section>
        <section className="space-y-4">
          <h2 className="text-title2">Surfaces And States</h2>
          <div className="flex items-center gap-4">
            <UI.Avatar name="Maya Chen" size="sm" />
            <UI.Avatar name="Josh Koo" />
            <UI.Avatar name="Alex Rivera" size="lg" imageId="missing-preview" />
          </div>
          <UI.Card>
            <h3 className="text-headline">Season Total</h3>
            <p className="text-title1">240.0k</p>
            <p className="text-footnote text-muted">E-meters Since September</p>
          </UI.Card>
          <UI.Skeleton className="h-16" />
          <UI.EmptyState
            icon={<Activity size={20} strokeWidth={1.75} />}
            title="No Sessions Yet"
            body="Your extra training starts here"
            action={<UI.Button onClick={() => setSheet(true)}>Log Session</UI.Button>}
          />
          <UI.Tabs
            label="Progress Period"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'week', label: 'This Week', content: '52,000 E-meters This Week' },
              { value: 'season', label: 'Season', content: '240,000 E-meters This Season' },
              { value: 'year', label: 'Year', content: '', disabled: true },
            ]}
          />
        </section>
        <section className="space-y-4">
          <h2 className="text-title2">Sheets And Feedback</h2>
          <UI.Button variant="secondary" onClick={() => setSheet(true)}>
            Open Sheet
          </UI.Button>
          <div className="flex flex-wrap gap-3">
            {(['default', 'success', 'error'] as const).map((tone) => (
              <UI.Button
                key={tone}
                variant="plain"
                onClick={() =>
                  toast.show({
                    title: tone === 'error' ? 'Could not save. Try again' : 'Session saved',
                    tone,
                    action: { label: 'Undo', onClick: () => {} },
                  })
                }
              >
                {tone === 'default'
                  ? 'Default Toast'
                  : tone === 'success'
                    ? 'Success Toast'
                    : 'Error Toast'}
              </UI.Button>
            ))}
          </div>
        </section>
        <UI.Sheet
          open={sheet}
          onClose={() => setSheet(false)}
          title="Session Details"
          footer={
            <UI.Button fullWidth onClick={() => setSheet(false)}>
              Done
            </UI.Button>
          }
        >
          <div className="space-y-4">
            <p className="text-muted">Extra training, counted precisely</p>
            <UI.NumberField label="Distance" suffix="m" defaultValue="12000" />
            <UI.TextArea label="Notes" />
          </div>
        </UI.Sheet>
      </div>
    </main>
  );
}
