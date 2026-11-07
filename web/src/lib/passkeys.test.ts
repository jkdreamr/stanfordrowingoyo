// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  biometricLabel,
  conditionalMediationAvailable,
  createPasskey,
  dismissPasskeyOffer,
  freshOptions,
  fromBase64Url,
  getPasskey,
  isPasskeyCancel,
  markPasskeyOffer,
  passkeyOfferDismissed,
  passkeysSupported,
  platformAuthenticatorAvailable,
  takePasskeyOffer,
  toBase64Url,
} from './passkeys';

const bytes = (...values: number[]) => new Uint8Array(values).buffer;
afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
});

describe('passkey helpers', () => {
  it('round-trips base64url without padding', () => {
    for (const length of [0, 1, 2, 3, 31, 32, 33]) {
      const input = Uint8Array.from({ length }, (_, i) => (i * 97 + 251) % 256);
      const encoded = toBase64Url(input);
      expect(encoded).not.toMatch(/[+/=]/);
      expect([...fromBase64Url(encoded)]).toEqual([...input]);
    }
    expect(toBase64Url(bytes(0xfb, 0xff))).toBe('-_8');
  });
  it('names the platform authenticator', () => {
    expect(biometricLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5)).toBe(
      'Face ID',
    );
    expect(biometricLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('Face ID');
    expect(biometricLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('Touch ID');
    expect(biometricLabel('Mozilla/5.0 (Linux; Android 14; Pixel 7)', 5)).toBe('Fingerprint');
    expect(biometricLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0)).toBe('Windows Hello');
    expect(biometricLabel('Mozilla/5.0 (X11; Linux x86_64)', 0)).toBe('Passkey');
  });
  it('detects support and swallows capability errors', async () => {
    expect(passkeysSupported()).toBe(false);
    expect(await platformAuthenticatorAvailable()).toBe(false);
    vi.stubGlobal(
      'PublicKeyCredential',
      Object.assign(function PublicKeyCredential() {}, {
        isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.reject(new Error('x')),
      }),
    );
    vi.stubGlobal('navigator', { ...navigator, credentials: {} });
    expect(passkeysSupported()).toBe(true);
    expect(await platformAuthenticatorAvailable()).toBe(false);
    expect(await conditionalMediationAvailable()).toBe(false);
  });
  it('treats only cancel and abort as silent', () => {
    expect(isPasskeyCancel(new DOMException('x', 'NotAllowedError'))).toBe(true);
    expect(isPasskeyCancel(new DOMException('x', 'AbortError'))).toBe(true);
    expect(isPasskeyCancel(new DOMException('x', 'InvalidStateError'))).toBe(false);
    expect(isPasskeyCancel(new Error('x'))).toBe(false);
  });
  it('refreshes options within a minute of expiry', () => {
    const now = Date.parse('2026-03-01T00:00:00Z');
    expect(freshOptions(undefined, now)).toBe(false);
    expect(freshOptions({ expires_at: '2026-03-01T00:00:30Z' }, now)).toBe(false);
    expect(freshOptions({ expires_at: '2026-03-01T00:04:00Z' }, now)).toBe(true);
  });
  it('offers enrollment once per login and remembers dismissal per user', () => {
    expect(takePasskeyOffer()).toBe(false);
    markPasskeyOffer();
    expect(takePasskeyOffer()).toBe(true);
    expect(takePasskeyOffer()).toBe(false);
    expect(passkeyOfferDismissed('u1')).toBe(false);
    dismissPasskeyOffer('u1');
    expect(passkeyOfferDismissed('u1')).toBe(true);
    expect(passkeyOfferDismissed('u2')).toBe(false);
  });
  it('maps WebAuthn create and get to the API shapes', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'cred',
      rawId: bytes(1, 2),
      response: {
        clientDataJSON: bytes(3),
        attestationObject: bytes(4),
        getTransports: () => ['internal', 'hybrid'],
      },
    });
    const get = vi.fn().mockResolvedValue({
      id: 'cred',
      rawId: bytes(1, 2),
      response: {
        clientDataJSON: bytes(5),
        authenticatorData: bytes(6),
        signature: bytes(7),
        userHandle: null,
      },
    });
    vi.stubGlobal('navigator', { ...navigator, credentials: { create, get } });
    const common = { challenge: 'AQID', rp_id: 'oyo.test', timeout_ms: 1000, expires_at: '' };
    expect(
      await createPasskey({
        ...common,
        rp_name: 'OYO',
        user: { id: 'dXNlcg', name: 'a@b.c', display_name: 'A' },
        exclude_credentials: [{ id: 'AQ', transports: ['internal'] }],
      }),
    ).toEqual({
      id: 'cred',
      raw_id: 'AQI',
      client_data_json: 'Aw',
      attestation_object: 'BA',
      transports: ['internal', 'hybrid'],
    });
    const publicKey = create.mock.calls[0][0].publicKey;
    expect(publicKey.rp).toEqual({ id: 'oyo.test', name: 'OYO' });
    expect(publicKey.pubKeyCredParams.map((p: { alg: number }) => p.alg)).toEqual([-7, -257]);
    expect(publicKey.authenticatorSelection).toMatchObject({
      residentKey: 'required',
      userVerification: 'required',
    });
    expect([...publicKey.excludeCredentials[0].id]).toEqual([1]);
    const signal = new AbortController().signal;
    expect(await getPasskey(common, { conditional: true, signal })).toEqual({
      id: 'cred',
      raw_id: 'AQI',
      client_data_json: 'BQ',
      authenticator_data: 'Bg',
      signature: 'Bw',
      user_handle: null,
    });
    expect(get.mock.calls[0][0]).toMatchObject({ mediation: 'conditional', signal });
    expect(get.mock.calls[0][0].publicKey).toMatchObject({
      rpId: 'oyo.test',
      userVerification: 'required',
    });
    get.mockResolvedValueOnce(null);
    await expect(getPasskey(common)).rejects.toMatchObject({ name: 'NotAllowedError' });
  });
});
