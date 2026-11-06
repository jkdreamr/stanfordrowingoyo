/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User, EntryDetail, Announcement, Preset } from '../../shared/types';
import type { Env } from './index';
import type { Context } from './context';
import { migrate } from './db/migrate';
import { byId } from './db/users';
import { setSetting } from './db/settings';
import { insertRosterFixture } from './testFixtures';
import { requireStaff } from './auth/guards';
import { hashPassword } from './auth/crypto';
import { createSession, prepareSession } from './db/sessions';
import { saveEntry, deleteEntry } from './db/entries';
import * as admin from './routes/admin';
import * as me from './routes/me';
import * as auth from './routes/auth';
import * as entries from './routes/entries';
import * as announcements from './routes/announcements';
import * as plan from './routes/plan';
import * as social from './routes/social';
import * as notifications from './routes/notifications';
import * as images from './routes/images';
const bindings = env as unknown as Env;
const NOW = '2026-03-09T18:00:00Z';
type Client = { cookie: string; user: User };
function sql<T>(fn: (storage: DurableObjectStorage) => T): Promise<T> {
  return runInDurableObject(
    bindings.TEAM.get(bindings.TEAM.idFromName('stanford')),
    (_instance, state) => fn(state.storage),
  );
}
function api(path: string, client?: Client, method = 'GET', body?: unknown) {
  return SELF.fetch('https://oyo.test/api' + path, {
    method,
    headers: {
      'X-OYO-CSRF': '1',
      'Content-Type': 'application/json',
      'X-OYO-Test-Now': NOW,
      ...(client ? { Cookie: client.cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function user(name: string, role = 'rower') {
  const id = await sql((storage) => insertRosterFixture(storage, name, role));
  const response = await api('/auth/signup', undefined, 'POST', {
    roster_id: id,
    team_code: 'team-code',
    email: name.toLowerCase() + '@example.com',
    password: 'password123',
  });
  expect(response.status).toBe(201);
  return {
    cookie: response.headers.get('Set-Cookie')!.split(';')[0],
    user: await response.json<User>(),
  };
}
function context(
  storage: DurableObjectStorage,
  client?: Client,
  params: Record<string, string> = {},
) {
  return {
    storage,
    env: bindings,
    now: new Date(NOW),
    params,
    ...(client
      ? {
          user: byId(storage, client.user.id),
          tokenHash: storage.sql
            .exec<{ token_hash: string }>(
              'SELECT token_hash FROM sessions WHERE user_id=?',
              client.user.id,
            )
            .one().token_hash,
        }
      : {}),
    request: new Request('https://oyo.test/api/test'),
  } satisfies Context;
}
function delayed(
  storage: DurableObjectStorage,
  client: Client,
  params: Record<string, string> = {},
  mime = 'application/json',
) {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const ctx: Context = context(storage, client, params);
  ctx.request = new Request('https://oyo.test/api/test', {
    method: 'POST',
    headers: { 'Content-Type': mime },
    body: new ReadableStream<Uint8Array>({
      start(value) {
        controller = value;
      },
    }),
  });
  return {
    ctx,
    send(body: unknown) {
      controller.enqueue(
        body instanceof Uint8Array ? body : new TextEncoder().encode(JSON.stringify(body)),
      );
      controller.close();
    },
  };
}
function jsonContext(
  storage: DurableObjectStorage,
  client: Client | undefined,
  body: unknown,
  params: Record<string, string> = {},
) {
  const ctx: Context = context(storage, client, params);
  ctx.request = new Request('https://oyo.test/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return ctx;
}
function latch() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function pausedCrypto(
  start: () => Promise<Response>,
  mutate: () => unknown | Promise<unknown>,
  status: number,
  at = 1,
) {
  const entered = latch();
  const release = latch();
  let calls = 0;
  const original = crypto.subtle.deriveBits.bind(crypto.subtle);
  const spy = vi.spyOn(crypto.subtle, 'deriveBits').mockImplementation(async (...args) => {
    const index = ++calls;
    const result = await original(...args);
    if (index === at) {
      entered.resolve();
      await release.promise;
    }
    return result;
  });
  try {
    const pending = start();
    const outcome = expect(pending).rejects.toMatchObject({ status });
    await entered.promise;
    await mutate();
    release.resolve();
    await outcome;
  } finally {
    release.resolve();
    spy.mockRestore();
  }
}
const entryBody = {
  date: '2026-03-09',
  modality: 'erg',
  zone: 'E',
  distance_m: 10000,
  title: 'Training',
  notes: '',
  visibility: 'team',
};
beforeEach(async () => {
  await api('/health');
  await sql((storage) =>
    storage.transactionSync(() => {
      for (const table of [
        'roster',
        'users',
        'sessions',
        'settings',
        'weekly_targets',
        'rate_limits',
        'entries',
        'images',
        'entry_images',
        'kudos',
        'comments',
        'notifications',
        'announcements',
        'audit_log',
        'presets',
        'plan_slots',
        'plan_totals',
      ])
        storage.sql.exec(`DELETE FROM ${table}`);
      migrate(storage);
      setSetting(storage, 'team_code', 'team-code');
    }),
  );
});
describe('fresh state after awaited request bodies', () => {
  it('does not let an in-flight staff PATCH demote a newly promoted admin', async () => {
    const cox = await user('Cox', 'coxswain');
    const athlete = await user('Athlete');
    await sql(async (storage) => {
      const held = delayed(storage, cox, { id: athlete.user.id });
      const pending = admin.patchUser(held.ctx);
      storage.sql.exec('UPDATE users SET role=? WHERE id=?', 'admin', athlete.user.id);
      held.send({ role: 'rower' });
      await expect(pending).rejects.toMatchObject({ status: 403 });
      expect(byId(storage, athlete.user.id).role).toBe('admin');
      expect(storage.sql.exec('SELECT * FROM audit_log').toArray()).toHaveLength(0);
    });
  });
  it('preserves concurrent unsupplied user fields and rechecks the last active admin', async () => {
    const owner = await user('Owner', 'admin');
    const other = await user('Other', 'admin');
    const athlete = await user('Athlete');
    await sql(async (storage) => {
      const held = delayed(storage, owner, { id: athlete.user.id });
      const pending = admin.patchUser(held.ctx);
      storage.sql.exec(
        'UPDATE users SET role=?,group_key=?,on_leaderboard=? WHERE id=?',
        'coach',
        'u23',
        0,
        athlete.user.id,
      );
      held.send({ active: false });
      expect((await pending).status).toBe(200);
      expect(byId(storage, athlete.user.id)).toMatchObject({
        role: 'coach',
        group_key: 'u23',
        on_leaderboard: 0,
        active: 0,
      });
      const demotion = delayed(storage, owner, { id: owner.user.id });
      const forbidden = admin.patchUser(demotion.ctx);
      storage.sql.exec('UPDATE users SET active=0 WHERE id=?', other.user.id);
      demotion.send({ role: 'rower' });
      await expect(forbidden).rejects.toMatchObject({ status: 409 });
      expect(byId(storage, owner.user.id).role).toBe('admin');
    });
  });
  it('never resurrects a deleted entry and uses the latest entry snapshot for partial edits', async () => {
    const athlete = await user('Athlete');
    const entry = await (await api('/entries', athlete, 'POST', entryBody)).json<EntryDetail>();
    await sql(async (storage) => {
      const held = delayed(storage, athlete, { id: entry.id });
      const pending = entries.patch(held.ctx);
      storage.sql.exec(
        'UPDATE entries SET distance_m=?,equiv_m=?,notes=? WHERE id=?',
        20000,
        20000,
        'Concurrent edit',
        entry.id,
      );
      held.send({ title: 'New title' });
      expect((await pending).status).toBe(200);
      const current = storage.sql.exec('SELECT * FROM entries WHERE id=?', entry.id).one();
      expect(current).toMatchObject({
        distance_m: 20000,
        equiv_m: 20000,
        notes: 'Concurrent edit',
        title: 'New title',
      });
      const deleted = delayed(storage, athlete, { id: entry.id });
      const update = entries.patch(deleted.ctx);
      deleteEntry(storage, entry.id);
      deleted.send({ title: 'Zombie' });
      await expect(update).rejects.toMatchObject({ status: 404 });
      expect(storage.sql.exec('SELECT * FROM entries WHERE id=?', entry.id).toArray()).toHaveLength(
        0,
      );
      expect(() => saveEntry(storage, entry, undefined, true)).toThrow('Entry not found.');
    });
  });
  it('reloads social visibility after the comment body arrives', async () => {
    const athlete = await user('Athlete');
    const other = await user('Other');
    const entry = await (await api('/entries', athlete, 'POST', entryBody)).json<EntryDetail>();
    await sql(async (storage) => {
      const held = delayed(storage, other, { id: entry.id });
      const pending = social.comment(held.ctx);
      storage.sql.exec('UPDATE entries SET visibility=? WHERE id=?', 'private', entry.id);
      held.send({ body: 'Not public anymore' });
      await expect(pending).rejects.toMatchObject({ status: 404 });
      expect(storage.sql.exec('SELECT * FROM comments').toArray()).toHaveLength(0);
      expect(storage.sql.exec('SELECT * FROM notifications').toArray()).toHaveLength(0);
    });
  });
  it.each(['announcement', 'preset'] as const)(
    'does not resurrect deleted %s records',
    async (kind) => {
      const owner = await user('Owner', 'admin');
      const path = kind === 'announcement' ? '/announcements' : '/admin/presets';
      const body =
        kind === 'announcement'
          ? { title: 'Title', body: 'Body', pinned: false }
          : { name: 'Preset', modality: 'erg', zone: 'E', distance_m: 1000, sort: 0, active: true };
      const response = await api(path, owner, 'POST', body);
      expect(response.status).toBe(201);
      const row = await response.json<Announcement | Preset>();
      await sql(async (storage) => {
        const table = kind === 'announcement' ? 'announcements' : 'presets';
        const handler = kind === 'announcement' ? announcements.patch : admin.patchPreset;
        const held = delayed(storage, owner, { id: row.id });
        const pending = handler(held.ctx);
        storage.sql.exec(`DELETE FROM ${table} WHERE id=?`, row.id);
        held.send(kind === 'announcement' ? { title: 'Zombie' } : { name: 'Zombie' });
        await expect(pending).rejects.toMatchObject({ status: 404 });
        expect(
          storage.sql.exec(`SELECT * FROM ${table} WHERE id=?`, row.id).toArray(),
        ).toHaveLength(0);
        expect(storage.sql.exec('SELECT * FROM audit_log').toArray()).toHaveLength(1);
      });
    },
  );
  const staffHandlers: [string, (ctx: Context) => Promise<Response>, unknown][] = [
    ['user PATCH', admin.patchUser, { role: 'coach' }],
    ['settings PATCH', admin.patchSettings, { team_code: 'changed-code' }],
    [
      'preset POST',
      admin.createPreset,
      { name: 'New', modality: 'erg', zone: 'E', distance_m: null, sort: 0, active: true },
    ],
    ['preset PATCH', admin.patchPreset, { name: 'Changed' }],
    ['announcement POST', announcements.create, { title: 'Title', body: 'Body', pinned: false }],
    ['announcement PATCH', announcements.patch, { title: 'Changed' }],
    ['plan PUT', plan.put, { slots: [], totals: [] }],
    [
      'plan POST',
      plan.post,
      { group_key: 'normal', week: 1, day: 0, slot: 'AM', kind: 'off', zone: null, text: '' },
    ],
  ];
  it.each(staffHandlers)(
    '%s rejects an actor demoted while parsing',
    async (_name, handler, body) => {
      const cox = await user('Cox', 'coxswain');
      const athlete = await user('Athlete');
      let id = athlete.user.id;
      if (handler === announcements.patch || handler === admin.patchPreset) {
        const response =
          handler === announcements.patch
            ? await api('/announcements', cox, 'POST', {
                title: 'Original',
                body: 'Body',
                pinned: false,
              })
            : await api('/admin/presets', cox, 'POST', {
                name: 'Original',
                modality: 'erg',
                zone: 'E',
                distance_m: 1000,
                sort: 0,
                active: true,
              });
        expect(response.status).toBe(201);
        id = (await response.json<{ id: string }>()).id;
      }
      await sql(async (storage) => {
        const count = storage.sql.exec('SELECT * FROM audit_log').toArray().length;
        const held = delayed(storage, cox, { id });
        const pending = handler(held.ctx);
        storage.sql.exec('UPDATE users SET role=? WHERE id=?', 'rower', cox.user.id);
        held.send(body);
        await expect(pending).rejects.toMatchObject({ status: 403 });
        expect(storage.sql.exec('SELECT * FROM audit_log').toArray()).toHaveLength(count);
      });
    },
  );
  const png = Uint8Array.from([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1,
  ]);
  const memberHandlers: [string, (ctx: Context) => Promise<Response>, unknown, string?][] = [
    ['entry POST', entries.create, entryBody],
    ['target PUT', me.putTarget, { target_m: 80000 }],
    ['profile PATCH', me.patch, { name: 'Not allowed' }],
    ['notifications read', notifications.read, { ids: [] }],
    ['comment POST', social.comment, { body: 'Not allowed' }],
    ['image POST', images.create, png, 'image/png'],
  ];
  it.each(memberHandlers)(
    '%s rejects a session revoked while reading its body',
    async (_name, handler, body, mime) => {
      const athlete = await user('Athlete');
      await sql(async (storage) => {
        const held = delayed(storage, athlete, { id: 'missing' }, mime);
        const pending = handler(held.ctx);
        storage.sql.exec('DELETE FROM sessions WHERE user_id=?', athlete.user.id);
        held.send(body);
        await expect(pending).rejects.toMatchObject({ status: 401 });
        for (const table of ['entries', 'images', 'comments', 'weekly_targets'])
          expect(storage.sql.exec(`SELECT * FROM ${table}`).toArray()).toHaveLength(0);
        expect(byId(storage, athlete.user.id).name).toBe('Athlete');
      });
    },
  );
  it('fresh guards reject a previously authenticated session after revocation', async () => {
    const cox = await user('Cox', 'coxswain');
    await sql((storage) => {
      const ctx = context(storage, cox);
      storage.sql.exec('DELETE FROM sessions WHERE user_id=?', cox.user.id);
      expect(() => requireStaff(ctx)).toThrow('Please log in.');
    });
  });
});
describe('credential and session commit races', () => {
  it('rejects a password request whose body completes after staff reset', async () => {
    const owner = await user('Owner', 'admin');
    const athlete = await user('Athlete');
    await sql(async (storage) => {
      const held = delayed(storage, athlete);
      const pending = me.password(held.ctx);
      await admin.resetPassword(context(storage, owner, { id: athlete.user.id }));
      const reset = byId(storage, athlete.user.id);
      held.send({ current_password: 'password123', new_password: 'nextpassword123' });
      await expect(pending).rejects.toMatchObject({ status: 401 });
      expect(byId(storage, athlete.user.id)).toMatchObject({
        password_hash: reset.password_hash,
        must_change_password: 1,
      });
    });
  });
  it.each([1, 2])(
    'preserves a staff reset completed during password-change crypto stage %i',
    async (stage) => {
      const owner = await user('Owner', 'admin');
      const athlete = await user('Athlete');
      await sql(async (storage) => {
        const change = jsonContext(storage, athlete, {
          current_password: 'password123',
          new_password: 'nextpassword123',
        });
        let resetHash = '';
        await pausedCrypto(
          () => me.password(change),
          async () => {
            const reset = await admin.resetPassword(
              context(storage, owner, { id: athlete.user.id }),
            );
            expect(reset.status).toBe(200);
            resetHash = byId(storage, athlete.user.id).password_hash;
          },
          401,
          stage,
        );
        expect(byId(storage, athlete.user.id)).toMatchObject({
          password_hash: resetHash,
          must_change_password: 1,
        });
        expect(
          storage.sql.exec('SELECT * FROM sessions WHERE user_id=?', athlete.user.id).toArray(),
        ).toHaveLength(0);
      });
    },
  );
  it('compares credentials even if a concurrent change retained this session', async () => {
    const athlete = await user('Athlete');
    const replacement = await hashPassword('replacement123');
    await sql(async (storage) => {
      const ctx = jsonContext(storage, athlete, {
        current_password: 'password123',
        new_password: 'nextpassword123',
      });
      await pausedCrypto(
        () => me.password(ctx),
        () =>
          storage.sql.exec(
            'UPDATE users SET password_hash=?,password_salt=?,must_change_password=1 WHERE id=?',
            replacement.hash,
            replacement.salt,
            athlete.user.id,
          ),
        409,
        2,
      );
      expect(byId(storage, athlete.user.id)).toMatchObject({
        password_hash: replacement.hash,
        must_change_password: 1,
      });
    });
  });
  it('rejects a password change if the user becomes inactive during hashing', async () => {
    const athlete = await user('Athlete');
    await sql(async (storage) => {
      const before = byId(storage, athlete.user.id);
      await pausedCrypto(
        () =>
          me.password(
            jsonContext(storage, athlete, {
              current_password: 'password123',
              new_password: 'nextpassword123',
            }),
          ),
        () => storage.sql.exec('UPDATE users SET active=0 WHERE id=?', athlete.user.id),
        401,
        2,
      );
      expect(byId(storage, athlete.user.id).password_hash).toBe(before.password_hash);
    });
  });
  it.each(['reset', 'deactivate'] as const)(
    'does not create a login session after concurrent %s',
    async (action) => {
      const owner = await user('Owner', 'admin');
      const athlete = await user('Athlete');
      await sql(async (storage) => {
        storage.sql.exec('DELETE FROM sessions WHERE user_id=?', athlete.user.id);
        const ctx = jsonContext(storage, undefined, {
          email: athlete.user.email,
          password: 'password123',
        });
        await pausedCrypto(
          () => auth.login(ctx),
          async () => {
            if (action === 'reset')
              await admin.resetPassword(context(storage, owner, { id: athlete.user.id }));
            else storage.sql.exec('UPDATE users SET active=0 WHERE id=?', athlete.user.id);
          },
          action === 'reset' ? 409 : 403,
        );
        expect(
          storage.sql.exec('SELECT * FROM sessions WHERE user_id=?', athlete.user.id).toArray(),
        ).toHaveLength(0);
        expect(ctx.cookie).toBeUndefined();
      });
    },
  );
  it.each(['demote actor', 'promote target', 'delete target'] as const)(
    'rechecks reset authorization after hashing: %s',
    async (action) => {
      const cox = await user('Cox', 'coxswain');
      const athlete = await user('Athlete');
      await sql(async (storage) => {
        const before = byId(storage, athlete.user.id);
        const ctx = context(storage, cox, { id: athlete.user.id });
        await pausedCrypto(
          () => admin.resetPassword(ctx),
          () => {
            if (action === 'demote actor')
              storage.sql.exec('UPDATE users SET role=? WHERE id=?', 'rower', cox.user.id);
            else if (action === 'promote target')
              storage.sql.exec('UPDATE users SET role=? WHERE id=?', 'admin', athlete.user.id);
            else {
              storage.sql.exec(
                'UPDATE roster SET claimed_by_user_id=NULL WHERE claimed_by_user_id=?',
                athlete.user.id,
              );
              storage.sql.exec('DELETE FROM users WHERE id=?', athlete.user.id);
            }
          },
          action === 'delete target' ? 404 : 403,
        );
        if (action !== 'delete target')
          expect(byId(storage, athlete.user.id).password_hash).toBe(before.password_hash);
        expect(storage.sql.exec('SELECT * FROM audit_log').toArray()).toHaveLength(0);
      });
    },
  );
  it('does not commit a prepared session against replaced credentials or an inactive user', async () => {
    const athlete = await user('Athlete');
    const prepared = await prepareSession();
    await sql((storage) => {
      const ctx = context(storage, athlete);
      const before = byId(storage, athlete.user.id);
      storage.sql.exec('DELETE FROM sessions WHERE user_id=?', athlete.user.id);
      storage.sql.exec('UPDATE users SET password_hash=? WHERE id=?', 'changed', athlete.user.id);
      expect(() => createSession(ctx, before.id, prepared, before)).toThrow('Credentials changed.');
      storage.sql.exec('UPDATE users SET active=0 WHERE id=?', athlete.user.id);
      expect(() => createSession(ctx, before.id, prepared, before)).toThrow('Please log in.');
      expect(
        storage.sql.exec('SELECT * FROM sessions WHERE user_id=?', athlete.user.id).toArray(),
      ).toHaveLength(0);
    });
  });
  it('checks signup eligibility after session-token hashing, with no session-creation yield after claiming', async () => {
    const id = await sql((storage) => insertRosterFixture(storage, 'New athlete'));
    await sql(async (storage) => {
      const ctx = jsonContext(storage, undefined, {
        roster_id: id,
        email: 'new@example.com',
        team_code: 'team-code',
        password: 'password123',
      });
      const entered = latch();
      const release = latch();
      const original = crypto.subtle.digest.bind(crypto.subtle);
      const spy = vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (...args) => {
        const result = await original(...args);
        entered.resolve();
        await release.promise;
        return result;
      });
      try {
        const pending = auth.signup(ctx);
        const outcome = expect(pending).rejects.toMatchObject({ status: 404 });
        await entered.promise;
        storage.sql.exec('DELETE FROM roster WHERE id=?', id);
        release.resolve();
        await outcome;
        expect(
          storage.sql.exec('SELECT * FROM users WHERE email=?', 'new@example.com').toArray(),
        ).toHaveLength(0);
        expect(storage.sql.exec('SELECT * FROM sessions').toArray()).toHaveLength(0);
        expect(ctx.cookie).toBeUndefined();
      } finally {
        release.resolve();
        spy.mockRestore();
      }
    });
  });
});
