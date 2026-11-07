import type {
  Passkey,
  PasskeyLoginOptions,
  PasskeyRegistrationOptions,
  PasskeyTransport,
} from '../../../shared/types';
import type { Context } from '../context';
import { requireUser } from '../auth/guards';
import { token } from '../auth/crypto';
import {
  equalBytes,
  fromBase64Url,
  parseAttestation,
  parseAuthenticatorData,
  parseClientData,
  sha256Bytes,
  toBase64Url,
  verifySignature,
} from '../auth/webauthn';
import { audit } from '../db/audit';
import { attempt, attemptIp, clearAttempts, passkeyOptionsAttempt } from '../db/rateLimit';
import { createSession, findSession, prepareSession } from '../db/sessions';
import { byId, toUser, type UserRow } from '../db/users';
import { HttpError, json, noContent, readJson } from '../http';
import { checkGrant, grantHash } from './me';

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const RECENT_LOGIN_MS = 10 * 60 * 1000;
export const MAX_PASSKEYS = 10;
export const MAX_CHALLENGES = 2000;
const TRANSPORTS: PasskeyTransport[] = [
  'ble',
  'cable',
  'hybrid',
  'internal',
  'nfc',
  'smart-card',
  'usb',
];
const AAGUID_NAMES: Record<string, string> = {
  'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': 'Google Password Manager',
  'adce0002-35bc-c60a-648b-0b25f1f05503': 'Chrome on Mac',
  '08987058-cadc-4b81-b6e1-30de50dcbe96': 'Windows Hello',
  '9ddd1817-af5a-4672-a2b9-3e3dd95000a9': 'Windows Hello',
  '6028b017-b1d4-4c02-b4b3-afcdafc96bb2': 'Windows Hello',
  'dd4ec289-e01d-41c9-bb89-70fa845d4bf2': 'iCloud Keychain',
  'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': 'iCloud Keychain',
  '53414d53-554e-4700-0000-000000000000': 'Samsung Pass',
  'bada5566-a7aa-401f-bd96-45619a55120d': '1Password',
  'd548826e-79b4-db40-a3d8-11116f7e8349': 'Bitwarden',
  '531126d6-e717-415c-9320-3d9aa6981239': 'Dashlane',
  '50726f74-6f6e-5061-7373-50726f746f6e': 'Proton Pass',
  'b78a0a55-6ef8-d246-a042-ba0f6d55050c': 'LastPass',
  'b84e4048-15dc-4dd0-8640-f4f60813c8af': 'NordPass',
  '0ea242b4-43c4-4a1b-8b17-dd6d0b6baec6': 'Keeper',
  'f3809540-7f14-49c1-a8b3-8f813b225541': 'Enpass',
  'd3452668-01fd-4c12-926c-83a4204853aa': 'Microsoft Password Manager',
};
type PasskeyRow = {
  id: string;
  user_id: string;
  alg: number;
  public_key: string;
  sign_count: number;
  transports: string;
  aaguid: string;
  backup_eligible: number;
  backed_up: number;
  name: string;
  created_at: string;
  last_used_at: string | null;
};
type ChallengeRow = {
  challenge: string;
  kind: 'register' | 'login';
  user_id: string | null;
  session_hash: string | null;
  expires_at: string;
  created_at: string;
};

