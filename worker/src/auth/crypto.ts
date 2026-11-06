const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
export function constantTimeEqual(a: string, b: string): boolean {
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}
export async function hashPassword(
  password: string,
  salt = encode(crypto.getRandomValues(new Uint8Array(16))),
) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: bytes, iterations: 100000 },
    key,
    256,
  );
  return { hash: encode(new Uint8Array(hash)), salt };
}
export async function verifyPassword(password: string, hash: string, salt: string) {
  return constantTimeEqual((await hashPassword(password, salt)).hash, hash);
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
