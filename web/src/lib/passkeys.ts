import type {
  PasskeyAssertion,
  PasskeyAttestation,
  PasskeyLoginOptions,
  PasskeyRegistrationOptions,
  PasskeyTransport,
} from '../../../shared/types';

export function toBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(
    value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4),
  );
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Platform name for the device's built-in authenticator, used in button labels. */
export function biometricLabel(
  userAgent = navigator.userAgent,
  touchPoints = navigator.maxTouchPoints,
) {
  if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && touchPoints > 1))
    return 'Face ID';
  if (/Macintosh/.test(userAgent)) return 'Touch ID';
  if (/Android/.test(userAgent)) return 'Fingerprint';
  if (/Windows/.test(userAgent)) return 'Windows Hello';
  return 'Passkey';
}

export const passkeysSupported = () =>
  typeof window !== 'undefined' &&
  typeof window.PublicKeyCredential === 'function' &&
  !!navigator.credentials;
export async function platformAuthenticatorAvailable() {
  if (!passkeysSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}
export async function conditionalMediationAvailable() {
  if (!passkeysSupported()) return false;
  try {
    return (await PublicKeyCredential.isConditionalMediationAvailable?.()) ?? false;
  } catch {
    return false;
  }
}
/** The user dismissed the browser sheet or it timed out; not worth an error message. */
export const isPasskeyCancel = (error: unknown) =>
  error instanceof DOMException &&
  (error.name === 'NotAllowedError' || error.name === 'AbortError');

export async function getPasskey(
  options: PasskeyLoginOptions,
  { conditional = false, signal }: { conditional?: boolean; signal?: AbortSignal } = {},
): Promise<PasskeyAssertion> {
  const credential = (await navigator.credentials.get({
    mediation: conditional ? 'conditional' : 'optional',
    signal,
    publicKey: {
      challenge: fromBase64Url(options.challenge),
      rpId: options.rp_id,
      timeout: options.timeout_ms,
      userVerification: 'required',
      allowCredentials: [],
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new DOMException('No passkey selected', 'NotAllowedError');
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    raw_id: toBase64Url(credential.rawId),
    client_data_json: toBase64Url(response.clientDataJSON),
    authenticator_data: toBase64Url(response.authenticatorData),
    signature: toBase64Url(response.signature),
    user_handle: response.userHandle ? toBase64Url(response.userHandle) : null,
  };
}

export async function createPasskey(
  options: PasskeyRegistrationOptions,
): Promise<PasskeyAttestation> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: fromBase64Url(options.challenge),
      rp: { id: options.rp_id, name: options.rp_name },
      user: {
        id: fromBase64Url(options.user.id),
        name: options.user.name,
        displayName: options.user.display_name,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      timeout: options.timeout_ms,
      attestation: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        requireResidentKey: true,
        userVerification: 'required',
      },
      excludeCredentials: options.exclude_credentials.map((c) => ({
        type: 'public-key',
        id: fromBase64Url(c.id),
        transports: c.transports as AuthenticatorTransport[],
      })),
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new DOMException('No passkey created', 'NotAllowedError');
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    raw_id: toBase64Url(credential.rawId),
    client_data_json: toBase64Url(response.clientDataJSON),
    attestation_object: toBase64Url(response.attestationObject),
    transports: (response.getTransports?.() ?? []) as PasskeyTransport[],
  };
}

/** Options are fetched before the tap so Safari keeps the user gesture for the WebAuthn call. */
export const freshOptions = (options: { expires_at: string } | undefined, now = Date.now()) =>
  !!options && Date.parse(options.expires_at) - now > 60_000;

const OFFER_KEY = 'oyo.passkey-offer';
const dismissedKey = (userId: string) => `oyo.passkey-dismissed.${userId}`;
export function markPasskeyOffer() {
  try {
    sessionStorage.setItem(OFFER_KEY, '1');
  } catch {
    /* storage unavailable */
  }
}
export function takePasskeyOffer() {
  try {
    const value = sessionStorage.getItem(OFFER_KEY) === '1';
    sessionStorage.removeItem(OFFER_KEY);
    return value;
  } catch {
    return false;
  }
}
export function passkeyOfferDismissed(userId: string) {
  try {
    return localStorage.getItem(dismissedKey(userId)) === '1';
  } catch {
    return true;
  }
}
export function dismissPasskeyOffer(userId: string) {
  try {
    localStorage.setItem(dismissedKey(userId), '1');
  } catch {
    /* storage unavailable */
  }
}
