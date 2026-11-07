// Prints a fresh VAPID (RFC 8292) P-256 key pair as base64url. Never commit the output.
// Usage: node scripts/generate-vapid-keys.ts            (human-readable)
//        node scripts/generate-vapid-keys.ts --wrangler-args  (ephemeral `wrangler dev --var` flags)
import { generateKeyPairSync } from 'node:crypto';

export function generateVapidKeys() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  const point = publicKey.export({ format: 'der', type: 'spki' }).subarray(-65);
  return { publicKey: Buffer.from(point).toString('base64url'), privateKey: jwk.d! };
}

if (import.meta.main) {
  const keys = generateVapidKeys();
  if (process.argv.includes('--wrangler-args'))
    process.stdout.write(
      `--var VAPID_PUBLIC_KEY:${keys.publicKey} --var VAPID_PRIVATE_KEY:${keys.privateKey} --var VAPID_SUBJECT:mailto:oyo-e2e@example.com`,
    );
  else
    process.stdout.write(
      `VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\n`,
    );
}
