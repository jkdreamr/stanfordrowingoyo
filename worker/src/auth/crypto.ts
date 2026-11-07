import { HttpError } from '../http';
export const PASSWORD_ITERATIONS = 20000;
export const PASSWORD_PEPPER_VERSION = 1;
const encoder = new TextEncoder();
let cachedPepper: { value: string; key: Promise<CryptoKey> } | undefined;
function encode(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function decode(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function pepperKey(pepper: string) {
  if (cachedPepper?.value !== pepper) {
    const entry = {
      value: pepper,
      key: crypto.subtle.importKey(
        'raw',
        encoder.encode(pepper),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      ),
    };
    cachedPepper = entry;
    void entry.key.catch(() => {
      if (cachedPepper === entry) cachedPepper = undefined;
    });
  }
  return cachedPepper.key;
}
export function requirePasswordPepper(pepper: string | undefined): string {
  if (!pepper?.trim()) {
    console.error('PASSWORD_PEPPER secret is not configured');
    throw new HttpError(500, 'INTERNAL', 'An internal error occurred.');
  }
  return pepper;
}
export function constantTimeEqual(a: string, b: string): boolean {
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}
async function derive(input: Uint8Array, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', input, 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  );
  return encode(new Uint8Array(hash));
}
async function peppered(password: string, pepper: string) {
  const key = await pepperKey(pepper);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(password)));
}
function parameters(hash: string) {
  const match =
    /^pbkdf2-sha256\$([1-9]\d{0,5})\$(0|[1-9]\d{0,5})\$([A-Za-z0-9+/]{22}==)\$([A-Za-z0-9+/]{43}=)$/.exec(
      hash,
    );
  if (!match || Number(match[1]) > 100000 || Number(match[2]) > PASSWORD_PEPPER_VERSION)
    return null;
  return {
    iterations: Number(match[1]),
    version: Number(match[2]),
    salt: match[3],
    hash: match[4],
  };
}
export async function hashPassword(password: string, pepper: string | undefined, salt?: string) {
  const secret = requirePasswordPepper(pepper);
  const saltBytes = salt === undefined ? crypto.getRandomValues(new Uint8Array(16)) : decode(salt);
  salt ??= encode(saltBytes);
  const hash = await derive(await peppered(password, secret), saltBytes, PASSWORD_ITERATIONS);
  return {
    hash: `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${PASSWORD_PEPPER_VERSION}$${salt}$${hash}`,
    salt,
  };
}
export async function verifyPassword(
  password: string,
  hash: string,
  _salt: string,
  pepper: string | undefined,
) {
  const secret = requirePasswordPepper(pepper);
  const params = parameters(hash);
  if (params)
    return constantTimeEqual(
      await derive(await peppered(password, secret), decode(params.salt), params.iterations),
      params.hash,
    );
  console.warn('Stored password hash format is unsupported or invalid.');
  return false;
}
export const token = () =>
  encode(crypto.getRandomValues(new Uint8Array(32)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
export async function sha256(value: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))),
    (n) => n.toString(16).padStart(2, '0'),
  ).join('');
}
export function temporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let result = '';
  const bytes = new Uint8Array(16);
  while (result.length < 14) {
    crypto.getRandomValues(bytes);
    for (const n of bytes) {
      if (n < Math.floor(256 / alphabet.length) * alphabet.length)
        result += alphabet[n % alphabet.length];
      if (result.length === 14) break;
    }
  }
  return result;
}
