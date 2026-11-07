/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CommentWithAuthor,
  ContentReport,
  EntryDetail,
  Notification,
  Page,
  ReportTarget,
  Role,
} from '../../shared/types';
import type { Env } from './index';
import { sha256 } from './auth/crypto';
import { migrate } from './db/migrate';
import { getSetting, setSetting } from './db/settings';
import { reportDetails, type ReportRow } from './db/reports';

const bindings = env as unknown as Env;
const NOW = '2026-03-09T18:00:00.000Z';
const LATER = '2026-03-09T19:00:00.000Z';
type Client = { id: string; cookie: string };
function sql<T>(fn: (storage: DurableObjectStorage) => T) {
  return runInDurableObject(bindings.TEAM.get(bindings.TEAM.idFromName('stanford')), (_, state) =>
    fn(state.storage),
  );
}
function api(path: string, client?: Client, method = 'GET', body?: unknown, time = NOW) {
  return SELF.fetch('https://oyo.test/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-OYO-CSRF': '1',
      'X-OYO-Test-Now': time,
      ...(client ? { Cookie: client.cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function user(name: string, role: Role = 'rower'): Promise<Client> {
  const id = crypto.randomUUID();
  const token = crypto.randomUUID();
  const hash = await sha256(token);
  await sql((s) => {
    s.sql.exec(
      "INSERT INTO users (id,email,name,password_hash,password_salt,role,group_key,on_leaderboard,active,created_at,updated_at) VALUES (?,?,?,'unused','unused',?,'normal',1,1,?,?)",
      id,
      name.replaceAll(' ', '') + '@example.com',
      name,
      role,
      NOW,
      NOW,
    );
    s.sql.exec('INSERT INTO sessions VALUES (?,?,?,?)', hash, id, '2026-05-01T00:00:00.000Z', NOW);
  });
  return { id, cookie: 'oyo_session=' + token };
}
async function entry(owner: Client) {
  const response = await api('/entries', owner, 'POST', {
    date: '2026-03-09',
    modality: 'erg',
    zone: 'E',
    distance_m: 10000,
    title: 'Training',
    notes: 'Original notes',
  });
  expect(response.status).toBe(201);
  return response.json<EntryDetail>();
}
async function comment(owner: Client, entry: string, body = 'Original', mention_ids?: string[]) {
  const response = await api('/entries/' + entry + '/comments', owner, 'POST', {
    body,
    ...(mention_ids === undefined ? {} : { mention_ids }),
  });
  expect(response.status).toBe(201);
  return response.json<CommentWithAuthor>();
}
async function report(reporter: Client, target: ReportTarget, reason?: string) {
  const response = await api('/reports', reporter, 'POST', {
    ...target,
    ...(reason === undefined ? {} : { reason }),
  });
  expect(response.status).toBe(201);
  return (await response.json<{ id: string }>()).id;
}
async function queue(staff: Client, query = '') {
  const response = await api('/admin/reports' + query, staff);
  expect(response.status).toBe(200);
  return response.json<Page<ContentReport>>();
}
async function notifications(client: Client) {
  return (await api('/notifications', client)).json<Notification[]>();
}
beforeEach(async () => {
  await api('/health');
  await sql((s) => {
    for (const table of [
      'roster',
      'users',
      'sessions',
      'entries',
      'comments',
      'comment_mentions',
      'comment_mention_history',
      'entry_tags',
      'content_reports',
      'notifications',
      'audit_log',
      'images',
      'entry_images',
      'kudos',
    ])
      s.sql.exec(`DELETE FROM ${table}`);
  });
});

describe('comment edits', () => {
  it('requires the author even for staff, retains moderation deletion, and validates body/recipients', async () => {
    const owner = await user('Owner');
    const author = await user('Author');
    const staff = await user('Staff', 'coxswain');
    const logged = await entry(owner);
    const posted = await comment(author, logged.id);
    expect(posted.edited_at).toBeNull();
    for (const client of [owner, staff])
      expect(
        (await api('/comments/' + posted.id, client, 'PATCH', { body: 'Changed' })).status,
      ).toBe(403);
    expect(
      (await api('/comments/' + posted.id, undefined, 'PATCH', { body: 'Changed' })).status,
    ).toBe(401);
    expect((await api('/comments/missing', author, 'PATCH', { body: 'Changed' })).status).toBe(404);
    for (const body of [
      {},
      { body: ' ' },
      { body: 1 },
      { body: 'x'.repeat(1001) },
      { body: 'Valid', mention_ids: null },
      { body: 'Valid', mention_ids: ['missing'] },
    ]) {
      expect((await api('/comments/' + posted.id, author, 'PATCH', body)).status).toBe(400);
    }
    expect((await api('/comments/' + posted.id, staff, 'DELETE')).status).toBe(204);
    expect((await api('/comments/' + posted.id, author, 'PATCH', { body: 'Changed' })).status).toBe(
      404,
    );
  });

  it('preserves no-op timestamps, reparses omitted IDs, and only notifies new mentions once per comment', async () => {
    const owner = await user('Owner');
    const author = await user('Author');
    const ann = await user('Ann');
    const anna = await user('Anna');
    const logged = await entry(owner);
    const posted = await comment(author, logged.id, '@Ann', [ann.id]);
    const patch = async (body: unknown, time = LATER) => {
      const response = await api('/comments/' + posted.id, author, 'PATCH', body, time);
      expect(response.status).toBe(200);
      return response.json<CommentWithAuthor>();
    };
    expect((await patch({ body: ' @Ann ' })).edited_at).toBeNull();
    const changed = await patch({ body: '@Ann and training' });
    expect(changed).toMatchObject({ body: '@Ann and training', created_at: NOW, edited_at: LATER });
    expect(changed.mentions.map((u) => u.id)).toEqual([ann.id]);
    expect((await patch({ body: '@Ann and training' }, '2026-03-09T20:00:00.000Z')).edited_at).toBe(
      LATER,
    );
    expect((await patch({ body: '@Anna' })).mentions).toEqual([]);
    await patch({ body: '@Ann and @Anna!', mention_ids: [ann.id, anna.id, anna.id, author.id] });
    await patch({ body: 'Nobody', mention_ids: [] });
    await patch({ body: '@Ann and @Anna!', mention_ids: [ann.id, anna.id] });
    expect((await notifications(ann)).filter((n) => n.kind === 'mention')).toHaveLength(1);
    expect((await notifications(anna)).filter((n) => n.kind === 'mention')).toHaveLength(1);
    expect((await notifications(owner)).filter((n) => n.kind === 'comment')).toHaveLength(1);
    expect(await notifications(author)).toEqual([]);
    const list = await (
      await api('/entries/' + logged.id + '/comments', owner)
    ).json<CommentWithAuthor[]>();
    expect(list[0]).toMatchObject({ edited_at: LATER, body: '@Ann and @Anna!' });
    expect(JSON.stringify(list)).not.toMatch(/email|password|example.com/);
  });

  it('validates supplied active recipients and caps before body filtering; omitted inactive mentions do not block edits', async () => {
    const author = await user('Author');
    const mate = await user('Mate');
    const logged = await entry(author);
    const posted = await comment(author, logged.id, '@Mate', [mate.id]);
    await sql((s) => s.sql.exec('UPDATE users SET active=0 WHERE id=?', mate.id).toArray());
    const path = '/comments/' + posted.id;
    expect(
      (await api(path, author, 'PATCH', { body: '@Mate', mention_ids: [mate.id] })).status,
    ).toBe(400);
    const response = await api(path, author, 'PATCH', { body: '@Mate changed' });
    expect(response.status).toBe(200);
    expect((await response.json<CommentWithAuthor>()).mentions).toEqual([]);
    const ids = await Promise.all(Array.from({ length: 11 }, (_, i) => user('Mate' + i)));
    for (const mention_ids of ['bad', [1], ids.map((u) => u.id)])
      expect((await api(path, author, 'PATCH', { body: 'No names', mention_ids })).status).toBe(
        400,
      );
  });
});

describe('report privacy and queue', () => {
  it('deduplicates permanently without reason replacement/notifications and never exposes reports to rowers', async () => {
    const owner = await user('Owner');
    const reporter = await user('Reporter');
    const cox = await user('Cox', 'coxswain');
    const coach = await user('Coach', 'coach');
    const admin = await user('Admin', 'admin');
    const inactive = await user('Inactive', 'coxswain');
    await sql((s) => s.sql.exec('UPDATE users SET active=0 WHERE id=?', inactive.id).toArray());
    const logged = await entry(owner);
    const target: ReportTarget = { target_type: 'entry', target_id: logged.id };
    const id = await report(reporter, target, '  Please review  ');
    const duplicate = await api('/reports', reporter, 'POST', { ...target, reason: 'Replacement' });
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toEqual({ id });
    for (const staff of [cox, coach, admin]) {
      expect((await notifications(staff)).filter((n) => n.kind === 'report')).toMatchObject([
        { actor_id: reporter.id, entry_id: logged.id, actor: { id: reporter.id } },
      ]);
      expect((await queue(staff)).items[0]).toMatchObject({
        id,
        reason: 'Please review',
        reporter: { id: reporter.id },
        status: 'open',
        reviewed_at: null,
        reviewed_by: null,
        content: { author: { id: owner.id }, title: 'Training', body: 'Original notes' },
      });
    }
    for (const client of [owner, reporter]) {
      expect(await notifications(client)).toEqual([]);
      expect((await api('/admin/reports', client)).status).toBe(403);
      expect(
        (await api('/admin/reports/' + id, client, 'PATCH', { action: 'delete' })).status,
      ).toBe(403);
      expect(JSON.stringify(await (await api('/entries/' + logged.id, client)).json())).not.toMatch(
        /reporter|Please review|content_reports/,
      );
    }
    expect((await api('/admin/reports')).status).toBe(401);
    expect(
      (await api('/admin/reports/' + id, undefined, 'PATCH', { action: 'dismiss' })).status,
    ).toBe(401);
    expect((await api('/reports', undefined, 'POST', target)).status).toBe(401);
    expect(JSON.stringify(await queue(cox))).not.toMatch(/email|password|example.com|reporter_id/);
    expect((await api('/entries/' + logged.id, owner, 'DELETE')).status).toBe(204);
    const after = await api('/reports', reporter, 'POST', target);
    expect(after.status).toBe(200);
    expect(await after.json()).toEqual({ id });
    expect((await queue(cox, '?status=deleted')).items[0]).toMatchObject({ id, content: null });
    expect((await notifications(cox)).filter((n) => n.kind === 'report')).toHaveLength(1);
    expect((await api('/reports', owner, 'POST', target)).status).toBe(404);
  });

  it('filters report notifications for demoted staff before the read limit and honors deactivation', async () => {
    const owner = await user('Owner');
    const cox = await user('Cox', 'coxswain');
    const logged = await entry(owner);
    await report(owner, { target_type: 'entry', target_id: logged.id });
    const note = (await notifications(cox))[0];
    await sql((s) => {
      for (let i = 0; i < 105; i++)
        s.sql.exec(
          "INSERT INTO notifications VALUES (?,?, 'report',?,?,?,NULL)",
          crypto.randomUUID(),
          cox.id,
          owner.id,
          logged.id,
          LATER,
        );
      s.sql.exec(
        "INSERT INTO notifications VALUES (?,?, 'comment',?,?,?,NULL)",
        crypto.randomUUID(),
        cox.id,
        owner.id,
        logged.id,
        NOW,
      );
      s.sql.exec("UPDATE users SET role='rower' WHERE id=?", cox.id);
    });
    const notes = await notifications(cox);
    expect(notes).toHaveLength(1);
    expect(notes[0].kind).toBe('comment');
    expect(JSON.stringify(notes)).not.toContain(note.id);
    expect((await api('/admin/reports', cox)).status).toBe(403);
    await api('/notifications/read', cox, 'POST', { ids: [note.id] });
    expect((await notifications(cox)).some((n) => n.kind === 'report')).toBe(false);
    await sql((s) => s.sql.exec('UPDATE users SET active=0 WHERE id=?', cox.id).toArray());
    expect((await api('/notifications', cox)).status).toBe(401);
    expect((await api('/admin/reports', cox)).status).toBe(401);
  });

  it('validates targets and trimmed reason limits, and hydrates live comment/entry changes', async () => {
    const owner = await user('Owner');
    const staff = await user('Staff', 'coach');
    const logged = await entry(owner);
    const posted = await comment(owner, logged.id);
    for (const body of [
      {},
      { target_type: 'bad', target_id: logged.id },
      { target_type: 'entry', target_id: 1 },
      { target_type: 'entry', target_id: logged.id, reason: null },
      { target_type: 'entry', target_id: logged.id, reason: 'x'.repeat(301) },
    ])
      expect((await api('/reports', owner, 'POST', body)).status).toBe(400);
    for (const target_type of ['entry', 'comment'])
      expect(
        (await api('/reports', owner, 'POST', { target_type, target_id: 'missing' })).status,
      ).toBe(404);
    const entryReport = await report(
      owner,
      { target_type: 'entry', target_id: logged.id },
      ' ' + 'x'.repeat(300) + ' ',
    );
    const commentReport = await report(owner, { target_type: 'comment', target_id: posted.id });
    await api('/entries/' + logged.id, owner, 'PATCH', {
      title: 'Updated',
      notes: 'Updated notes',
    });
    await api('/comments/' + posted.id, owner, 'PATCH', { body: 'Updated comment' });
    const items = (await queue(staff)).items;
    expect(items.find((r) => r.id === entryReport)).toMatchObject({
      reason: 'x'.repeat(300),
      content: { title: 'Updated', body: 'Updated notes' },
    });
    expect(items.find((r) => r.id === commentReport)).toMatchObject({
      reason: '',
      entry_id: logged.id,
      content: { title: null, body: 'Updated comment' },
    });
    expect(
      (await api('/admin/reports/missing', staff, 'PATCH', { action: 'dismiss' })).status,
    ).toBe(404);
    for (const action of [null, 'bad', 1])
      expect((await api('/admin/reports/' + entryReport, staff, 'PATCH', { action })).status).toBe(
        400,
      );
  });

  it('paginates tied timestamps, validates cursors/status and bounds hydration to batched queries', async () => {
    const owner = await user('Owner');
    const staff = await user('Staff', 'coxswain');
    const logged = await entry(owner);
    const ids = await sql((s) => {
      const ids: string[] = [];
      for (let i = 0; i < 52; i++) {
        const id = crypto.randomUUID();
        const target = crypto.randomUUID();
        s.sql.exec(
          'INSERT INTO comments (id,entry_id,user_id,body,created_at) VALUES (?,?,?,?,?)',
          target,
          logged.id,
          owner.id,
          'Comment ' + i,
          NOW,
        );
        s.sql.exec(
          "INSERT INTO content_reports VALUES (?,'comment',?,?,?,'','open',?,NULL,NULL)",
          id,
          target,
          logged.id,
          owner.id,
          NOW,
        );
        ids.push(id);
      }
      return ids.sort().reverse();
    });
    const first = await queue(staff);
    expect(first.items.map((r) => r.id)).toEqual(ids.slice(0, 50));
    expect(first.next_cursor).not.toBeNull();
    const second = await queue(staff, '?cursor=' + first.next_cursor);
    expect(second.items.map((r) => r.id)).toEqual(ids.slice(50));
    expect(second.next_cursor).toBeNull();
    for (const query of [
      '?status=bad',
      '?status=',
      '?cursor=',
      '?cursor=bad',
      '?cursor=***',
      '?cursor=' + btoa(JSON.stringify(['bad', ids[0]])),
      '?cursor=' + btoa(JSON.stringify([NOW, 'bad'])),
    ])
      expect((await api('/admin/reports' + query, staff)).status).toBe(400);
    expect((await queue(staff, '?status=dismissed')).items).toEqual([]);
    await sql((s) => {
      const rows = s.sql.exec<ReportRow>('SELECT * FROM content_reports').toArray();
      const spy = vi.spyOn(s.sql, 'exec');
      expect(reportDetails(s, rows).every((r) => r.content !== null)).toBe(true);
      expect(spy).toHaveBeenCalledTimes(3);
      spy.mockRestore();
      expect(
        s.sql
          .exec(
            'EXPLAIN QUERY PLAN SELECT * FROM content_reports WHERE status=? ORDER BY created_at DESC,id DESC LIMIT 51',
            'open',
          )
          .toArray()
          .map((r) => r.detail)
          .join(' '),
      ).toContain('content_reports_queue');
    });
  });
});

describe('report moderation', () => {
  it('dismisses once, conflicts on a different repeated review and preserves content', async () => {
    const owner = await user('Owner');
    const staff = await user('Staff', 'coxswain');
    const logged = await entry(owner);
    const id = await report(owner, { target_type: 'entry', target_id: logged.id });
    const path = '/admin/reports/' + id;
    const response = await api(path, staff, 'PATCH', { action: 'dismiss' }, LATER);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id,
      status: 'dismissed',
      reviewed_at: LATER,
      reviewed_by: staff.id,
    });
    expect((await api(path, staff, 'PATCH', { action: 'dismiss' })).status).toBe(200);
    expect((await api(path, staff, 'PATCH', { action: 'delete' })).status).toBe(409);
    expect((await api('/entries/' + logged.id, owner)).status).toBe(200);
    expect((await queue(staff)).items).toEqual([]);
    expect((await queue(staff, '?status=dismissed')).items).toHaveLength(1);
    await sql((s) =>
      expect(s.sql.exec('SELECT action FROM audit_log').toArray()).toEqual([
        { action: 'report.dismiss' },
      ]),
    );
  });

  it('deletes a comment and closes sibling reports but leaves its entry and unrelated reports', async () => {
    const owner = await user('Owner');
    const reporter = await user('Reporter');
    const staff = await user('Staff', 'coach');
    const logged = await entry(owner);
    const posted = await comment(owner, logged.id, '@Reporter', [reporter.id]);
    const target: ReportTarget = { target_type: 'comment', target_id: posted.id };
    const id = await report(owner, target);
    const sibling = await report(reporter, target);
    const unrelated = await report(owner, { target_type: 'entry', target_id: logged.id });
    const response = await api('/admin/reports/' + id, staff, 'PATCH', { action: 'delete' }, LATER);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id,
      content: null,
      status: 'deleted',
      reviewed_by: staff.id,
      reviewed_at: LATER,
    });
    expect((await queue(staff, '?status=deleted')).items.map((r) => r.id).sort()).toEqual(
      [id, sibling].sort(),
    );
    expect((await queue(staff)).items.map((r) => r.id)).toEqual([unrelated]);
    expect((await api('/entries/' + logged.id, owner)).status).toBe(200);
    expect(
      (await api('/admin/reports/' + sibling, staff, 'PATCH', { action: 'delete' })).status,
    ).toBe(200);
    expect((await api('/admin/reports/' + id, staff, 'PATCH', { action: 'dismiss' })).status).toBe(
      409,
    );
    await sql((s) => {
      for (const table of ['comments', 'comment_mentions', 'comment_mention_history'])
        expect(s.sql.exec(`SELECT * FROM ${table}`).toArray()).toEqual([]);
      expect(s.sql.exec('SELECT action FROM audit_log ORDER BY action').toArray()).toEqual([
        { action: 'comment.delete' },
        { action: 'report.delete' },
      ]);
    });
  });

  it('atomically removes entries/images/joins, closes child reports, preserves reviewed rows, and rolls back on audit failure', async () => {
    const owner = await user('Owner');
    const reporter = await user('Reporter');
    const staff = await user('Staff', 'admin');
    const logged = await entry(owner);
    const posted = await comment(owner, logged.id, '@Reporter', [reporter.id]);
    const target: ReportTarget = { target_type: 'entry', target_id: logged.id };
    const id = await report(owner, target);
    const sibling = await report(reporter, target);
    const child = await report(reporter, { target_type: 'comment', target_id: posted.id });
    const dismissed = await report(owner, { target_type: 'comment', target_id: posted.id });
    await api('/admin/reports/' + dismissed, staff, 'PATCH', { action: 'dismiss' });
    await sql((s) => {
      s.sql.exec(
        'INSERT INTO images VALUES (?,?,?,?,?,?,?)',
        'image',
        owner.id,
        'image/png',
        1,
        1,
        new ArrayBuffer(1),
        NOW,
      );
      s.sql.exec('INSERT INTO entry_images VALUES (?,?,0)', logged.id, 'image');
      s.sql.exec('INSERT INTO entry_tags VALUES (?,?,?)', logged.id, reporter.id, NOW);
      s.sql.exec('INSERT INTO kudos VALUES (?,?,?)', logged.id, reporter.id, NOW);
      s.sql.exec(
        "CREATE TRIGGER fail_report_audit BEFORE INSERT ON audit_log WHEN NEW.action='report.delete' BEGIN SELECT RAISE(ABORT,'test failure'); END",
      );
    });
    try {
      expect(
        (await api('/admin/reports/' + id, staff, 'PATCH', { action: 'delete' }, LATER)).status,
      ).toBe(500);
      expect((await api('/entries/' + logged.id, owner)).status).toBe(200);
      expect((await queue(staff)).items).toHaveLength(3);
      await sql((s) => {
        expect(s.sql.exec('SELECT * FROM images').toArray()).toHaveLength(1);
        expect(s.sql.exec("SELECT * FROM audit_log WHERE action='entry.delete'").toArray()).toEqual(
          [],
        );
      });
    } finally {
      await sql((s) => s.sql.exec('DROP TRIGGER fail_report_audit').toArray());
    }
    expect(
      (await api('/admin/reports/' + id, staff, 'PATCH', { action: 'delete' }, LATER)).status,
    ).toBe(200);
    expect((await api('/entries/' + logged.id, owner)).status).toBe(404);
    const deleted = (await queue(staff, '?status=deleted')).items;
    expect(deleted.map((r) => r.id).sort()).toEqual([id, sibling, child].sort());
    expect(deleted.every((r) => r.content === null && r.reviewed_by === staff.id)).toBe(true);
    expect((await queue(staff, '?status=dismissed')).items[0]).toMatchObject({
      id: dismissed,
      status: 'dismissed',
      content: null,
    });
    await sql((s) => {
      for (const table of [
        'entries',
        'images',
        'entry_images',
        'entry_tags',
        'kudos',
        'comments',
        'comment_mentions',
        'comment_mention_history',
      ])
        expect(s.sql.exec(`SELECT * FROM ${table}`).toArray()).toEqual([]);
      expect(s.sql.exec('SELECT action FROM audit_log ORDER BY action').toArray()).toEqual([
        { action: 'entry.delete' },
        { action: 'report.delete' },
        { action: 'report.dismiss' },
      ]);
    });
  });

  it('handles already absent targets and direct author/staff removal without losing reports', async () => {
    const owner = await user('Owner');
    const staff = await user('Staff', 'coxswain');
    for (const type of ['entry', 'comment'] as const) {
      const logged = await entry(owner);
      const posted = await comment(owner, logged.id);
      const target: ReportTarget = {
        target_type: type,
        target_id: type === 'entry' ? logged.id : posted.id,
      };
      const id = await report(owner, target);
      await sql((s) =>
        s.sql
          .exec(
            `DELETE FROM ${type === 'entry' ? 'entries' : 'comments'} WHERE id=?`,
            target.target_id,
          )
          .toArray(),
      );
      const response = await api('/admin/reports/' + id, staff, 'PATCH', { action: 'delete' });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ id, content: null, status: 'deleted' });
    }
    for (const deleter of [owner, staff]) {
      const logged = await entry(owner);
      const posted = await comment(owner, logged.id);
      const id = await report(owner, { target_type: 'comment', target_id: posted.id });
      expect((await api('/comments/' + posted.id, deleter, 'DELETE')).status).toBe(204);
      expect((await queue(staff, '?status=deleted')).items.find((r) => r.id === id)).toMatchObject({
        reviewed_by: deleter.id,
        content: null,
      });
    }
  });
});

