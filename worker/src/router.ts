import type { Context } from './context';
import { authenticate } from './auth/guards';
import { HttpError, errorResponse, json } from './http';
import * as auth from './routes/auth';
import * as me from './routes/me';
import * as config from './routes/config';
type Handler = (ctx: Context) => Response | Promise<Response>;
interface Route {
  method: string;
  path: string;
  handler: Handler;
}
const routes: Route[] = [
  { method: 'GET', path: '/api/health', handler: () => json({ ok: true, schema_version: 2 }) },
  { method: 'POST', path: '/api/auth/signup', handler: auth.signup },
  { method: 'POST', path: '/api/auth/login', handler: auth.login },
  { method: 'POST', path: '/api/auth/logout', handler: auth.logout },
  { method: 'GET', path: '/api/me', handler: me.get },
  { method: 'PATCH', path: '/api/me', handler: me.patch },
  { method: 'POST', path: '/api/me/password', handler: me.password },
  { method: 'GET', path: '/api/me/target', handler: me.target },
  { method: 'PUT', path: '/api/me/target', handler: me.putTarget },
  { method: 'GET', path: '/api/config', handler: config.get },
];
export function matchPath(template: string, path: string): Record<string, string> | null {
  const a = template.split('/');
  const b = path.split('/');
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) {
      try {
        params[a[i].slice(1)] = decodeURIComponent(b[i]);
      } catch {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Path is invalid.');
      }
    } else if (a[i] !== b[i]) return null;
  }
  return params;
}
export function checkCsrf(request: Request) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;
  const origin = request.headers.get('Origin');
  const type = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() ?? '';
  if (
    (origin !== null && origin !== new URL(request.url).origin) ||
    request.headers.get('Sec-Fetch-Site') === 'cross-site' ||
    (!['application/json', 'image/jpeg', 'image/png', 'image/webp'].includes(type) &&
      request.headers.get('X-OYO-CSRF') !== '1')
  )
    throw new HttpError(403, 'CSRF_REJECTED', 'Cross-site request rejected.');
}
export async function route(ctx: Context): Promise<Response> {
  let response: Response;
  try {
    checkCsrf(ctx.request);
    const path = new URL(ctx.request.url).pathname;
    const matches = routes.filter((row) => matchPath(row.path, path) !== null);
    if (!matches.length) throw new HttpError(404, 'NOT_FOUND', 'Endpoint not found.');
    const found = matches.find((row) => row.method === ctx.request.method);
    if (!found) throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    ctx.params = matchPath(found.path, path)!;
    await authenticate(ctx);
    const allowed = [
      'GET /api/me',
      'GET /api/config',
      'POST /api/me/password',
      'POST /api/auth/logout',
    ];
    if (ctx.user?.must_change_password && !allowed.includes(`${ctx.request.method} ${path}`))
      throw new HttpError(403, 'PASSWORD_CHANGE_REQUIRED', 'Please change your password.');
    response = await found.handler(ctx);
  } catch (error) {
    response = errorResponse(error);
  }
  if (ctx.cookie) response.headers.set('Set-Cookie', ctx.cookie);
  return response;
}
