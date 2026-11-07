/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it, vi } from 'vitest';
import worker, { type Env } from './index';
import { insertRosterFixture } from './testFixtures';
import { MAX_IMAGE_BYTES, readImage } from './imageValidation';
import { route } from './router';

const bindings = env as unknown as Env;
const NOW = '2026-11-01T18:00:00Z';
const stub = () => bindings.TEAM.get(bindings.TEAM.idFromName('stanford'));
function sql<T>(fn: (s: DurableObjectStorage) => T) {
  return runInDurableObject(stub(), (_, state) => fn(state.storage));
}
function png() {
  return new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 2, 0, 0, 0, 3,
  ]);
}
function upload(bytes = png(), headers: Record<string, string> = {}) {
  return new Request('https://oyo.test/api/images', {
    method: 'POST',
    headers: {
      Cookie: 'oyo_session=fixture',
      'X-OYO-CSRF': '1',
      'Content-Type': 'image/png',
      ...headers,
    },
    body: bytes,
  });
}
async function signup() {
  const id = await sql((s) => insertRosterFixture(s, 'Athlete', 'rower', 'athlete@example.com'));
  const response = await SELF.fetch('https://oyo.test/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-OYO-Test-Now': NOW },
    body: JSON.stringify({
      roster_id: id,
      email: 'athlete@example.com',
      password: 'password123',
      group_key: 'normal',
    }),
  });
  expect(response.status).toBe(201);
  return {
    cookie: response.headers.get('Set-Cookie')!.split(';')[0],
    user: await response.json<{ id: string }>(),
  };
}
beforeEach(async () => {
  await SELF.fetch('https://oyo.test/api/health');
  await sql((s) => {
    for (const table of ['roster', 'users', 'sessions', 'images', 'rate_limits'])
      s.sql.exec(`DELETE FROM ${table}`);
  });
});
it('rejects invalid uploads in the Worker without making a DO request or writing an image', async () => {
  const fetch = vi.fn(() => Response.json({ id: 'unexpected' }, { status: 201 }));
  const fake = {
    ...bindings,
    TEAM: { idFromName: () => 'team', get: () => ({ fetch }) },
  } as unknown as Env;
  for (const [bytes, headers, status, code, message] of [
    [
      png(),
      { 'Content-Type': 'image/gif' },
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Upload a JPEG, PNG, or WebP image with matching content type.',
    ],
    [
      png(),
      { 'Content-Length': String(MAX_IMAGE_BYTES + 1) },
      413,
      'PAYLOAD_TOO_LARGE',
      'Image must not exceed 1.5 MB.',
    ],
    [
      new Uint8Array(MAX_IMAGE_BYTES + 1),
      {},
      413,
      'PAYLOAD_TOO_LARGE',
      'Image must not exceed 1.5 MB.',
    ],
    [new Uint8Array(), {}, 400, 'VALIDATION_ERROR', 'Image cannot be empty.'],
    [
      new Uint8Array([1, 2, 3]),
      {},
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Upload a JPEG, PNG, or WebP image with matching content type.',
    ],
    [png().slice(0, 8), {}, 400, 'VALIDATION_ERROR', 'Image dimensions could not be read.'],
    [
      new Uint8Array([...png().slice(0, 16), 0, 0, 0, 0, 0, 0, 0, 0]),
      {},
      400,
      'VALIDATION_ERROR',
      'Image dimensions must be positive.',
    ],
    [png(), { Cookie: '' }, 401, 'UNAUTHENTICATED', 'Please log in.'],
    [png(), { Origin: 'https://evil.test' }, 403, 'CSRF_REJECTED', 'Cross-site request rejected.'],
  ] as [Uint8Array<ArrayBuffer>, Record<string, string>, number, string, string][]) {
    const response = await worker.fetch(upload(bytes, headers), fake);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: { code, message } });
    expect(fetch).not.toHaveBeenCalled();
  }
  await sql((s) => expect(s.sql.exec('SELECT * FROM images').toArray()).toHaveLength(0));
});
it('forwards only validated metadata and the exact bytes with the existing internal context headers', async () => {
  let forwarded: Request | undefined;
  const fake = {
    ...bindings,
    PASSWORD_PEPPER: undefined,
    TEAM: {
      idFromName: () => 'team',
      get: () => ({
        fetch: (request: Request) => {
          forwarded = request;
          return Response.json({ id: 'image' }, { status: 201 });
        },
      }),
    },
  } as unknown as Env;
  const response = await worker.fetch(
    upload(png(), {
      'X-OYO-Internal': 'attacker',
      'X-OYO-Image-Width': '999',
      'X-OYO-Image-Height': '999',
      'CF-Connecting-IP': '192.0.2.42',
      'X-OYO-Test-Now': NOW,
    }),
    fake,
  );
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ id: 'image' });
  expect(new URL(forwarded!.url).pathname).toBe('/internal/images');
  for (const [header, value] of Object.entries({
    'X-OYO-Internal': '1',
    'X-OYO-Image-Width': '2',
    'X-OYO-Image-Height': '3',
    'Content-Type': 'image/png',
    Cookie: 'oyo_session=fixture',
    'CF-Connecting-IP': '192.0.2.42',
    'X-OYO-Test-Now': NOW,
  }))
    expect(forwarded!.headers.get(header), header).toBe(value);
  expect(new Uint8Array(await forwarded!.arrayBuffer())).toEqual(png());
});
it('keeps internal upload inaccessible externally and the old DO public upload route unavailable', async () => {
  const client = await signup();
  const request = upload(png(), {
    Cookie: client.cookie,
    'X-OYO-Internal': '1',
    'X-OYO-Image-Width': '2',
    'X-OYO-Image-Height': '3',
    'X-OYO-Test-Now': NOW,
  });
  const external = await SELF.fetch(
    new Request('https://oyo.test/internal/images', request.clone()),
  );
  expect(external.headers.get('Content-Type') ?? '').not.toContain('application/json');
  const unmarked = new Request('https://oyo.test/internal/images', request.clone());
  unmarked.headers.delete('X-OYO-Internal');
  expect((await stub().fetch(unmarked)).status).toBe(404);
  expect((await stub().fetch(request)).status).toBe(404);
  expect(
    (
      await SELF.fetch(
        upload(new Uint8Array([1, 2, 3]), { Cookie: client.cookie, 'X-OYO-Internal': '1' }),
      )
    ).status,
  ).toBe(415);
  await sql((s) => expect(s.sql.exec('SELECT * FROM images').toArray()).toHaveLength(0));
});
it('stores JPEG, PNG and WebP unchanged and preserves dimensions and 201 id responses', async () => {
  const client = await signup();
  const webp = new Uint8Array(30);
  webp.set(new TextEncoder().encode('RIFF'));
  webp.set(new TextEncoder().encode('WEBPVP8X'), 8);
  new DataView(webp.buffer).setUint32(16, 10, true);
  webp[24] = 1;
  webp[27] = 2;
  const jpeg = new Uint8Array([255, 216, 255, 192, 0, 11, 8, 0, 3, 0, 2, 1, 1, 17, 0]);
  for (const [bytes, mime] of [
    [png(), 'image/png'],
    [jpeg, 'image/jpeg'],
    [webp, 'image/webp'],
  ] as const) {
    const response = await SELF.fetch(
      upload(bytes, {
        Cookie: client.cookie,
        'Content-Type': mime,
        'X-OYO-Test-Now': NOW,
        'X-OYO-Internal': 'spoof',
        'X-OYO-Image-Width': '999',
      }),
    );
    expect(response.status).toBe(201);
    const body = await response.json<{ id: string }>();
    expect(Object.keys(body)).toEqual(['id']);
    await sql((s) => {
      const image = s.sql
        .exec<{
          owner_id: string;
          mime: string;
          width: number;
          height: number;
          bytes: ArrayBuffer;
          created_at: string;
        }>('SELECT * FROM images WHERE id=?', body.id)
        .one();
      expect(image).toMatchObject({
        owner_id: client.user.id,
        mime,
        width: 2,
        height: 3,
        created_at: new Date(NOW).toISOString(),
      });
      expect(new Uint8Array(image.bytes)).toEqual(bytes);
    });
  }
});
it('assembles streamed bodies with accurate, missing, too-short and too-long content-length hints without adding bytes', async () => {
  for (const length of [undefined, 24, 3, 100]) {
    const bytes = png();
    const request = new Request('https://oyo.test/api/images', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        ...(length === undefined ? {} : { 'Content-Length': String(length) }),
      },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(bytes.slice(0, 10));
          controller.enqueue(bytes.slice(10));
          controller.close();
        },
      }),
    });
    const result = await readImage(request);
    expect(new Uint8Array(result.bytes)).toEqual(bytes);
    expect(result).toMatchObject({ mime: 'image/png', width: 2, height: 3 });
  }
});
it('authenticates only after the internal body read and rejects session revocation during that await', async () => {
  const client = await signup();
  await sql(async (s) => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(value) {
        controller = value;
      },
    });
    const request = new Request('https://oyo.test/internal/images', {
      method: 'POST',
      headers: {
        Cookie: client.cookie,
        'X-OYO-Internal': '1',
        'Content-Type': 'image/png',
        'X-OYO-Image-Width': '2',
        'X-OYO-Image-Height': '3',
      },
      body,
    });
    const pending = route({ request, storage: s, env: bindings, now: new Date(NOW), params: {} });
    s.sql.exec('DELETE FROM sessions WHERE user_id=?', client.user.id);
    controller.enqueue(png());
    controller.close();
    const response = await pending;
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
    expect(s.sql.exec('SELECT * FROM images').toArray()).toHaveLength(0);
  });
});
