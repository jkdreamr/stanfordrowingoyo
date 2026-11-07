import { useCallback, useEffect, useRef, useState } from 'react';
import type { PasskeyLoginOptions, User } from '../../../shared/types';
import { api, ApiClientError } from './api';
import { usePasskeyLogin } from './queries';
import {
  conditionalMediationAvailable,
  freshOptions,
  getPasskey,
  isPasskeyCancel,
  passkeysSupported,
} from './passkeys';

export function passkeyError(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 429) return 'Too many attempts. Wait a few minutes and try again';
    if (error.detail.code === 'PASSKEY_UNKNOWN')
      return 'Passkey not found. Log in with your password';
    if (error.detail.code === 'PASSKEY_CHALLENGE_EXPIRED') return 'Request expired. Try again';
    return error.detail.message;
  }
  if (error instanceof DOMException) return 'Passkey sign-in failed. Try again';
  return 'Could not connect. Check your connection and try again';
}

/** Passkey sign-in: a conditional (autofill) request runs in the background; the button aborts it. */
export function usePasskeySignIn(onUser: (user: User) => void, onError: (message: string) => void) {
  const login = usePasskeyLogin();
  const supported = passkeysSupported();
  const prefetched = useRef<PasskeyLoginOptions>();
  const conditional = useRef<AbortController>();
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);
  const callbacks = useRef({ onUser, onError, login: login.mutateAsync });
  callbacks.current = { onUser, onError, login: login.mutateAsync };

  const finish = useCallback(async (assertion: Awaited<ReturnType<typeof getPasskey>>) => {
    const user = await callbacks.current.login({ body: assertion });
    callbacks.current.onUser(user);
  }, []);
  const prefetch = useCallback(() => {
    api('POST /api/auth/passkey/options', {}).then(
      (options) => (prefetched.current = options),
      () => (prefetched.current = undefined),
    );
  }, []);

  useEffect(() => {
    if (!supported) return;
    prefetch();
    let cancelled = false;
    const controller = new AbortController();
    conditional.current = controller;
    void (async () => {
      if (!(await conditionalMediationAvailable()) || cancelled) return;
      try {
        const options = await api('POST /api/auth/passkey/options', { signal: controller.signal });
        const assertion = await getPasskey(options, {
          conditional: true,
          signal: controller.signal,
        });
        setBusy(true);
        try {
          await finish(assertion);
        } finally {
          if (!cancelled) setBusy(false);
        }
      } catch (error) {
        if (!controller.signal.aborted && !isPasskeyCancel(error))
          callbacks.current.onError(passkeyError(error));
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // `round` restarts autofill after a button attempt aborted it.
  }, [supported, prefetch, finish, round]);

  const signIn = useCallback(async () => {
    if (busy) return;
    conditional.current?.abort();
    setBusy(true);
    try {
      const options = freshOptions(prefetched.current)
        ? prefetched.current!
        : await api('POST /api/auth/passkey/options', {});
      prefetched.current = undefined;
      await finish(await getPasskey(options));
    } catch (error) {
      if (!isPasskeyCancel(error)) callbacks.current.onError(passkeyError(error));
      setRound((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }, [busy, finish]);

  return { supported, busy, signIn };
}
