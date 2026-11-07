import type { Api, ApiError } from '../../../shared/types';
import { IDEMPOTENCY_HEADER } from '../../../shared/headers';
export class ApiClientError extends Error {
  constructor(
    public status: number,
    public detail: ApiError['error'],
  ) {
    super(detail.message);
  }
}
type Params<K extends keyof Api> = K extends `${string}/:${string}`
  ? { params: Record<string, string> }
  : { params?: never };
type Body<K extends keyof Api> = Api[K]['request'] extends void
  ? { body?: never }
  : { body: Api[K]['request'] };
type Query<K extends keyof Api> = Api[K]['query'] extends never
  ? { query?: never }
  : { query?: Api[K]['query'] };
export type RequestOptions<K extends keyof Api> = Params<K> &
  Body<K> &
  Query<K> & { signal?: AbortSignal; idempotencyKey?: string; retry?: boolean };
function networkError() {
  return new ApiClientError(0, { code: 'NETWORK_ERROR', message: 'No connection. Try again.' });
}
function pause(ms: number, signal?: AbortSignal, online = false): Promise<void> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const finish = (error?: unknown) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (online) window.removeEventListener('online', connected);
      if (error) reject(error);
      else resolve();
    };
    const abort = () => finish(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    const connected = () => finish();
    const timer = setTimeout(() => finish(online ? networkError() : undefined), ms);
    signal?.addEventListener('abort', abort, { once: true });
    if (online) {
      window.addEventListener('online', connected, { once: true });
      if (navigator.onLine !== false) finish();
    }
  });
}
const hashingEndpoints = new Set<keyof Api>([
  'POST /api/auth/signup',
  'POST /api/auth/login',
  'POST /api/me/password/verify',
  'POST /api/me/password',
  'POST /api/admin/users/:id/reset-password',
]);
function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const error = value.error;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}
/**
 * Every Api key is supported, including GET /api/me/target and enriched social responses.
 * Request/response types are derived from the shared contract; images and CSV bypass JSON.
 */
export async function api<K extends keyof Api>(
  endpoint: K,
  options: RequestOptions<K>,
): Promise<Api[K]['response']> {
  const [method, template] = endpoint.split(' ');
  const path = template.replace(/:([a-z_]+)/g, (_, key: string) => {
    const value = options.params?.[key];
    if (!value) throw new Error('Missing path parameter: ' + key);
    return encodeURIComponent(value);
  });
  const url = new URL(path, window.location.origin);
  if (options.query)
    for (const [key, value] of Object.entries(options.query))
      if (value !== undefined) url.searchParams.set(key, String(value));
  const raw = options.body instanceof Blob;
  const retry =
    (endpoint === 'POST /api/images' && options.retry !== false) ||
    (endpoint === 'POST /api/entries' && !!options.idempotencyKey && options.retry === true);
  const deadline = Date.now() + 60000;
  const request: RequestInit = {
    method,
    credentials: 'same-origin',
    signal: options.signal,
    headers:
      options.body === undefined
        ? {
            'X-OYO-CSRF': '1',
            ...(options.idempotencyKey ? { [IDEMPOTENCY_HEADER]: options.idempotencyKey } : {}),
          }
        : {
            'X-OYO-CSRF': '1',
            ...(options.idempotencyKey ? { [IDEMPOTENCY_HEADER]: options.idempotencyKey } : {}),
            'Content-Type': raw ? (options.body as Blob).type : 'application/json',
          },
    body:
      options.body === undefined
        ? undefined
        : raw
          ? (options.body as Blob)
          : JSON.stringify(options.body),
  };
  for (let attempt = 0; ; attempt++) {
    options.signal?.throwIfAborted();
    if (retry && navigator.onLine === false)
      await pause(Math.max(0, deadline - Date.now()), options.signal, true);
    let response: Response;
    try {
      response = await fetch(url, request);
    } catch (error) {
      options.signal?.throwIfAborted();
      if (!retry || !(error instanceof TypeError)) throw error;
      if (attempt >= 5) throw networkError();
      await pause(500 * 2 ** attempt * (0.8 + Math.random() * 0.4), options.signal);
      continue;
    }
    if (!response.ok) {
      const error: unknown = await response.json().catch(() => undefined);
      options.signal?.throwIfAborted();
      if (isApiError(error)) throw new ApiClientError(response.status, error.error);
      if (retry && response.status >= 500 && response.status <= 599) {
        if (attempt >= 5) throw networkError();
        await pause(500 * 2 ** attempt * (0.8 + Math.random() * 0.4), options.signal);
        continue;
      }
      if (hashingEndpoints.has(endpoint) && response.status >= 500 && response.status <= 599) {
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          continue;
        }
        throw new ApiClientError(response.status, {
          code: 'SERVER_BUSY',
          message: 'The server is busy. Please try again.',
        });
      }
      throw new ApiClientError(response.status, {
        code: 'HTTP_ERROR',
        message: 'Request failed. Please try again.',
      });
    }
    if (response.status === 204) return undefined as Api[K]['response'];
    if (endpoint === 'GET /api/images/:id') return (await response.blob()) as Api[K]['response'];
    if (endpoint === 'GET /api/admin/export') return (await response.text()) as Api[K]['response'];
    return response.json() as Promise<Api[K]['response']>;
  }
}
