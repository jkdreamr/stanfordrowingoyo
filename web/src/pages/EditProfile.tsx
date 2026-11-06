import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../../../shared/types';
import { useConfig, useMe, useUpdateMe } from '../lib/queries';
import { authError } from '../lib/auth';
import { formatNumber } from '../lib/format';
import { profileDraft, profileValues } from '../lib/profileForm';
import { usePhotos } from '../lib/usePhotos';
import { useUnsavedChanges } from '../lib/useUnsavedChanges';
import {
  Avatar,
  Button,
  ConfirmSheet,
  PhotoPicker,
  SegmentedControl,
  Select,
  TaskHeader,
  TextArea,
  TextField,
  useToast,
} from '../components/ui';
import { LoadState } from '../components/shell/LoadState';
import { FormErrors } from '../components/auth/FormErrors';
export default function EditProfile() {
  const me = useMe();
  const config = useConfig();
  if (!me.data || !config.data)
    return (
      <LoadState
        error={me.isError || config.isError}
        retry={() => {
          void me.refetch();
          void config.refetch();
        }}
      />
    );
  return <ProfileForm user={me.data} year={Number(config.data.today.slice(0, 4))} />;
}
function ProfileForm({ user, year }: { user: User; year: number }) {
  const initial = profileDraft(user);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const mutation = useUpdateMe();
  const toast = useToast();
  const navigate = useNavigate();
  const initialPhotos = user.avatar_image_id
    ? [
        {
          key: user.avatar_image_id,
          id: user.avatar_image_id,
          url: `/api/images/${encodeURIComponent(user.avatar_image_id)}`,
        },
      ]
    : [];
  const photos = usePhotos(initialPhotos, 1);
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(initial) ||
    photos.photos.some((p) => !!p.file) ||
    photos.photos.length !== initialPhotos.length;
  const { blocker, allowNavigation } = useUnsavedChanges(dirty);
  const values = profileValues(draft);
  const valid = Object.keys(values.errors).length === 0;
  function field(key: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const ids = await photos.save(512, true);
      await mutation.mutateAsync({ body: { ...values.body, avatar_image_id: ids[0] ?? null } });
      allowNavigation();
      toast.show({ title: 'Profile saved' });
      navigate('/me');
    } catch (error) {
      setMessage(authError(error));
      setBusy(false);
    }
  }
  const years = [
    ...new Set([
      ...Array.from({ length: 9 }, (_, n) => year - 4 + n),
      ...(user.class_year ? [user.class_year] : []),
    ]),
  ].sort((a, b) => a - b);
  return (
    <>
      <form noValidate onSubmit={(event) => void save(event)}>
        <TaskHeader
          title="Edit Profile"
          leading={
            <Button variant="plain" disabled={busy} onClick={() => navigate('/me')}>
              Cancel
            </Button>
          }
          trailing={
            <Button type="submit" variant="plain" disabled={!dirty || !valid} loading={busy}>
              Save
            </Button>
          }
        />
        <fieldset className="screen-stack" disabled={busy}>
          <FormErrors message={message} />
          <div className="flex justify-center">
            <Avatar name={draft.name} imageId={user.avatar_image_id} size="lg" />
          </div>
          <PhotoPicker
            photos={photos.photos}
            max={1}
            onAdd={photos.add}
            onRemove={photos.remove}
            disabled={busy}
          />
          <TextField
            label="Name"
            value={draft.name}
            autoComplete="name"
            onChange={(e) => field('name', e.target.value)}
            error={values.errors.name}
            required
          />
          <TextArea
            label="Bio"
            value={draft.bio}
            maxLength={160}
            rows={3}
            onChange={(e) => field('bio', e.target.value)}
            hint={`${formatNumber(draft.bio.length)}/160 characters`}
            error={values.errors.bio}
          />
          <section>
            <h2 className="mb-3 text-subhead">Side</h2>
            <SegmentedControl
              label="Side"
              value={draft.side}
              onChange={(value) => field('side', value)}
              options={[
                { value: 'port', label: 'Port' },
                { value: 'starboard', label: 'Starboard' },
                { value: 'both', label: 'Both' },
                { value: 'cox', label: 'Cox' },
              ]}
            />
          </section>
          <Select
            label="Class Year"
            value={draft.year}
            onChange={(e) => field('year', e.target.value)}
          >
            <option value="">Not Set</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
          <TextField
            label="Best 6k Split /500m"
            value={draft.six}
            placeholder="m:ss.t"
            onChange={(e) => field('six', e.target.value)}
            hint="Used for zone target paces"
            error={values.errors.six}
          />
          <TextField
            label="Best 2k Split /500m"
            value={draft.two}
            placeholder="m:ss.t"
            onChange={(e) => field('two', e.target.value)}
            hint="Used for zone A target pace"
            error={values.errors.two}
          />
        </fieldset>
      </form>
      <ConfirmSheet
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        title="Discard Changes?"
        body="Your unsaved profile changes will be lost"
        confirmLabel="Discard Changes"
      />
    </>
  );
}
