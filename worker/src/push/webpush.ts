const encoder = new TextEncoder();

export function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error('Invalid base64url');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8),
  );
}

export interface EncryptOptions {
  salt?: Uint8Array;
  localKeys?: CryptoKeyPair;
}

/** RFC 8291 (aes128gcm, single record) Web Push message encryption. */
export async function encryptPayload(
  plaintext: Uint8Array,
  p256dh: Uint8Array,
  authSecret: Uint8Array,
  options: EncryptOptions = {},
): Promise<Uint8Array> {
  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const local =
    options.localKeys ??
    ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, [
      'deriveBits',
    ])) as CryptoKeyPair);
  const localPublic = new Uint8Array(
    (await crypto.subtle.exportKey('raw', local.publicKey)) as ArrayBuffer,
  );
  const remote = await crypto.subtle.importKey(
    'raw',
    p256dh,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: remote } as unknown as SubtleCryptoDeriveKeyAlgorithm,
      local.privateKey,
      256,
    ),
  );
  const ikm = await hkdf(
    authSecret,
    shared,
    concat(encoder.encode('WebPush: info\0'), p256dh, localPublic),
    32,
  );
  const cek = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      key,
      concat(plaintext, new Uint8Array([2])),
    ),
  );
  const header = new Uint8Array(21);
  header.set(salt);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = localPublic.length;
  return concat(header, localPublic, ciphertext);
}

export interface VapidConfig {
  publicKey: string;
  privateKey: CryptoKey;
  subject: string;
}

const vapidCache = new Map<string, Promise<VapidConfig | null>>();

export function vapidConfig(env: {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}): Promise<VapidConfig | null> {
  const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: subject } = env;
  if (!pub || !priv || !subject || !/^(mailto:|https:\/\/)\S+$/.test(subject))
    return Promise.resolve(null);
  const cacheKey = `${pub}\n${priv}\n${subject}`;
  let cached = vapidCache.get(cacheKey);
  if (!cached) {
    cached = (async () => {
      try {
        const point = fromBase64url(pub);
        const d = fromBase64url(priv);
        if (point.length !== 65 || point[0] !== 4 || d.length !== 32) return null;
        const privateKey = await crypto.subtle.importKey(
          'jwk',
          {
            kty: 'EC',
            crv: 'P-256',
            x: base64url(point.slice(1, 33)),
            y: base64url(point.slice(33)),
            d: base64url(d),
            ext: false,
          },
          { name: 'ECDSA', namedCurve: 'P-256' },
          false,
          ['sign'],
        );
        return { publicKey: pub, privateKey, subject };
      } catch {
        return null;
      }
    })();
    vapidCache.set(cacheKey, cached);
  }
  return cached;
}

export const publicVapidKey = async (env: Parameters<typeof vapidConfig>[0]) =>
  (await vapidConfig(env))?.publicKey ?? null;

const jwtCache = new Map<string, { token: string; reuseUntil: number }>();

/** RFC 8292 VAPID JWT (ES256), cached per push-service origin for at most one hour. */
export async function vapidJwt(vapid: VapidConfig, audience: string, now: number) {
  const cacheKey = `${vapid.publicKey}\n${vapid.subject}\n${audience}`;
  const cached = jwtCache.get(cacheKey);
  if (cached && cached.reuseUntil > now) return cached.token;
  const header = base64url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = base64url(
    encoder.encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(now / 1000) + 12 * 3600,
        sub: vapid.subject,
      }),
    ),
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      vapid.privateKey,
      encoder.encode(`${header}.${claims}`),
    ),
  );
  const token = `${header}.${claims}.${base64url(signature)}`;
  jwtCache.set(cacheKey, { token, reuseUntil: now + 3600_000 });
  return token;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendPush(
  vapid: VapidConfig,
  target: PushTarget,
  payload: unknown,
  now: number,
  ttl = 86400,
): Promise<Response> {
  const body = await encryptPayload(
    encoder.encode(JSON.stringify(payload)),
    fromBase64url(target.p256dh),
    fromBase64url(target.auth),
  );
  const jwt = await vapidJwt(vapid, new URL(target.endpoint).origin, now);
  return fetch(target.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: 'normal',
    },
    body,
  });
}
