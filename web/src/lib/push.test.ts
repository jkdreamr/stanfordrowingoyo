// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { applicationServerKey, disablePush, enablePush, pushSupport, syncPush } from './push';

const fetchMock = vi.fn();
let subscription: {
  endpoint: string;
  options: { applicationServerKey: ArrayBuffer | null };
  toJSON: () => unknown;
  unsubscribe: ReturnType<typeof vi.fn>;
} | null;
const pushManager = {
  getSubscription: vi.fn(async () => subscription),
  subscribe: vi.fn(async ({ applicationServerKey: key }: { applicationServerKey: Uint8Array }) => {
    subscription = fake('https://fcm.googleapis.com/fcm/send/new', key);
    return subscription;
  }),
};
function fake(endpoint: string, key: Uint8Array | null) {
  return {
    endpoint,
    options: { applicationServerKey: key ? (key.slice().buffer as ArrayBuffer) : null },
    toJSON: () => ({ endpoint, keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: vi.fn(async () => true),
  };
}
const KEY =
  'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';
beforeEach(() => {
  subscription = null;
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Chrome');
  window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: vi.fn(async () => ({ pushManager })), register: vi.fn() },
  });
  Object.assign(window, {
    PushManager: function PushManager() {},
    Notification: { permission: 'default', requestPermission: vi.fn(async () => 'granted') },
  });
  fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('reports push support, including iPhone outside the Home Screen', () => {
  expect(pushSupport()).toBe('ready');
  (window.Notification as unknown as { permission: string }).permission = 'denied';
  expect(pushSupport()).toBe('denied');
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone');
  expect(pushSupport()).toBe('needs-install');
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
  expect(pushSupport()).toBe('denied');
  delete (window as Partial<Window> & { PushManager?: unknown }).PushManager;
  expect(pushSupport()).toBe('unsupported');
});
it('decodes base64url VAPID keys', () => {
  const key = applicationServerKey(KEY);
  expect(key).toHaveLength(65);
  expect(key[0]).toBe(4);
});
it('subscribes after permission and registers the device', async () => {
  expect(await enablePush(KEY)).toBe('enabled');
  expect(pushManager.subscribe).toHaveBeenCalledWith({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey(KEY),
  });
  const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
  expect(url.pathname).toBe('/api/me/push');
  expect(init.method).toBe('PUT');
  expect(JSON.parse(init.body as string)).toEqual({
    endpoint: 'https://fcm.googleapis.com/fcm/send/new',
    keys: { p256dh: 'p', auth: 'a' },
  });
});
it('replaces subscriptions made with a different key and stops when permission is refused', async () => {
  const old = fake('https://fcm.googleapis.com/old', new Uint8Array([1, 2, 3]));
  subscription = old;
  await enablePush(KEY);
  expect(old.unsubscribe).toHaveBeenCalled();
  vi.mocked(window.Notification.requestPermission).mockResolvedValueOnce('denied');
  fetchMock.mockClear();
  expect(await enablePush(KEY)).toBe('denied');
  expect(fetchMock).not.toHaveBeenCalled();
});
it('re-registers existing subscriptions and removes them on disable', async () => {
  expect(await syncPush()).toBe(false);
  subscription = fake('https://web.push.apple.com/abc', null);
  expect(await syncPush()).toBe(true);
  const current = subscription;
  await disablePush();
  const [url, init] = fetchMock.mock.calls.at(-1) as [URL, RequestInit];
  expect(url.pathname).toBe('/api/me/push');
  expect(init.method).toBe('DELETE');
  expect(JSON.parse(init.body as string)).toEqual({ endpoint: 'https://web.push.apple.com/abc' });
  expect(current.unsubscribe).toHaveBeenCalled();
});