describe('schema v11', () => {
  it('migrates a fresh database and remains idempotent', async () => {
    const stub = bindings.TEAM.get(bindings.TEAM.idFromName(crypto.randomUUID()));
    await runInDurableObject(stub, (_, state) => {
      expect(getSetting(state.storage, 'schema_version')).toBe(11);
      for (const table of ['erg_tests', 'challenges', 'content_reports', 'comment_mention_history'])
        expect(
          state.storage.sql
            .exec('SELECT name FROM sqlite_master WHERE type=? AND name=?', 'table', table)
            .toArray(),
        ).toHaveLength(1);
      migrate(state.storage);
      migrate(state.storage);
      expect(
        state.storage.sql
          .exec('PRAGMA table_info(comments)')
          .toArray()
          .filter((c) => c.name === 'edited_at'),
      ).toHaveLength(1);
      expect(state.storage.sql.exec('SELECT * FROM content_reports').toArray()).toEqual([]);
      expect(state.storage.sql.exec('SELECT * FROM comment_mention_history').toArray()).toEqual([]);
    });
  });

  it('upgrades real v9 tables, backfills history, preserves body/times/reports, and upgrades v10 without rerunning lower migrations', async () => {
    const owner = await user('Owner');
    const mate = await user('Mate');
    const logged = await entry(owner);
    const posted = await comment(owner, logged.id, '@Mate', [mate.id]);
    await sql((s) => {
      s.sql.exec('DROP TABLE content_reports');
      s.sql.exec('DROP TABLE comment_mention_history');
      s.sql.exec('ALTER TABLE comments DROP COLUMN edited_at');
      setSetting(s, 'schema_version', 9);
      migrate(s);
      expect(getSetting(s, 'schema_version')).toBe(11);
      expect(
        s.sql.exec('SELECT body,created_at,edited_at FROM comments WHERE id=?', posted.id).one(),
      ).toEqual({ body: '@Mate', created_at: NOW, edited_at: null });
      expect(s.sql.exec('SELECT * FROM comment_mention_history').toArray()).toEqual([
        { comment_id: posted.id, entry_id: logged.id, user_id: mate.id },
      ]);
      migrate(s);
      expect(s.sql.exec('SELECT * FROM comment_mention_history').toArray()).toHaveLength(1);
    });
    await api('/comments/' + posted.id, owner, 'PATCH', { body: 'Removed' });
    await api(
      '/comments/' + posted.id,
      owner,
      'PATCH',
      { body: '@Mate', mention_ids: [mate.id] },
      LATER,
    );
    expect((await notifications(mate)).filter((n) => n.kind === 'mention')).toHaveLength(1);
    const id = await report(mate, { target_type: 'entry', target_id: logged.id });
    await sql((s) => {
      for (const version of [9, 10]) {
        setSetting(s, 'schema_version', version);
        migrate(s);
        expect(getSetting(s, 'schema_version')).toBe(11);
        expect(s.sql.exec('SELECT id FROM content_reports').one().id).toBe(id);
        expect(
          s.sql.exec('SELECT edited_at FROM comments WHERE id=?', posted.id).one().edited_at,
        ).toBe(LATER);
      }
    });
    expect(await (await api('/health')).json()).toEqual({ ok: true, schema_version: 11 });
  });
});
