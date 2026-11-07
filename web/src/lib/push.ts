import { api } from './api';
import { isIos, isStandalone } from './install';

export type PushSupport = 'ready' | 'needs-install' | 'denied' | 'unsupported';

export function pushSupport(win: Window = window): PushSupport {
  const supported =
    'serviceWorker' in win.navigator && 'PushManager' in win && 'Notification' in win;
  if (isIos(win.navigator) && !isStandalone(win)) return 'needs-install';
  if (!supported) return 'unsupported';
  return (win as Window & typeof globalThis).Notification.permission === 'denied'
    ? 'denied'
    : 'ready';
}

export function applicationServerKey(base64url: string) {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

const sameKey = (subscription: PushSubscription, key: Uint8Array) => {
  const current = subscription.options?.applicationServerKey;
  if (!current) return true;
  const bytes = new Uint8Array(current);
  return bytes.length === key.length && bytes.every((byte, index) => byte === key[index]);
};

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
  return navigator.serviceWorker.ready;
}

export async function currentSubscription() {
  if (pushSupport() === 'unsupported' || pushSupport() === 'needs-install') return null;
  const existing = await navigator.serviceWorker.getRegistration();
  return (await existing?.pushManager.getSubscription()) ?? null;
}

function serialize(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
  };
}

/** Asks permission (from a user gesture), subscribes this device and registers it. */
export async function enablePush(publicKey: string): Promise<'enabled' | 'denied'> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const key = applicationServerKey(publicKey);
  const reg = await registration();
  let subscription = await reg.pushManager.getSubscription();
  if (subscription && !sameKey(subscription, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  });
  await api('PUT /api/me/push', { body: serialize(subscription) });
  return 'enabled';
}

/** Re-registers an existing subscription so a signed-in user keeps receiving pushes. */
export async function syncPush() {
  const subscription = await currentSubscription();
  if (subscription) await api('PUT /api/me/push', { body: serialize(subscription) });
  return !!subscription;
}

export async function disablePush() {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await api('DELETE /api/me/push', { body: { endpoint: subscription.endpoint } }).catch(() => {});
  await subscription.unsubscribe().catch(() => false);
}
