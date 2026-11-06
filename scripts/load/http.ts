import type { Api } from '../../shared/types.ts';
import type { Sample } from './stats.ts';
import { routeTemplate } from './stats.ts';

export class RequestError extends Error {
  status: number;
  constructor(status: number, endpoint: string) {
    super(`${endpoint}: ${status || 'network error'}`);
    this.status = status;
  }
}
export class Client {
  cookies = new Map<string, string>();
  baseUrl: string;
  samples: Sample[];
  scenario: string;
  constructor(baseUrl: string, samples: Sample[], scenario: string) {
    this.baseUrl = baseUrl;
    this.samples = samples;
    this.scenario = scenario;
  }
  async request<K extends keyof Api>(
    endpoint: K,
    options: {
      id?: string;
      query?: Api[K]['query'];
      body?: Api[K]['request'];
    } = {},
  ): Promise<Api[K]['response']> {
    const [method, template] = endpoint.split(' ');
    let path = template.replace(':id', encodeURIComponent(options.id ?? ''));
    if (options.query)
      path += `?${new URLSearchParams(Object.entries(options.query).map(([k, v]) => [k, String(v)]))}`;
    const headers = new Headers();
    headers.set('Cookie', [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '));
    const raw = options.body instanceof Blob;
    if (options.body !== undefined)
      headers.set(
        'Content-Type',
        raw ? (options.body instanceof Blob ? options.body.type : '') : 'application/json',
      );
    const start = performance.now();
    let status = 0;
    try {
      const response = await fetch(this.baseUrl + path, {
        method,
        headers,
        body: raw
          ? (options.body as Blob)
          : options.body === undefined
            ? undefined
            : JSON.stringify(options.body),
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
      });
      status = response.status;
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(';')[0];
        const i = pair.indexOf('=');
        if (i > 0) this.cookies.set(pair.slice(0, i), pair.slice(i + 1));
      }
      const bytes = await response.arrayBuffer();
      if (!response.ok) throw new RequestError(status, endpoint);
      if (endpoint === 'GET /api/images/:id') return new Blob([bytes]) as Api[K]['response'];
      return (
        bytes.byteLength ? JSON.parse(new TextDecoder().decode(bytes)) : undefined
      ) as Api[K]['response'];
    } catch (error) {
      if (error instanceof RequestError) throw error;
      status = 0;
      throw new RequestError(status, endpoint);
    } finally {
      this.samples.push({
        scenario: this.scenario,
        endpoint: routeTemplate(method, path),
        ms: performance.now() - start,
        status,
      });
    }
  }
}
