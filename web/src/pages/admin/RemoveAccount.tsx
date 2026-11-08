import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '../../../../shared/types';
import { api } from '../../lib/api';
import { authError } from '../../lib/auth';
import { qk } from '../../lib/queries';
import { FormErrors } from '../../components/auth/FormErrors';
import { Button, Sheet, TextField, useToast } from '../../components/ui';

export function RemoveAccount({
  user,
  close,
  onRemoved,
}: {
  user: User;
  close: () => void;
  onRemoved: () => void;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const client = useQueryClient();
  const toast = useToast();
  async function remove() {
    if (busy || email.trim().toLowerCase() !== user.email.toLowerCase()) return;
    setBusy(true);
    setMessage(undefined);
    try {
      await api('POST /api/admin/users/:id/remove', {
        params: { id: user.id },
        body: { confirmation_email: email.trim() },
      });
      toast.show({ title: 'Account removed' });
      onRemoved();
      await client.invalidateQueries({
        queryKey: qk.all,
        predicate: (query) => query.queryKey[1] !== 'images',
      });
    } catch (error) {
      setMessage(authError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      open
      onClose={() => {
        if (!busy) close();
      }}
      title="Remove Account?"
      footer={
        <div className="flex gap-3">
          <Button fullWidth variant="secondary" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button
            fullWidth
            variant="destructive"
            loading={busy}
            disabled={email.trim().toLowerCase() !== user.email.toLowerCase()}
            onClick={() => void remove()}
          >
            Remove
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-headline">{user.name}</p>
        <p className="text-subhead text-muted">
          Permanently deletes this account, linked roster name, workouts, erg tests, photos,
          comments, kudos, private plans and authored team challenges. Removes tags, mentions and
          leaderboard results. A sanitized audit record remains.
        </p>
        <p className="text-subhead">
          Cannot be undone. Ask the rower to download their data first if needed.
        </p>
        <p className="break-all text-subhead">Type {user.email} to confirm.</p>
        <TextField
          label="Confirm Email"
          type="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          disabled={busy}
          onChange={(event) => setEmail(event.target.value)}
        />
        <FormErrors message={message} />
      </div>
    </Sheet>
  );
}
