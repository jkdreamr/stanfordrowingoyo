import type { Api, ApiError } from '../../../shared/types';
export class ApiClientError extends Error { constructor(public status: number, public detail: ApiError['error']) { super(detail.message); } }
type Params<K extends keyof Api> = K extends `${string}/:${string}` ? { params: Record<string, string> } : { params?: never };
type Body<K extends keyof Api> = Api[K]['request'] extends void ? { body?: never } : { body: Api[K]['request'] };
type Query<K extends keyof Api> = Api[K]['query'] extends never ? { query?: never } : { query?: Api[K]['query'] };
export type RequestOptions<K extends keyof Api> = Params<K> & Body<K> & Query<K> & { signal?: AbortSignal };
/** Every Api key is supported; raw images and CSV are decoded without JSON parsing. */
export async function api<K extends keyof Api>(endpoint: K, options: RequestOptions<K>): Promise<Api[K]['response']> {
 const [method, template] = endpoint.split(' ');
 const path = template.replace(/:([a-z_]+)/g, (_, key: string) => { const value = options.params?.[key]; if (!value) throw new Error('Missing path parameter: ' + key); return encodeURIComponent(value); });
 const url = new URL(path, window.location.origin);
 if (options.query) for (const [key,value] of Object.entries(options.query)) if (value !== undefined) url.searchParams.set(key,String(value));
 const raw = options.body instanceof Blob;
 const response = await fetch(url, { method, credentials: 'same-origin', signal: options.signal, headers: options.body === undefined ? undefined : { 'Content-Type': raw ? (options.body as Blob).type : 'application/json' }, body: options.body === undefined ? undefined : raw ? options.body as Blob : JSON.stringify(options.body) });
 if (!response.ok) { const error = await response.json() as ApiError; throw new ApiClientError(response.status,error.error); }
 if (response.status === 204) return undefined as Api[K]['response'];
 if (endpoint === 'GET /api/images/:id') return await response.blob() as Api[K]['response'];
 if (endpoint === 'GET /api/admin/export') return await response.text() as Api[K]['response'];
 return response.json() as Promise<Api[K]['response']>;
}
