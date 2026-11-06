import type { Env } from './index';
export function now(request: Request, env: Env): Date {
  const override = env.OYO_TEST_CLOCK === '1' && request.headers.get('X-OYO-Test-Now');
  const value = override ? new Date(override) : new Date();
  return Number.isFinite(value.getTime()) ? value : new Date();
}
