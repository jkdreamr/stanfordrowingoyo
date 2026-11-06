import { parseArgs } from 'node:util';

export const usage = `Usage: node scripts/load/index.ts --base-url URL [options]
Options: --users 60 --scenario session|burst|both --burst-window 60
  --concurrency N --p95-ms 800 --team-code CODE --admin-email EMAIL
  --admin-password PASSWORD (or LOAD_ADMIN_PASSWORD) --password PASSWORD
  --auth-ramp 60 --skip-signup
  --seed N --json FILE --cleanup --allow-remote --i-know-this-is-production`;

export function parseOptions(args: string[], env: NodeJS.ProcessEnv = process.env) {
  const { values: v } = parseArgs({
    args,
    options: {
      'base-url': { type: 'string' },
      users: { type: 'string', default: '60' },
      scenario: { type: 'string', default: 'both' },
      'burst-window': { type: 'string', default: '60' },
      'auth-ramp': { type: 'string', default: '60' },
      'skip-signup': { type: 'boolean' },
      concurrency: { type: 'string' },
      'p95-ms': { type: 'string', default: '800' },
      'team-code': { type: 'string' },
      'admin-email': { type: 'string', default: 'joskoo@stanford.edu' },
      'admin-password': { type: 'string' },
      password: { type: 'string', default: 'loadtest-password-1' },
      seed: { type: 'string', default: '1' },
      json: { type: 'string' },
      cleanup: { type: 'boolean' },
      'allow-remote': { type: 'boolean' },
      'i-know-this-is-production': { type: 'boolean' },
    },
  });
  if (!v['base-url']) throw new Error('--base-url is required');
  const url = new URL(v['base-url']);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error('--base-url must be an HTTP(S) origin without credentials');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const local = ['localhost', '127.0.0.1', '::1'].includes(host) || host.endsWith('.local');
  if (!local && !v['allow-remote']) throw new Error('Remote host refused: pass --allow-remote');
  if (!local && /prod|stanford|rowingoyo/i.test(host) && !v['i-know-this-is-production']) {
    throw new Error('Production-looking host refused: pass --i-know-this-is-production');
  }
  function number(
    name: 'users' | 'concurrency' | 'burst-window' | 'auth-ramp' | 'p95-ms' | 'seed',
    fallback?: string,
  ) {
    const n = Number(v[name] ?? fallback);
    if (
      !Number.isFinite(n) ||
      n < (['seed', 'burst-window', 'auth-ramp'].includes(name) ? 0 : 1) ||
      !Number.isInteger(n)
    )
      throw new Error(`Invalid --${name}`);
    return n;
  }
  if (!['session', 'burst', 'both'].includes(v.scenario)) throw new Error('Invalid --scenario');
  if (v.password.length < 8) throw new Error('--password must be at least 8 characters');
  if (v.cleanup && v['skip-signup']) throw new Error('--cleanup and --skip-signup conflict');
  return {
    baseUrl: url.origin,
    users: number('users'),
    scenario: v.scenario,
    burstWindow: number('burst-window'),
    authRamp: number('auth-ramp'),
    skipSignup: v['skip-signup'] ?? false,
    concurrency: number('concurrency', v.users),
    p95Ms: number('p95-ms'),
    seed: number('seed'),
    teamCode: v['team-code'],
    adminEmail: v['admin-email'],
    adminPassword: v['admin-password'] ?? env.LOAD_ADMIN_PASSWORD,
    password: v.password,
    json: v.json,
    cleanup: v.cleanup ?? false,
  };
}
export type Options = ReturnType<typeof parseOptions>;