const invalid = (message = 'Passkey could not be verified.'): never => {
  throw new HttpError(400, 'PASSKEY_INVALID', message);
};
const toPasskey = (row: PasskeyRow): Passkey => ({
  id: row.id,
  name: row.name,
  created_at: row.created_at,
  last_used_at: row.last_used_at,
  backed_up: !!row.backed_up,
});
/** The relying party is the host serving this request, so staging and production get separate passkeys. */
export const rpId = (request: Request) => new URL(request.url).hostname;
export function checkOrigin(origin: string, request: Request) {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return invalid();
  }
  const host = rpId(request);
  const local = host === 'localhost' || host === '127.0.0.1';
  if (
    parsed.origin !== origin ||
    parsed.hostname !== host ||
    (parsed.protocol !== 'https:' && !local)
  )
    invalid();
}
export function deviceName(aaguid: string, userAgent: string | null) {
  if (AAGUID_NAMES[aaguid]) return AAGUID_NAMES[aaguid];
  const agent = userAgent ?? '';
  if (/iPhone/.test(agent)) return 'iPhone';
  if (/iPad/.test(agent)) return 'iPad';
  if (/Android/.test(agent)) return 'Android';
  if (/Macintosh/.test(agent)) return 'Mac';
  if (/Windows/.test(agent)) return 'Windows';
  return 'Passkey';
}
const passkeysFor = (ctx: Context, userId: string) =>
  ctx.storage.sql
    .exec<PasskeyRow>('SELECT * FROM passkeys WHERE user_id=? ORDER BY created_at, id', userId)
    .toArray();
function issueChallenge(
  ctx: Context,
  kind: ChallengeRow['kind'],
  userId: string | null,
  sessionHash: string | null,
) {
  const challenge = token();
  const expires_at = new Date(ctx.now.getTime() + CHALLENGE_TTL_MS).toISOString();
  const sql = ctx.storage.sql;
  sql.exec('DELETE FROM webauthn_challenges WHERE expires_at<=?', ctx.now.toISOString());
  if (userId) sql.exec('DELETE FROM webauthn_challenges WHERE kind=? AND user_id=?', kind, userId);
  sql.exec(
    'DELETE FROM webauthn_challenges WHERE challenge IN (SELECT challenge FROM webauthn_challenges ORDER BY created_at DESC LIMIT -1 OFFSET ?)',
    MAX_CHALLENGES - 1,
  );
  sql.exec(
    'INSERT INTO webauthn_challenges VALUES (?,?,?,?,?,?)',
    challenge,
    kind,
    userId,
    sessionHash,
    expires_at,
    ctx.now.toISOString(),
  );
  return { challenge, rp_id: rpId(ctx.request), timeout_ms: CHALLENGE_TTL_MS, expires_at };
}
/** Deletes the challenge before any verification, so every challenge is usable at most once. */
function takeChallenge(ctx: Context, challenge: string, kind: ChallengeRow['kind']) {
  const row = ctx.storage.sql
    .exec<ChallengeRow>('SELECT * FROM webauthn_challenges WHERE challenge=?', challenge)
    .toArray()[0];
  if (row) ctx.storage.sql.exec('DELETE FROM webauthn_challenges WHERE challenge=?', challenge);
  return row && row.kind === kind && Date.parse(row.expires_at) > ctx.now.getTime()
    ? row
    : undefined;
}
const expired = () =>
  new HttpError(400, 'PASSKEY_CHALLENGE_EXPIRED', 'Passkey request expired. Try again.');
function credentialFields(body: Record<string, unknown>) {
  const id = typeof body.id === 'string' ? body.id : invalid();
  const rawId = fromBase64Url(body.raw_id, 1400);
  if (toBase64Url(rawId) !== id || rawId.length > 1023) invalid();
  return { id, rawId, clientDataJSON: fromBase64Url(body.client_data_json, 4096) };
}

