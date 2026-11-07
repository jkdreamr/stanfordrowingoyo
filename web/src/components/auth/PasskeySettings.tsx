import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Passkey, PasskeyRegistrationOptions } from '../../../../shared/types';
import { api, ApiClientError } from '../../lib/api';
import { useAddPasskey, usePasskeys, useRemovePasskey, useVerifyPassword } from '../../lib/queries';
import {
  biometricLabel,
  createPasskey,
  freshOptions,
  isPasskeyCancel,
  passkeysSupported,
} from '../../lib/passkeys';
import { authError } from '../../lib/auth';
import { passkeyError } from '../../lib/usePasskeyLogin';
import { Button, ConfirmSheet, ListGroup, ListRow, Sheet, useToast } from '../ui';
import { FormErrors } from './FormErrors';
import { PasswordField } from './PasswordField';
import { PasskeyIcon } from './PasskeyIcon';

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const needsPassword = (error: unknown) =>
  error instanceof ApiClientError && error.detail.code === 'REAUTH_REQUIRED';

export function PasskeySettings({ onError }: { onError: (message?: string) => void }) {
  const supported = passkeysSupported();
  const label = biometricLabel();
  const { data: passkeys } = usePasskeys();
  const add = useAddPasskey();
  const remove = useRemovePasskey();
  const verify = useVerifyPassword();
  const toast = useToast();
  const options = useRef<PasskeyRegistrationOptions>();
  const [reauth, setReauth] = useState(false);
  const [sheet, setSheet] = useState<'password' | 'ready'>();
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string>();
  const [removing, setRemoving] = useState<Passkey>();
  const count = passkeys?.length ?? 0;
  const loaded = passkeys !== undefined;
  const prefetch = (reauth_token?: string) =>
    api('POST /api/me/passkeys/options', { body: reauth_token ? { reauth_token } : {} }).then(
      (value) => {
        options.current = value;
        setReauth(false);
      },
    );
  useEffect(() => {
    if (!supported || !loaded || count >= 10) return;
    prefetch().catch((error) => {
      options.current = undefined;
      if (needsPassword(error)) setReauth(true);
    });
  }, [supported, loaded, count]);

  async function create() {
    setBusy(true);
    onError(undefined);
    setSheetError(undefined);
    try {
      if (!freshOptions(options.current)) await prefetch();
      const current = options.current!;
      options.current = undefined;
      await add.mutateAsync({ body: await createPasskey(current) });
      setSheet(undefined);
      toast.show({ title: `${label} is on` });
    } catch (error) {
      if (needsPassword(error)) {
        setReauth(true);
        setSheet('password');
      } else if (!isPasskeyCancel(error)) {
        if (sheet) setSheetError(passkeyError(error));
        else onError(passkeyError(error));
      }
    } finally {
      setBusy(false);
    }
  }
  async function confirmPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const current = String(new FormData(e.currentTarget).get('current'));
    if (current.length < 8) return setSheetError('Enter your password');
    setBusy(true);
    setSheetError(undefined);
    try {
      const grant = await verify.mutateAsync({ body: { current_password: current } });
      await prefetch(grant.reauth_token);
      setSheet('ready');
    } catch (error) {
      setSheetError(authError(error));
    } finally {
      setBusy(false);
    }
  }
  if (!supported && !count) return null;
  return (
    <>
      <ListGroup header={label === 'Passkey' ? 'Passkeys' : label}>
        {passkeys?.map((passkey) => (
          <ListRow
            key={passkey.id}
            title={passkey.name}
            subtitle={
              passkey.last_used_at
                ? `Last used ${day(passkey.last_used_at)}`
                : `Added ${day(passkey.created_at)}`
            }
            leading={<PasskeyIcon label={label} />}
            trailing="Remove"
            onClick={() => setRemoving(passkey)}
          />
        ))}
        {supported && count < 10 && (
          <ListRow
            title={`Set Up ${label}`}
            chevron
            onClick={() => {
              if (busy) return;
              if (reauth) {
                setSheetError(undefined);
                setSheet('password');
              } else void create();
            }}
          />
        )}
      </ListGroup>
      <Sheet
        open={!!sheet}
        onClose={() => !busy && setSheet(undefined)}
        title={`Set Up ${label}`}
        footer={
          sheet === 'ready' ? (
            <Button fullWidth loading={busy} onClick={() => void create()}>
              Continue
            </Button>
          ) : (
            <Button type="submit" form="passkey-password" fullWidth loading={busy}>
              Verify
            </Button>
          )
        }
      >
        <FormErrors message={sheetError} />
        {sheet === 'ready' ? (
          <div className="flex justify-center py-2 text-accent-ink">
            <PasskeyIcon label={label} size={40} />
          </div>
        ) : (
          <form id="passkey-password" noValidate onSubmit={(e) => void confirmPassword(e)}>
            <PasswordField
              id="passkey-current-password"
              label="Current Password"
              name="current"
              autoComplete="current-password"
              required
            />
          </form>
        )}
      </Sheet>
      <ConfirmSheet
        open={!!removing}
        onClose={() => setRemoving(undefined)}
        title="Remove Passkey?"
        body={removing ? `${removing.name} will no longer log you in.` : ''}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(
            { params: { id: removing!.id } },
            {
              onSuccess: () => {
                setRemoving(undefined);
                toast.show({ title: 'Passkey removed' });
              },
              onError: (error) => {
                setRemoving(undefined);
                onError(passkeyError(error));
              },
            },
          )
        }
      />
    </>
  );
}
