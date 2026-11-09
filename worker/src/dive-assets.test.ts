import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { expect, it, vi } from 'vitest';
import type { Env } from './index';
import { privateUrls } from '../../scripts/dive/private-urls';
import { answerSet } from './games/dive/sets';

const bindings = env as unknown as Env;

it('reads a private answer asset through ASSETS inside TeamDO', async () => {
  const stub = bindings.TEAM.get(bindings.TEAM.idFromName('dive-assets'));
  const set = await runInDurableObject(stub, async (instance) => {
    const response = await (instance as unknown as { env: Env }).env.ASSETS.fetch(
      'https://assets.invalid/_private/dive/instruments.json',
    );
    return response.json<{ size: number; gem: { answer: string } }>();
  });
  expect(set.size).toBeGreaterThan(0);
  expect(set.gem.answer).toBe('Nyckelharpa');
});

it('keeps concurrent reads in a single promise, evicts failures, and rejects unknown ids', async () => {
  vi.resetModules();
  const { answerSet: load } = await import('./games/dive/sets');
  const fetch = vi.fn().mockResolvedValueOnce(new Response('missing', { status: 404 }));
  const fake = { ASSETS: { fetch } };
  const first = load(fake, 'instruments');
  expect(load(fake, 'instruments')).toBe(first);
  await expect(first).rejects.toThrow('Could not load Dive prompt');
  fetch.mockResolvedValueOnce(new Response('{}'));
  await expect(load(fake, 'instruments')).rejects.toThrow('Invalid Dive prompt asset');
  fetch.mockImplementation((url: string) => bindings.ASSETS.fetch(url));
  const set = await load(fake, 'instruments');
  expect(set.gem.answer).toBe('Nyckelharpa');
  expect(await load(fake, 'instruments')).toBe(set);
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(() => load(fake, '__proto__')).toThrow('Unknown Dive prompt');
});

it('never returns answer bytes for public private-path variants', async () => {
  const set = await answerSet(bindings, 'instruments');
  const index = await SELF.fetch('https://oyo.test/');
  const indexBody = await index.text();
  for (const [method, path] of privateUrls('instruments')) {
    const response = await SELF.fetch('https://oyo.test' + path, { method, redirect: 'follow' });
    const body = await response.text();
    expect(body).not.toContain(set.answers);
    expect(body).not.toContain(set.gem.answer);
    expect(body).not.toContain('DIVE_PRIVATE_SENTINEL_NOT_REAL_ANSWER_DATA');
    expect([404, 200]).toContain(response.status);
    if (response.status === 200) {
      expect(index.status).toBe(200);
      if (method !== 'HEAD') expect(body).toBe(indexBody);
      else expect(response.headers.get('content-type')).toBe(index.headers.get('content-type'));
    }
  }
});