export function loginOptions(ctx: Context) {
  return ctx.storage.transactionSync(() => {
    passkeyOptionsAttempt(ctx);
    return json(issueChallenge(ctx, 'login', null, null) satisfies PasskeyLoginOptions);
  });
}
export async function login(ctx: Context) {
  const body = await readJson(ctx.request);
  const { id, clientDataJSON } = credentialFields(body);
  const authenticatorData = fromBase64Url(body.authenticator_data, 4096);
  const signature = fromBase64Url(body.signature, 1024);
  const userHandle =
    body.user_handle === null || body.user_handle === undefined
      ? null
      : new TextDecoder().decode(fromBase64Url(body.user_handle, 128));
  const clientData = parseClientData(clientDataJSON, 'webauthn.get');
  const found = ctx.storage.sql
    .exec<PasskeyRow>('SELECT * FROM passkeys WHERE id=?', id)
    .toArray()[0];
  const owner = found ? byId(ctx.storage, found.user_id) : undefined;
  if (owner) attempt(ctx, owner.email);
  else attemptIp(ctx);
  if (!takeChallenge(ctx, clientData.challenge, 'login')) throw expired();
  checkOrigin(clientData.origin, ctx.request);
  if (!found || !owner || (userHandle !== null && userHandle !== found.user_id))
    throw new HttpError(401, 'PASSKEY_UNKNOWN', 'This passkey is not set up here.');
  if (!owner.active) throw new HttpError(403, 'ACCOUNT_INACTIVE', 'This account is inactive.');
  const stored = found;
  const data = parseAuthenticatorData(authenticatorData);
  if (data.credential) invalid();
  if (!equalBytes(data.rpIdHash, await sha256Bytes(rpId(ctx.request)))) invalid();
  if (!data.userPresent || !data.userVerified) invalid('Face ID or device unlock is required.');
  const verified = await verifySignature(
    stored.alg,
    JSON.parse(stored.public_key),
    authenticatorData,
    clientDataJSON,
    signature,
  );
  if (!verified) throw new HttpError(401, 'PASSKEY_UNKNOWN', 'This passkey is not set up here.');
  const prepared = await prepareSession();
  return ctx.storage.transactionSync(() => {
    const row = ctx.storage.sql
      .exec<PasskeyRow>('SELECT * FROM passkeys WHERE id=?', id)
      .toArray()[0];
    const user = row ? byId(ctx.storage, row.user_id) : undefined;
    if (!row || !user || row.user_id !== stored.user_id || row.public_key !== stored.public_key)
      throw new HttpError(401, 'PASSKEY_UNKNOWN', 'This passkey is not set up here.');
    if (!user.active) throw new HttpError(403, 'ACCOUNT_INACTIVE', 'This account is inactive.');
    if ((data.signCount > 0 || row.sign_count > 0) && data.signCount <= row.sign_count) {
      audit(
        ctx,
        'passkey.counter-regression',
        row.id,
        { sign_count: row.sign_count },
        { sign_count: data.signCount },
        user.id,
      );
      return json(
        {
          error: {
            code: 'PASSKEY_CLONED',
            message: 'This passkey was rejected. Use your password.',
          },
        },
        401,
      );
    }
    ctx.storage.sql.exec(
      'UPDATE passkeys SET sign_count=?,backed_up=?,last_used_at=? WHERE id=?',
      data.signCount,
      data.backedUp ? 1 : 0,
      ctx.now.toISOString(),
      row.id,
    );
    createSession(ctx, user.id, prepared, user);
    clearAttempts(ctx, user.email);
    return json(toUser(byId(ctx.storage, user.id)));
  });
}

