import { useEffect, useRef, useState } from 'react';
import type { PasskeyRegistrationOptions } from '../../../../shared/types';
import { api } from '../../lib/api';
import { useAddPasskey, useMe } from '../../lib/queries';
import {
  biometricLabel,
  createPasskey,
  dismissPasskeyOffer,
  freshOptions,
  isPasskeyCancel,
  passkeyOfferDismissed,
  platformAuthenticatorAvailable,
  takePasskeyOffer,
} from '../../lib/passkeys';
import { passkeyError } from '../../lib/usePasskeyLogin';
import { Button, Sheet, useToast } from '../ui';
import { FormErrors } from './FormErrors';
import { PasskeyIcon } from './PasskeyIcon';

/** One-time prompt after a password login to add this device's passkey. */
export function PasskeyOffer() {
  const { data: me } = useMe();
  const add = useAddPasskey();
  const toast = useToast();
  const label = biometricLabel();
  const options = useRef<PasskeyRegistrationOptions>();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  useEffect(() => {
    if (!me || me.must_change_password || !takePasskeyOffer()) return;
    if (passkeyOfferDismissed(me.id)) return;
    void (async () => {
      try {
        if (!(await platformAuthenticatorAvailable())) return;
        if ((await api('GET /api/me/passkeys', {})).length) return;
        options.current = await api('POST /api/me/passkeys/options', { body: {} });
        setOpen(true);
      } catch {
        /* the prompt is optional */
      }
    })();
  }, [me]);
  const close = () => {
    if (me) dismissPasskeyOffer(me.id);
    setOpen(false);
  };
  async function turnOn() {
    setBusy(true);
    setMessage(undefined);
    try {
      const current = freshOptions(options.current)
        ? options.current!
        : await api('POST /api/me/passkeys/options', { body: {} });
      options.current = undefined;
      await add.mutateAsync({ body: await createPasskey(current) });
      close();
      toast.show({ title: `${label} is on` });
    } catch (error) {
      if (!isPasskeyCancel(error)) setMessage(passkeyError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      open={open}
      onClose={() => !busy && close()}
      title={`Log In with ${label}?`}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth disabled={busy} onClick={close}>
            Not Now
          </Button>
          <Button fullWidth loading={busy} onClick={() => void turnOn()}>
            Turn On
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-3 py-2 text-accent-ink">
        <PasskeyIcon label={label} size={40} />
        <FormErrors message={message} />
      </div>
    </Sheet>
  );
}
