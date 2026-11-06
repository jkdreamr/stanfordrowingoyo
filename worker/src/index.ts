export { TeamDO } from './do';
import { hashPassword, verifyPassword, temporaryPassword } from './auth/crypto';
import { checkCsrf } from './router';
import { readJson, errorResponse, HttpError, json } from './http';
import * as v from './validate';
export interface Env {
  TEAM: DurableObjectNamespace;
  ASSETS: Fetcher;
  OYO_TEST_CLOCK?: string;
  TEAM_CODE?: string;
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/')) {
      const headers = new Headers(request.headers);
      headers.delete('X-OYO-Internal');
      request = new Request(request, { headers });
      const stub = env.TEAM.get(env.TEAM.idFromName('stanford'));
      const reset = /^\/api\/admin\/users\/([^/]+)\/reset-password$/.exec(path);
      if (
        request.method !== 'POST' ||
        (!['/api/auth/signup', '/api/auth/login', '/api/me/password'].includes(path) && !reset)
      )
        return stub.fetch(request);
      const internal = (target: string, body: Record<string, unknown> = {}) => {
        const headers = new Headers({
          'Content-Type': 'application/json',
          'X-OYO-CSRF': '1',
          'X-OYO-Internal': '1',
        });
        for (const name of ['Cookie', 'CF-Connecting-IP', 'X-OYO-Test-Now']) {
          const value = request.headers.get(name);
          if (value !== null) headers.set(name, value);
        }
        return stub.fetch(
          new Request(new URL('/internal/' + target, request.url), {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          }),
        );
      };
      try {
        checkCsrf(request);
        if (reset) {
          const target = `admin/users/${reset[1]}/reset-password/`;
          const precheck = await internal(target + 'precheck');
          if (!precheck.ok) return precheck;
          const password = temporaryPassword();
          const { hash, salt } = await hashPassword(password);
          const response = await internal(target + 'commit', {
            password_hash: hash,
            password_salt: salt,
          });
          if (!response.ok) return response;
          const result = json({ temporary_password: password });
          const cookie = response.headers.get('Set-Cookie');
          if (cookie) result.headers.set('Set-Cookie', cookie);
          return result;
        }
        const body = await readJson(request);
        if (path === '/api/me/password') {
          const current = v.string(body.current_password, 'Current password', 8, 200);
          const next = v.string(body.new_password, 'New password', 8, 200);
          if (current === next) v.invalid('New password must differ from the current password.');
          const response = await internal('me/password/challenge');
          if (!response.ok) return response;
          const credentials = await response.json<{
            user_id: string;
            password_hash: string;
            password_salt: string;
          }>();
          if (
            !(await verifyPassword(current, credentials.password_hash, credentials.password_salt))
          )
            throw new HttpError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect.');
          const { hash, salt } = await hashPassword(next);
          return internal('me/password/commit', {
            ...credentials,
            new_password_hash: hash,
            new_password_salt: salt,
          });
        }
        const email = v.email(body.email);
        const password = v.string(body.password, 'Password', 8, 200);
        if (path === '/api/auth/signup') {
          const input = {
            email,
            roster_id: body.roster_id,
            team_code: body.team_code,
            group_key: body.group_key,
          };
          const response = await internal('auth/signup/precheck', input);
          if (!response.ok) return response;
          const { hash, salt } = await hashPassword(password);
          return internal('auth/signup/commit', {
            ...input,
            password_hash: hash,
            password_salt: salt,
          });
        }
        const response = await internal('auth/login/challenge', { email });
        if (!response.ok) return response;
        const credentials = await response.json<{
          user_id: string | null;
          password_hash: string | null;
          password_salt: string | null;
        }>();
        const valid = credentials.user_id
          ? await verifyPassword(password, credentials.password_hash!, credentials.password_salt!)
          : (await hashPassword(password, 'AAAAAAAAAAAAAAAAAAAAAA=='), false);
        if (!valid)
          throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
        return internal('auth/login/session', { email, ...credentials });
      } catch (error) {
        return errorResponse(error);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
