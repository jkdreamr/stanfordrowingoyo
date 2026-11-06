import { setTimeout as delay } from 'node:timers/promises';
import type { EntryInput, User } from '../../shared/types.ts';
import type { Options } from './args.ts';
import type { Sample } from './stats.ts';
import { measurePhase } from './stats.ts';
import { Client, RequestError } from './http.ts';
import { makeJpeg } from './jpeg.ts';
import {
  bootstrapAdmin,
  prepareRoster,
  discoverRoster,
  deactivateUsers,
  loadEmail,
} from './roster.ts';
import type { ClaimSignup } from './contract.ts';

export function random(seed: number) {
  let state = seed >>> 0;
  state = Math.imul(state ^ (state >>> 16), 0x21f0aaad);
  state = Math.imul(state ^ (state >>> 15), 0x735a2d97);
  state = (state ^ (state >>> 15)) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
export async function authenticate(
  client: Client,
  email: string,
  password: string,
  teamCode: string,
  claim: Pick<ClaimSignup, 'roster_id' | 'group_key'>,
  loginFirst = false,
): Promise<User> {
  const login = () => client.request('POST /api/auth/login', { body: { email, password } });
  const signup = () =>
    client.request('POST /api/auth/signup', {
      body: { email, password, team_code: teamCode, ...claim },
    });
  try {
    return await (loginFirst ? login() : signup());
  } catch (error) {
    if (
      !(error instanceof RequestError) ||
      !(loginFirst ? [401, 404] : [409]).includes(error.status)
    )
      throw error;
    return loginFirst ? signup() : login();
  }
}
export async function cleanup(
  options: Options,
  samples: Sample[],
  timings: Record<string, number> = {},
) {
  const { client } = await measurePhase(timings, 'setup', () => bootstrapAdmin(options, samples));
  client.scenario = 'cleanup';
  await measurePhase(timings, 'cleanup', async () => {
    const rows = await client.request('GET /api/admin/roster');
    let unlinked = 0;
    let deleted = 0;
    for (const row of rows)
      if (/^Load Test \d+$/.test(row.name)) {
        if (row.claimed_by_user_id) {
          await client.request('POST /api/admin/roster/:id/unlink', { id: row.id });
          unlinked++;
        }
        await client.request('DELETE /api/admin/roster/:id', { id: row.id });
        deleted++;
      }
    console.log(`Unlinked ${unlinked} and deleted ${deleted} load-test roster rows.`);
    await deactivateUsers(client, await client.request('GET /api/admin/users'));
  });
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
  const { teamCode, roster } = await measurePhase(timings, 'setup', async () => {
    const { client: admin, teamCode } = await bootstrapAdmin(options, samples);
    const roster = await prepareRoster(admin, options.users);
    const choices = await discoverRoster(admin, teamCode);
    for (const row of roster.values())
      if (!row.claimed_by_user_id && !choices.some((choice) => choice.id === row.id))
        throw new Error('Synthetic row is not available to claim: ' + row.name);
    return { teamCode, roster };
  });
  const rowers: Rower[] = Array.from({ length: options.users }, (_, i) => ({
    client: new Client(options.baseUrl, samples, 'auth'),
    rng: random(options.seed + i),
    n: i + 1,
    failed: false,
  }));
  async function login(r: Rower) {
    if (!r.user)
      r.user = await authenticate(
        r.client,
        loadEmail(r.n),
        options.password,
        teamCode,
        {
          roster_id: roster.get(r.n)!.id,
          group_key: (['frosh', 'normal', 'u23'] as const)[Math.floor(r.rng() * 3)],
        },
        options.scenario === 'burst' || !!roster.get(r.n)?.claimed_by_user_id,
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
  async function pool(items: Rower[], run: (r: Rower) => Promise<void>) {
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(options.concurrency, items.length) }, async () => {
        while (next < items.length) {
          const r = items[next++];
          await safely(r, () => run(r));
        }
      }),
    );
  }
  await measurePhase(timings, 'auth', () => pool(rowers, login));
  if (options.scenario !== 'burst') {
    await measurePhase(timings, 'session', () =>
      pool(
        rowers.filter((r) => !r.failed),
        async (r) => {
          r.client.scenario = 'session';
          await session(r);
        },
      ),
    );
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
