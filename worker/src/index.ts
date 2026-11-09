export { TeamDO } from './do';
import {
  hashPassword,
  verifyPassword,
  temporaryPassword,
  requirePasswordPepper,
} from './auth/crypto';
import { checkCsrf } from './router';
import { sessionToken } from './db/sessions';
import { readImage } from './imageValidation';
import { readJson, errorResponse, HttpError, json } from './http';
import * as v from './validate';
export interface Env {
  TEAM: DurableObjectNamespace;
  ASSETS: Fetcher;
  OYO_TEST_CLOCK?: string;
  TEAM_CODE?: string;
  PASSWORD_PEPPER?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}
export default {
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const stub = env.TEAM.get(env.TEAM.idFromName('stanford'));
    await stub.fetch('https://oyo.internal/internal/reminders', {
      method: 'POST',
      headers: { 'X-OYO-Internal': '1', 'X-OYO-CSRF': '1' },
    });
  },
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/')) {
      if (request.headers.has('X-OYO-Internal')) {
        const headers = new Headers(request.headers);
        headers.delete('X-OYO-Internal');
        request = new Request(request, { headers });
      }
      const stub = env.TEAM.get(env.TEAM.idFromName('stanford'));
      const reset = /^\/api\/admin\/users\/([^/]+)\/reset-password$/.exec(path);
      if (
        request.method !== 'POST' ||
        (![
          '/api/auth/signup',
          '/api/auth/login',
          '/api/me/password',
          '/api/me/password/verify',
          '/api/images',
        ].includes(path) &&
          !reset)
      )
        return stub.fetch(request);
      const internal = (
        target: string,
        body: Record<string, unknown> | ArrayBuffer = {},
        metadata?: HeadersInit,
      ) => {
        const headers = new Headers({
          'Content-Type': 'application/json',
          'X-OYO-CSRF': '1',
          'X-OYO-Internal': '1',
        });
        if (metadata) new Headers(metadata).forEach((value, name) => headers.set(name, value));
        for (const name of ['Cookie', 'CF-Connecting-IP', 'X-OYO-Test-Now']) {
          const value = request.headers.get(name);
          if (value !== null) headers.set(name, value);
        }
        return stub.fetch(
          new Request(new URL('/internal/' + target, request.url), {
            method: 'POST',
            headers,
            body: body instanceof ArrayBuffer ? body : JSON.stringify(body),
          }),
        );
      };
      try {
        checkCsrf(request);
        if (path === '/api/images') {
          if (!sessionToken(request)) throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in.');
          const image = await readImage(request);
          return internal('images', image.bytes, {
            'Content-Type': image.mime,
            'X-OYO-Image-Width': String(image.width),
            'X-OYO-Image-Height': String(image.height),
          });
        }
        const pepper = requirePasswordPepper(env.PASSWORD_PEPPER);
        if (reset) {
          const target = `admin/users/${reset[1]}/reset-password/`;
          const precheck = await internal(target + 'precheck');
          if (!precheck.ok) return precheck;
          const password = temporaryPassword();
          const { hash, salt } = await hashPassword(password, pepper);
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
        if (path === '/api/me/password/verify') {
          const current = v.string(body.current_password, 'Current password', 8, 200);
          const response = await internal('me/password/challenge');
          if (!response.ok) return response;
          const credentials = await response.json<{
            user_id: string;
            password_hash: string;
            password_salt: string;
            session_hash: string;
          }>();
          if (
            !(await verifyPassword(
              current,
              credentials.password_hash,
              credentials.password_salt,
              pepper,
            ))
          )
            throw new HttpError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect.');
          return internal('me/password/verified', credentials);
        }
        if (path === '/api/me/password') {
          if ('current_password' in body)
            v.invalid('Use /api/me/password/verify to verify the current password first.');
          const next = v.string(body.new_password, 'New password', 8, 200);
          const response = await internal('me/password/precheck', {
            reauth_token: body.reauth_token,
          });
          if (!response.ok) return response;
          const credentials = await response.json<Record<string, unknown>>();
          const { hash, salt } = await hashPassword(next, pepper);
          return internal('me/password/commit', {
            ...credentials,
            reauth_token: body.reauth_token,
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
          const { hash, salt } = await hashPassword(password, pepper);
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
          ? await verifyPassword(
              password,
              credentials.password_hash!,
              credentials.password_salt!,
              pepper,
            )
          : (await hashPassword(password, pepper, 'AAAAAAAAAAAAAAAAAAAAAA=='), false);
        if (!valid)
          throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
        return internal('auth/login/session', {
          email,
          ...credentials,
        });
      } catch (error) {
        return errorResponse(error);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
