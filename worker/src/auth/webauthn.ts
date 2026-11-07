import { HttpError } from '../http';

export const ES256 = -7;
export const RS256 = -257;
const decoder = new TextDecoder();
const fail = (message = 'Passkey could not be verified.'): never => {
  throw new HttpError(400, 'PASSKEY_INVALID', message);
};

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
export function fromBase64Url(value: unknown, max = 16384): Uint8Array {
  if (
    typeof value !== 'string' ||
    !value.length ||
    value.length > max ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  )
    fail();
  const text = value as string;
  if (text.length % 4 === 1) fail();
  let binary: string;
  try {
    binary = atob(
      text.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (text.length % 4)) % 4),
    );
  } catch {
    return fail();
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

type Cbor =
  number | bigint | string | boolean | null | undefined | Uint8Array | Cbor[] | Map<Cbor, Cbor>;
/** Minimal CBOR decoder for WebAuthn attestation objects and COSE keys (RFC 8949 definite lengths). */
export function decodeCbor(bytes: Uint8Array, start = 0): { value: Cbor; end: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = start;
  const need = (n: number) => {
    if (offset + n > bytes.length) fail();
  };
  const length = (info: number): number => {
    if (info < 24) return info;
    if (info === 24) return (need(1), view.getUint8(offset++));
    if (info === 25) return (need(2), (offset += 2), view.getUint16(offset - 2));
    if (info === 26) return (need(4), (offset += 4), view.getUint32(offset - 4));
    if (info === 27) {
      need(8);
      const value = view.getBigUint64(offset);
      offset += 8;
      if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail();
      return Number(value);
    }
    return fail();
  };
  const item = (depth: number): Cbor => {
    if (depth > 16) fail();
    need(1);
    const initial = view.getUint8(offset++);
    const major = initial >> 5;
    const info = initial & 31;
    if (major === 7) {
      if (info === 20) return false;
      if (info === 21) return true;
      if (info === 22) return null;
      if (info === 23) return undefined;
      return fail();
    }
    const n = length(info);
    if (major === 0) return n;
    if (major === 1) return -1 - n;
    if (major === 2 || major === 3) {
      need(n);
      const slice = bytes.slice(offset, offset + n);
      offset += n;
      return major === 2 ? slice : decoder.decode(slice);
    }
    if (major === 4) {
      if (n > 1024) fail();
      const list: Cbor[] = [];
      for (let i = 0; i < n; i++) list.push(item(depth + 1));
      return list;
    }
    if (major === 5) {
      if (n > 1024) fail();
      const map = new Map<Cbor, Cbor>();
      for (let i = 0; i < n; i++) {
        const key = item(depth + 1);
        if (map.has(key)) fail();
        map.set(key, item(depth + 1));
      }
      return map;
    }
    if (major === 6) return item(depth + 1);
    return fail();
  };
  const value = item(0);
  return { value, end: offset };
}

export interface AuthenticatorData {
  rpIdHash: Uint8Array;
  flags: number;
  userPresent: boolean;
  userVerified: boolean;
  backupEligible: boolean;
  backedUp: boolean;
  signCount: number;
  credential?: { id: Uint8Array; aaguid: string; alg: number; jwk: JsonWebKey };
}
export function parseAuthenticatorData(data: Uint8Array): AuthenticatorData {
  if (data.length < 37) fail();
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const flags = data[32];
  const result: AuthenticatorData = {
    rpIdHash: data.slice(0, 32),
    flags,
    userPresent: !!(flags & 0x01),
    userVerified: !!(flags & 0x04),
    backupEligible: !!(flags & 0x08),
    backedUp: !!(flags & 0x10),
    signCount: view.getUint32(33),
  };
  let offset = 37;
  if (flags & 0x40) {
    if (data.length < offset + 18) fail();
    const hex = Array.from(data.slice(offset, offset + 16), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
    const aaguid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    offset += 16;
    const idLength = view.getUint16(offset);
    offset += 2;
    if (!idLength || idLength > 1023 || data.length < offset + idLength) fail();
    const id = data.slice(offset, offset + idLength);
    offset += idLength;
    const { value, end } = decodeCbor(data, offset);
    offset = end;
    result.credential = { id, aaguid, ...coseToJwk(value) };
  }
  if (flags & 0x80) offset = decodeCbor(data, offset).end;
  if (offset !== data.length) fail();
  return result;
}

function coseToJwk(value: Cbor): { alg: number; jwk: JsonWebKey } {
  if (!(value instanceof Map)) return fail();
  const kty = value.get(1);
  const alg = value.get(3);
  if (alg === ES256 && kty === 2) {
    const x = value.get(-2);
    const y = value.get(-3);
    if (
      value.get(-1) !== 1 ||
      !(x instanceof Uint8Array) ||
      !(y instanceof Uint8Array) ||
      x.length !== 32 ||
      y.length !== 32
    )
      fail('This passkey type is not supported.');
    return {
      alg,
      jwk: {
        kty: 'EC',
        crv: 'P-256',
        x: toBase64Url(x as Uint8Array),
        y: toBase64Url(y as Uint8Array),
      },
    };
  }
  if (alg === RS256 && kty === 3) {
    const n = value.get(-1);
    const e = value.get(-2);
    if (!(n instanceof Uint8Array) || !(e instanceof Uint8Array) || !e.length || e.length > 8)
      fail();
    const modulus = n as Uint8Array;
    const leading = modulus.findIndex((b) => b !== 0);
    if (leading < 0 || (modulus.length - leading) * 8 < 2048 || modulus.length - leading > 1024)
      fail('This passkey type is not supported.');
    return {
      alg,
      jwk: { kty: 'RSA', n: toBase64Url(modulus.slice(leading)), e: toBase64Url(e as Uint8Array) },
    };
  }
  return fail('This passkey type is not supported.');
}

/** Converts an ASN.1 DER ECDSA signature to the raw r||s form WebCrypto expects. */
export function derToRaw(signature: Uint8Array): Uint8Array {
  let offset = 0;
  const byte = () => {
    if (offset >= signature.length) fail();
    return signature[offset++];
  };
  if (byte() !== 0x30) fail();
  const total = byte();
  if (total & 0x80 || total + 2 !== signature.length) fail();
  const out = new Uint8Array(64);
  for (const position of [0, 32]) {
    if (byte() !== 0x02) fail();
    const length = byte();
    if (!length || length > 33 || offset + length > signature.length) fail();
    let int = signature.slice(offset, offset + length);
    offset += length;
    while (int.length > 32 && int[0] === 0) int = int.slice(1);
    if (int.length > 32) fail();
    out.set(int, position + 32 - int.length);
  }
  if (offset !== signature.length) fail();
  return out;
}

export interface ClientData {
  type: string;
  challenge: string;
  origin: string;
}
export function parseClientData(
  bytes: Uint8Array,
  type: 'webauthn.create' | 'webauthn.get',
): ClientData {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(decoder.decode(bytes));
  } catch {
    return fail();
  }
  if (!data || typeof data !== 'object') fail();
  if (
    data.type !== type ||
    typeof data.challenge !== 'string' ||
    typeof data.origin !== 'string' ||
    data.crossOrigin === true ||
    (data.topOrigin !== undefined && data.topOrigin !== data.origin)
  )
    fail();
  return data as unknown as ClientData;
}
export async function sha256Bytes(bytes: Uint8Array | string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest(
      'SHA-256',
      typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes,
    ),
  );
}
export function equalBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

export async function verifySignature(
  alg: number,
  jwk: JsonWebKey,
  authenticatorData: Uint8Array,
  clientDataJSON: Uint8Array,
  signature: Uint8Array,
): Promise<boolean> {
  const hash = await sha256Bytes(clientDataJSON);
  const signed = new Uint8Array(authenticatorData.length + hash.length);
  signed.set(authenticatorData);
  signed.set(hash, authenticatorData.length);
  try {
    if (alg === ES256) {
      const key = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
      );
      return await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        derToRaw(signature),
        signed,
      );
    }
    if (alg === RS256) {
      const key = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      );
      return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signed);
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    return false;
  }
  return false;
}

/** Parses a registration's attestation object; attestation statements are not verified (conveyance 'none'). */
export function parseAttestation(attestationObject: Uint8Array) {
  const { value, end } = decodeCbor(attestationObject);
  if (end !== attestationObject.length || !(value instanceof Map)) fail();
  const map = value as Map<Cbor, Cbor>;
  const authData = map.get('authData');
  if (typeof map.get('fmt') !== 'string' || !(authData instanceof Uint8Array)) fail();
  return {
    authData: authData as Uint8Array,
    parsed: parseAuthenticatorData(authData as Uint8Array),
  };
}
