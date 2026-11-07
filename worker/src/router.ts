import type { Context } from './context';
import { authenticate, requireUser } from './auth/guards';
import { HttpError, errorResponse, json } from './http';
import * as auth from './routes/auth';
import * as me from './routes/me';
import * as config from './routes/config';
import * as entries from './routes/entries';
import * as images from './routes/images';
import * as social from './routes/social';
import * as notifications from './routes/notifications';
import * as stats from './routes/stats';
import * as team from './routes/team';
import * as admin from './routes/admin';
import * as announcements from './routes/announcements';
import * as plan from './routes/plan';
type Handler = (ctx: Context) => Response | Promise<Response>;
interface Route {
  method: string;
  path: string;
  handler: Handler;
  readOnlyAuth?: boolean;
  deferredAuth?: boolean;
}
function unavailable(): never {
  throw new HttpError(404, 'NOT_FOUND', 'Endpoint not found.');
}
const routes: Route[] = [
  { method: 'POST', path: '/internal/images', handler: images.create, deferredAuth: true },
  {
    method: 'POST',
    path: '/internal/auth/signup/precheck',
    handler: auth.signupPrecheck,
    readOnlyAuth: true,
  },
  { method: 'POST', path: '/internal/auth/signup/commit', handler: auth.signup },
  {
    method: 'POST',
    path: '/internal/auth/login/challenge',
    handler: auth.loginChallenge,
    readOnlyAuth: true,
  },
  { method: 'POST', path: '/internal/auth/login/session', handler: auth.login },
  {
    method: 'POST',
    path: '/internal/me/password/challenge',
    handler: me.passwordChallenge,
    readOnlyAuth: true,
  },
  { method: 'POST', path: '/internal/me/password/verified', handler: me.passwordVerified },
  {
    method: 'POST',
    path: '/internal/me/password/precheck',
    handler: me.passwordPrecheck,
    readOnlyAuth: true,
  },
  { method: 'POST', path: '/internal/me/password/commit', handler: me.password },
  {
    method: 'POST',
    path: '/internal/admin/users/:id/reset-password/precheck',
    handler: admin.resetPasswordPrecheck,
    readOnlyAuth: true,
  },
  {
    method: 'POST',
    path: '/internal/admin/users/:id/reset-password/commit',
    handler: admin.resetPassword,
  },
  { method: 'GET', path: '/api/health', handler: () => json({ ok: true, schema_version: 7 }) },
  { method: 'POST', path: '/api/auth/roster', handler: auth.roster },
  { method: 'POST', path: '/api/auth/signup', handler: unavailable },
  { method: 'POST', path: '/api/auth/login', handler: unavailable },
  { method: 'POST', path: '/api/auth/logout', handler: auth.logout },
  { method: 'GET', path: '/api/me', handler: me.get },
  { method: 'PATCH', path: '/api/me', handler: me.patch },
  { method: 'POST', path: '/api/me/password', handler: unavailable },
  { method: 'POST', path: '/api/me/password/verify', handler: unavailable },
  { method: 'GET', path: '/api/me/target', handler: me.target },
  { method: 'PUT', path: '/api/me/target', handler: me.putTarget },
  { method: 'GET', path: '/api/config', handler: config.get },
  { method: 'GET', path: '/api/entries', handler: entries.list },
  { method: 'POST', path: '/api/entries', handler: entries.create },
  { method: 'GET', path: '/api/entries/:id', handler: entries.get },
  { method: 'PATCH', path: '/api/entries/:id', handler: entries.patch },
  { method: 'DELETE', path: '/api/entries/:id', handler: entries.remove },
  { method: 'POST', path: '/api/images', handler: unavailable },
  { method: 'GET', path: '/api/images/:id', handler: images.get },
  { method: 'GET', path: '/api/entries/:id/kudos', handler: social.kudosUsers },
  { method: 'POST', path: '/api/entries/:id/kudos', handler: social.kudos },
  { method: 'DELETE', path: '/api/entries/:id/kudos', handler: social.kudos },
  { method: 'GET', path: '/api/entries/:id/comments', handler: social.comments },
  { method: 'POST', path: '/api/entries/:id/comments', handler: social.comment },
  { method: 'DELETE', path: '/api/comments/:id', handler: social.removeComment },
  { method: 'GET', path: '/api/notifications', handler: notifications.get },
  { method: 'POST', path: '/api/notifications/read', handler: notifications.read },
  { method: 'GET', path: '/api/stats/week', handler: stats.week },
  { method: 'GET', path: '/api/stats/season', handler: stats.season },
  { method: 'GET', path: '/api/leaderboard', handler: stats.leaderboard },
  { method: 'GET', path: '/api/users', handler: team.list },
  { method: 'GET', path: '/api/users/:id', handler: team.profile },
  { method: 'GET', path: '/api/announcements', handler: announcements.get },
  { method: 'POST', path: '/api/announcements', handler: announcements.create },
  { method: 'PATCH', path: '/api/announcements/:id', handler: announcements.patch },
  { method: 'DELETE', path: '/api/announcements/:id', handler: announcements.remove },
  { method: 'GET', path: '/api/plan', handler: plan.get },
  { method: 'GET', path: '/api/admin/users', handler: admin.users },
  { method: 'PATCH', path: '/api/admin/users/:id', handler: admin.patchUser },
  { method: 'POST', path: '/api/admin/users/:id/reset-password', handler: unavailable },
  { method: 'GET', path: '/api/admin/roster', handler: admin.roster },
  { method: 'POST', path: '/api/admin/roster', handler: admin.createRoster },
  { method: 'POST', path: '/api/admin/roster/import', handler: admin.importRoster },
  { method: 'PATCH', path: '/api/admin/roster/:id', handler: admin.patchRoster },
  { method: 'DELETE', path: '/api/admin/roster/:id', handler: admin.deleteRoster },
  { method: 'POST', path: '/api/admin/roster/:id/unlink', handler: admin.unlinkRoster },
  { method: 'GET', path: '/api/admin/settings', handler: admin.settings },
  { method: 'PATCH', path: '/api/admin/settings', handler: admin.patchSettings },
  { method: 'GET', path: '/api/admin/presets', handler: admin.listPresets },
  { method: 'POST', path: '/api/admin/presets', handler: admin.createPreset },
  { method: 'PATCH', path: '/api/admin/presets/:id', handler: admin.patchPreset },
  { method: 'DELETE', path: '/api/admin/presets/:id', handler: admin.deletePreset },
  { method: 'GET', path: '/api/admin/plan', handler: plan.adminGet },
  { method: 'PUT', path: '/api/admin/plan', handler: plan.put },
  { method: 'POST', path: '/api/admin/plan', handler: plan.post },
  { method: 'DELETE', path: '/api/admin/plan/:group/:week/:day/:slot', handler: plan.remove },
  { method: 'POST', path: '/api/admin/recalculate', handler: admin.recalc },
  { method: 'GET', path: '/api/admin/compliance', handler: admin.compliance },
  { method: 'GET', path: '/api/admin/export', handler: admin.exportCsv },
  { method: 'GET', path: '/api/admin/audit', handler: admin.getAudit },
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
    const path = new URL(ctx.request.url).pathname;
    if (path.startsWith('/internal/') && ctx.request.headers.get('X-OYO-Internal') !== '1')
      throw new HttpError(404, 'NOT_FOUND', 'Endpoint not found.');
    checkCsrf(ctx.request);
    const matches = routes.filter((row) => matchPath(row.path, path) !== null);
    if (!matches.length) throw new HttpError(404, 'NOT_FOUND', 'Endpoint not found.');
    const found = matches.find((row) => row.method === ctx.request.method);
    if (!found) throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    ctx.params = matchPath(found.path, path)!;
    if (!found.deferredAuth) await authenticate(ctx, found.readOnlyAuth);
    if (ctx.user) requireUser(ctx);
    const allowed = [
      'GET /api/me',
      'GET /api/config',
      'POST /api/me/password',
      'POST /api/me/password/verify',
      'POST /internal/me/password/challenge',
      'POST /internal/me/password/verified',
      'POST /internal/me/password/precheck',
      'POST /internal/me/password/commit',
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
