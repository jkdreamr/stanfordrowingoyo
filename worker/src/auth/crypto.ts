import { HttpError } from '../http';
export const PASSWORD_ITERATIONS = 20000;
export const PASSWORD_PEPPER_VERSION = 1;
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
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
async function derive(input: Uint8Array, salt: string, iterations: number) {
  const key = await crypto.subtle.importKey('raw', input, 'PBKDF2', false, ['deriveBits']);
  const bytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: bytes, iterations },
    key,
    256,
  );
  return encode(new Uint8Array(hash));
}
async function peppered(password: string, pepper: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(password)));
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
export async function hashPassword(
  password: string,
  pepper: string | undefined,
  salt = encode(crypto.getRandomValues(new Uint8Array(16))),
) {
  const secret = requirePasswordPepper(pepper);
  const hash = await derive(await peppered(password, secret), salt, PASSWORD_ITERATIONS);
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
      await derive(await peppered(password, secret), params.salt, params.iterations),
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
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
    (n) => n.toString(16).padStart(2, '0'),
  ).join('');
}
export function temporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let result = '';
  while (result.length < 14) {
    const n = crypto.getRandomValues(new Uint8Array(1))[0];
    if (n < Math.floor(256 / alphabet.length) * alphabet.length)
      result += alphabet[n % alphabet.length];
  }
  return result;
}
