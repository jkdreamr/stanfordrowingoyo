import { useRef, useState, type FormEvent } from 'react';
import { Camera } from 'lucide-react';
import { ProfilePhotoCrop } from '../components/ProfilePhotoCrop';
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
  Sheet,
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
  const [photoSheet, setPhotoSheet] = useState(false);
  const [cropFile, setCropFile] = useState<File>();
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  function choose(file?: File) {
    if (!file) return;
    setPhotoSheet(false);
    setCropFile(file);
  }
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
    photos.photos.some((p) => !!p.file || !!p.blob) ||
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
            <button
              type="button"
              className="profile-photo-button"
              aria-label="Change Profile Photo"
              onClick={() => setPhotoSheet(true)}
            >
              <Avatar
                name={draft.name}
                imageId={photos.photos[0]?.id}
                src={photos.photos[0]?.blob ? photos.photos[0].url : undefined}
                size="lg"
              />
              <span className="profile-photo-badge">
                <Camera size={16} strokeWidth={1.75} aria-hidden="true" />
              </span>
            </button>
          </div>
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
          {user.role === 'rower' && (
            <Select
              label="Group"
              value={draft.group}
              onChange={(e) => field('group', e.target.value as User['group_key'])}
            >
              <option value="frosh">Frosh</option>
              <option value="normal">Normal Non-Frosh</option>
              <option value="u23">U23-Senior Hopefuls</option>
            </Select>
          )}
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
            hint="For zone paces"
            error={values.errors.six}
          />
          <TextField
            label="Best 2k Split /500m"
            value={draft.two}
            placeholder="m:ss.t"
            onChange={(e) => field('two', e.target.value)}
            hint="For zone A pace"
            error={values.errors.two}
          />
        </fieldset>
      </form>
      <input
        hidden
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="user"
        onChange={(event) => {
          choose(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <input
        hidden
        ref={libraryInput}
        type="file"
        accept="image/*"
        onChange={(event) => {
          choose(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {!cropFile && (
        <Sheet open={photoSheet} onClose={() => setPhotoSheet(false)} title="Profile Photo">
          <div className="profile-photo-actions">
            <Button fullWidth variant="secondary" onClick={() => cameraInput.current?.click()}>
              Take Photo
            </Button>
            <Button fullWidth variant="secondary" onClick={() => libraryInput.current?.click()}>
              Choose from Library
            </Button>
            {!!photos.photos.length && (
              <Button
                fullWidth
                variant="destructive"
                onClick={() => {
                  photos.remove(photos.photos[0].key);
                  setPhotoSheet(false);
                }}
              >
                Remove Photo
              </Button>
            )}
            <Button
              fullWidth
              variant="secondary"
              className="profile-photo-cancel"
              onClick={() => setPhotoSheet(false)}
            >
              Cancel
            </Button>
          </div>
        </Sheet>
      )}
      {cropFile && (
        <ProfilePhotoCrop
          file={cropFile}
          onCancel={() => setCropFile(undefined)}
          onDone={(blob) => {
            photos.addProcessed(blob);
            setCropFile(undefined);
          }}
        />
      )}
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
