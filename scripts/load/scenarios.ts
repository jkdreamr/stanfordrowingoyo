import { setTimeout as delay } from 'node:timers/promises';
import type { EntryInput, User } from '../../shared/types.ts';
import type { Options } from './args.ts';
import type { Sample } from './stats.ts';
import { Client, RequestError } from './http.ts';
import { makeJpeg } from './jpeg.ts';

export function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
export async function authenticate(
  client: Client,
  email: string,
  password: string,
  name: string,
  teamCode?: string,
): Promise<User> {
  try {
    return await client.request('POST /api/auth/login', { body: { email, password } });
  } catch (error) {
    if (!(error instanceof RequestError) || ![401, 404].includes(error.status)) throw error;
    return client.request('POST /api/auth/signup', {
      body: { email, password, name, ...(teamCode ? { team_code: teamCode } : {}) },
    });
  }
}
export async function adminClient(options: Options, samples: Sample[]) {
  if (!options.adminPassword)
    throw new Error('--admin-password or LOAD_ADMIN_PASSWORD is required for admin access');
  const client = new Client(options.baseUrl, samples, 'setup');
  await authenticate(client, options.adminEmail, options.adminPassword, 'Load Test Admin');
  return client;
}
export async function cleanup(options: Options, samples: Sample[]) {
  const client = await adminClient(options, samples);
  client.scenario = 'cleanup';
  const users = await client.request('GET /api/admin/users');
  let count = 0;
  for (const user of users)
    if (/^loadtest\+\d+@example\.com$/.test(user.email)) {
      await client.request('PATCH /api/admin/users/:id', {
        id: user.id,
        body: { active: false, on_leaderboard: false },
      });
      count++;
    }
  console.log(`Deactivated ${count} load-test users.`);
}
interface Rower {
  client: Client;
  user?: User;
  rng: () => number;
  n: number;
  failed: boolean;
  fatal?: boolean;
}
export async function runScenarios(
  options: Options,
  samples: Sample[],
  timings: Record<string, number>,
) {
  let teamCode = options.teamCode;
  if (!teamCode)
    teamCode = (await (await adminClient(options, samples)).request('GET /api/admin/settings'))
      .team_code;
  const rowers: Rower[] = Array.from({ length: options.users }, (_, i) => ({
    client: new Client(options.baseUrl, samples, 'session'),
    rng: random(options.seed + i),
    n: i + 1,
    failed: false,
  }));
  async function login(r: Rower) {
    if (!r.user)
      r.user = await authenticate(
        r.client,
        `loadtest+${r.n}@example.com`,
        options.password,
        `Load Test ${r.n}`,
        teamCode,
      );
  }
  async function post(r: Rower, date: string, images: boolean) {
    const body: EntryInput = {
      date,
      modality: (['erg', 'bike', 'run'] as const)[Math.floor(r.rng() * 3)],
      zone: (['R', 'R/E', 'E', 'E/D', 'D', 'D/C', 'C', 'C/B', 'B', 'A'] as const)[
        Math.floor(r.rng() * 10)
      ],
      distance_m: 2000 + Math.floor(r.rng() * 58001),
      title: `Load Test ${r.n}`,
      notes: 'Synthetic QA workout',
      visibility: r.rng() < 0.9 ? 'team' : 'private',
    };
    if (images && r.rng() < 0.4) {
      const image = await r.client.request('POST /api/images', {
        body: new Blob([makeJpeg()], { type: 'image/jpeg' }),
      });
      body.image_ids = [image.id];
    }
    await r.client.request('POST /api/entries', { body });
  }
  async function session(r: Rower) {
    await login(r);
    const think = () => delay(100 + Math.floor(r.rng() * 501));
    await r.client.request('GET /api/me');
    await think();
    const config = await r.client.request('GET /api/config');
    await r.client.request('GET /api/stats/week');
    await think();
    const count = 1 + Math.floor(r.rng() * 3);
    for (let i = 0; i < count; i++) {
      await post(r, config.today, true);
      await think();
    }
    let cursor: string | undefined;
    let fetchedImages = 0;
    for (let page = 0; page < 3; page++) {
      const feed = await r.client.request('GET /api/entries', {
        query: { scope: 'feed', ...(cursor ? { cursor } : {}) },
      });
      for (const entry of feed.items) {
        if (entry.user_id !== r.user?.id && r.rng() < 0.15) {
          await r.client.request('POST /api/entries/:id/kudos', { id: entry.id });
          await r.client.request('POST /api/entries/:id/comments', {
            id: entry.id,
            body: { body: 'Nice work! (load test)' },
          });
        }
        for (const image of entry.images)
          if (fetchedImages < 2) {
            await r.client.request('GET /api/images/:id', { id: image.id });
            fetchedImages++;
          }
      }
      if (!feed.next_cursor) break;
      cursor = feed.next_cursor;
      await think();
    }
    for (const metric of ['percent', 'meters', 'season'] as const)
      await r.client.request('GET /api/leaderboard', { query: { metric } });
    await r.client.request('GET /api/stats/season');
  }
  async function safely(r: Rower, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (error) {
      r.failed = true;
      r.fatal = !(error instanceof RequestError) || error.status === 0 || error.status >= 500;
      console.error(`Rower ${r.n}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (options.scenario !== 'burst') {
    const start = performance.now();
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(options.concurrency, rowers.length) }, async () => {
        while (next < rowers.length) {
          const r = rowers[next++];
          await safely(r, () => session(r));
        }
      }),
    );
    timings.session = (performance.now() - start) / 1000;
  }
  if (options.scenario !== 'session') {
    const start = performance.now();
    await Promise.all(
      rowers
        .filter((r) => !r.failed)
        .map(async (r) => {
          const offset = r.rng() * options.burstWindow * 1000;
          await delay(Math.max(0, start + offset - performance.now()));
          r.client.scenario = 'burst';
          await safely(r, async () => {
            await login(r);
            const config = await r.client.request('GET /api/config');
            await post(r, config.today, false);
            await r.client.request('GET /api/stats/week');
            await r.client.request('GET /api/leaderboard', { query: { metric: 'percent' } });
          });
        }),
    );
    timings.burst = (performance.now() - start) / 1000;
  }
  return rowers.filter((r) => r.fatal).length;
}