function requireRecentAuth(ctx: Context, user: UserRow, grant: string | undefined) {
  const session = findSession(ctx, ctx.tokenHash!);
  if (session && ctx.now.getTime() - Date.parse(session.created_at) < RECENT_LOGIN_MS) return;
  if (!grant)
    throw new HttpError(401, 'REAUTH_REQUIRED', 'Verify your password to set up a passkey.');
  checkGrant(ctx, user, grant);
}
export function list(ctx: Context) {
  return json(passkeysFor(ctx, requireUser(ctx).id).map(toPasskey));
}
export async function registrationOptions(ctx: Context) {
  const body = await readJson(ctx.request);
  const grant = await grantHash(body.reauth_token);
  return ctx.storage.transactionSync(() => {
    const user = requireUser(ctx);
    requireRecentAuth(ctx, user, grant);
    const existing = passkeysFor(ctx, user.id);
    if (existing.length >= MAX_PASSKEYS)
      throw new HttpError(409, 'PASSKEY_LIMIT', 'Remove a passkey first.');
    const options: PasskeyRegistrationOptions = {
      ...issueChallenge(ctx, 'register', user.id, ctx.tokenHash!),
      rp_name: 'Stanford Rowing OYO',
      user: {
        id: toBase64Url(new TextEncoder().encode(user.id)),
        name: user.email,
        display_name: user.name,
      },
      exclude_credentials: existing.map((row) => ({
        id: row.id,
        transports: JSON.parse(row.transports),
      })),
    };
    return json(options);
  });
}
export async function register(ctx: Context) {
  const body = await readJson(ctx.request);
  const { id, rawId, clientDataJSON } = credentialFields(body);
  const attestationObject = fromBase64Url(body.attestation_object, 16384);
  const transports = Array.isArray(body.transports)
    ? [
        ...new Set(
          body.transports.filter((t): t is PasskeyTransport =>
            TRANSPORTS.includes(t as PasskeyTransport),
          ),
        ),
      ]
    : [];
  const clientData = parseClientData(clientDataJSON, 'webauthn.create');
  const user = requireUser(ctx);
  const challenge = takeChallenge(ctx, clientData.challenge, 'register');
  if (!challenge || challenge.user_id !== user.id || challenge.session_hash !== ctx.tokenHash)
    throw expired();
  checkOrigin(clientData.origin, ctx.request);
  const { parsed } = parseAttestation(attestationObject);
  if (!equalBytes(parsed.rpIdHash, await sha256Bytes(rpId(ctx.request)))) invalid();
  if (!parsed.userPresent || !parsed.userVerified) invalid('Face ID or device unlock is required.');
  if (!parsed.credential || !equalBytes(parsed.credential.id, rawId)) invalid();
  const credential = parsed.credential!;
  return ctx.storage.transactionSync(() => {
    const current = requireUser(ctx);
    if (current.id !== challenge.user_id) invalid();
    const existing = passkeysFor(ctx, current.id);
    if (existing.length >= MAX_PASSKEYS)
      throw new HttpError(409, 'PASSKEY_LIMIT', 'Remove a passkey first.');
    if (ctx.storage.sql.exec('SELECT 1 FROM passkeys WHERE id=?', id).toArray().length)
      throw new HttpError(409, 'PASSKEY_EXISTS', 'This passkey is already set up.');
    const row: PasskeyRow = {
      id,
      user_id: current.id,
      alg: credential.alg,
      public_key: JSON.stringify(credential.jwk),
      sign_count: parsed.signCount,
      transports: JSON.stringify(transports),
      aaguid: credential.aaguid,
      backup_eligible: parsed.backupEligible ? 1 : 0,
      backed_up: parsed.backedUp ? 1 : 0,
      name: deviceName(credential.aaguid, ctx.request.headers.get('User-Agent')),
      created_at: ctx.now.toISOString(),
      last_used_at: null,
    };
    ctx.storage.sql.exec(
      'INSERT INTO passkeys VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      ...Object.values(row),
    );
    audit(ctx, 'passkey.add', current.id, null, { id, name: row.name, alg: row.alg });
    return json(toPasskey(row), 201);
  });
}
export function remove(ctx: Context) {
  return ctx.storage.transactionSync(() => {
    const user = requireUser(ctx);
    const row = ctx.storage.sql
      .exec<PasskeyRow>('SELECT * FROM passkeys WHERE id=? AND user_id=?', ctx.params.id, user.id)
      .toArray()[0];
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Passkey not found.');
    ctx.storage.sql.exec('DELETE FROM passkeys WHERE id=?', row.id);
    audit(ctx, 'passkey.remove', user.id, { id: row.id, name: row.name }, null);
    return noContent();
  });
}
