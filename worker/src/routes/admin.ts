import type { Context } from '../context';
import type { Preset, RosterRow, Settings } from '../../../shared/types';
import { today, weekStart } from '../../../shared/dates';
import { ZONES } from '../../../shared/math';
import { refreshUser, requireAdmin, requireStaff } from '../auth/guards';
import { hashPassword, temporaryPassword } from '../auth/crypto';
import { byId, toUser, type UserRow } from '../db/users';
import { findRoster, rosterById, rosterByName } from '../db/roster';
import { getSettings, setSetting, setGroupTargets } from '../db/settings';
import { audit, auditPage } from '../db/audit';
import { presets, savePreset } from '../db/presets';
import { exportEntries, recalculate } from '../db/admin';
import { leaderboard } from '../db/stats';
import { parseCsv } from '../csv';
import { HttpError, json, noContent, readJson } from '../http';
import * as v from '../validate';
const roles = ['rower', 'coxswain', 'coach', 'admin'] as const;
const groups = ['frosh', 'normal', 'u23'] as const;
const sides = ['port', 'starboard', 'both', 'cox'] as const;
function missing(): never {
  throw new HttpError(404, 'NOT_FOUND', 'Record not found.');
}
function conflict(message: string): never {
  throw new HttpError(409, 'CONFLICT', message);
}
export function users(ctx: Context) {
  requireStaff(ctx);
  return json(
    ctx.storage.sql.exec<UserRow>('SELECT * FROM users ORDER BY name,id').toArray().map(toUser),
  );
}
export async function patchUser(ctx: Context) {
  requireStaff(ctx);
  const before = byId(ctx.storage, ctx.params.id);
  if (!before) missing();
  const body = await readJson(ctx.request);
  const role = body.role === undefined ? before.role : v.enumeration(body.role, roles, 'Role');
  const group =
    body.group_key === undefined
      ? before.group_key
      : v.enumeration(body.group_key, groups, 'Group');
  const active = body.active === undefined ? !!before.active : v.boolean(body.active, 'Active');
  const onLeaderboard =
    body.on_leaderboard === undefined
      ? !!before.on_leaderboard
      : v.boolean(body.on_leaderboard, 'On leaderboard');
  if (
    (body.role !== undefined && role === 'admin') ||
    (before.role === 'admin' &&
      ['role', 'active', 'group_key'].some((key) => body[key] !== undefined))
  )
    requireAdmin(ctx);
  if (
    before.role === 'admin' &&
    before.active &&
    (role !== 'admin' || !active) &&
    ctx.storage.sql
      .exec<{ count: number }>(
        'SELECT COUNT(*) AS count FROM users WHERE role = ? AND active = ?',
        'admin',
        1,
      )
      .one().count <= 1
  )
    conflict('The last active admin cannot be demoted or deactivated.');
  ctx.storage.transactionSync(() => {
    ctx.storage.sql.exec(
      'UPDATE users SET role = ?,group_key = ?,active = ?,on_leaderboard = ?,updated_at = ? WHERE id = ?',
      role,
      group,
      Number(active),
      Number(onLeaderboard),
      ctx.now.toISOString(),
      before.id,
    );
    if (!active) ctx.storage.sql.exec('DELETE FROM sessions WHERE user_id = ?', before.id);
    audit(ctx, 'user.update', before.id, toUser(before), toUser(byId(ctx.storage, before.id)));
  });
  return json(toUser(byId(ctx.storage, before.id)));
}
export async function resetPassword(ctx: Context) {
  requireStaff(ctx);
  const user = byId(ctx.storage, ctx.params.id);
  if (!user) missing();
  if (user.role === 'admin') requireAdmin(ctx);
  const password = temporaryPassword();
  const { hash, salt } = await hashPassword(password);
  // Recheck the role after asynchronous hashing.
  const current = byId(ctx.storage, user.id);
  if (!current) missing();
  if (current.role === 'admin') requireAdmin(ctx);
  ctx.storage.transactionSync(() => {
    ctx.storage.sql.exec(
      'UPDATE users SET password_hash = ?,password_salt = ?,must_change_password = ?,updated_at = ? WHERE id = ?',
      hash,
      salt,
      1,
      ctx.now.toISOString(),
      user.id,
    );
    ctx.storage.sql.exec('DELETE FROM sessions WHERE user_id = ?', user.id);
    audit(
      ctx,
      'user.reset-password',
      user.id,
      { must_change_password: !!current.must_change_password },
      { must_change_password: true },
    );
  });
  return json({ temporary_password: password });
}
function rosterInput(body: Record<string, unknown>, before?: RosterRow) {
  const value: Record<string, unknown> = { ...before, ...body };
  return {
    name: v.string(value.name, 'Name', 1, 80, true),
    email: value.email == null ? null : v.email(value.email),
    role: v.enumeration(value.role, roles, 'Role'),
    group_key: value.group_key == null ? null : v.enumeration(value.group_key, groups, 'Group'),
    side: v.nullable(value.side ?? null, (x) => v.enumeration(x, sides, 'Side')),
    class_year: v.nullable(value.class_year ?? null, (x) => v.int(x, 'Class year', 1950, 2100)),
  };
}
function rosterPermission(ctx: Context, role: string, before?: RosterRow) {
  if (role === 'admin' || before?.role === 'admin') requireAdmin(ctx);
}
function writeRoster(ctx: Context, row: RosterRow) {
  ctx.storage.sql.exec(
    'INSERT OR REPLACE INTO roster (id,name,email,role,group_key,side,class_year,claimed_by_user_id,added_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    row.id,
    row.name,
    row.email,
    row.role,
    row.group_key,
    row.side,
    row.class_year,
    row.claimed_by_user_id,
    row.added_by,
    row.created_at,
  );
}
export function roster(ctx: Context) {
  requireStaff(ctx);
  return json(ctx.storage.sql.exec('SELECT * FROM roster ORDER BY name,email').toArray());
}
function saveRoster(
  ctx: Context,
  body: Record<string, unknown>,
  before: RosterRow | undefined,
  action: string,
) {
  refreshUser(ctx);
  const actor = requireStaff(ctx);
  if (before) rosterPermission(ctx, before.role, before);
  const linked = before?.claimed_by_user_id
    ? byId(ctx.storage, before.claimed_by_user_id)
    : undefined;
  if (linked?.role === 'admin') requireAdmin(ctx);
  const input = rosterInput(body, before);
  rosterPermission(ctx, input.role, before);
  const duplicateName = rosterByName(ctx.storage, input.name);
  if (duplicateName && duplicateName.id !== before?.id)
    conflict('This name is already on the roster.');
  const duplicateEmail = input.email ? findRoster(ctx.storage, input.email) : undefined;
  if (duplicateEmail && duplicateEmail.id !== before?.id)
    conflict('This email is already on the roster.');
  if (linked?.role === 'admin') {
    if (
      linked.active &&
      body.role !== undefined &&
      input.role !== 'admin' &&
      ctx.storage.sql
        .exec<{ count: number }>(
          'SELECT COUNT(*) AS count FROM users WHERE role = ? AND active = ?',
          'admin',
          1,
        )
        .one().count <= 1
    )
      conflict('The last active admin cannot be demoted or deactivated.');
  }
  const row = {
    ...input,
    id: before?.id ?? crypto.randomUUID(),
    claimed_by_user_id: before?.claimed_by_user_id ?? null,
    added_by: before ? before.added_by : actor.id,
    created_at: before?.created_at ?? ctx.now.toISOString(),
  };
  writeRoster(ctx, row);
  if (linked) {
    const fields: Record<string, string | number | null> = {};
    for (const key of ['name', 'role', 'side', 'class_year'] as const)
      if (body[key] !== undefined) fields[key] = input[key];
    if (body.group_key !== undefined) fields.group_key = input.group_key ?? 'normal';
    for (const [key, value] of Object.entries(fields))
      ctx.storage.sql.exec(`UPDATE users SET ${key} = ? WHERE id = ?`, value, linked.id);
    if (Object.keys(fields).length)
      ctx.storage.sql.exec(
        'UPDATE users SET updated_at = ? WHERE id = ?',
        ctx.now.toISOString(),
        linked.id,
      );
  }
  audit(ctx, action, row.id, before ?? null, row);
  return row;
}
export async function createRoster(ctx: Context) {
  const body = await readJson(ctx.request);
  return json(
    ctx.storage.transactionSync(() => saveRoster(ctx, body, undefined, 'roster.create')),
    201,
  );
}
export async function patchRoster(ctx: Context) {
  const body = await readJson(ctx.request);
  refreshUser(ctx);
  requireStaff(ctx);
  const before = rosterById(ctx.storage, ctx.params.id);
  if (!before) missing();
  return json(ctx.storage.transactionSync(() => saveRoster(ctx, body, before, 'roster.update')));
}
export function deleteRoster(ctx: Context) {
  requireStaff(ctx);
  const before = rosterById(ctx.storage, ctx.params.id);
  if (!before) missing();
  rosterPermission(ctx, before.role, before);
  if (before.claimed_by_user_id) conflict('Unlink this roster row before deleting it.');
  ctx.storage.transactionSync(() => {
    ctx.storage.sql.exec('DELETE FROM roster WHERE id = ?', before.id);
    audit(ctx, 'roster.delete', before.id, before, null);
  });
  return noContent();
}
export function unlinkRoster(ctx: Context) {
  const actor = requireStaff(ctx);
  const before = rosterById(ctx.storage, ctx.params.id);
  if (!before) missing();
  if (!before.claimed_by_user_id)
    throw new HttpError(409, 'NOT_CLAIMED', 'This roster row is not claimed.');
  if (before.claimed_by_user_id === actor.id) conflict('You cannot unlink your own roster row.');
  const user = byId(ctx.storage, before.claimed_by_user_id);
  if (user.role === 'admin') requireAdmin(ctx);
  return ctx.storage.transactionSync(() => {
    ctx.storage.sql.exec(
      'UPDATE users SET active = 0,updated_at = ? WHERE id = ?',
      ctx.now.toISOString(),
      user.id,
    );
    ctx.storage.sql.exec('DELETE FROM sessions WHERE user_id = ?', user.id);
    ctx.storage.sql.exec('UPDATE roster SET claimed_by_user_id = NULL WHERE id = ?', before.id);
    const after = rosterById(ctx.storage, before.id);
    audit(
      ctx,
      'roster.unlink',
      before.id,
      { roster: before, user: toUser(user) },
      { roster: after, user: toUser(byId(ctx.storage, user.id)) },
    );
    return json(after);
  });
}
export async function importRoster(ctx: Context) {
  const body = await readJson(ctx.request);
  refreshUser(ctx);
  requireStaff(ctx);
  const rows = parseCsv(v.string(body.csv, 'CSV', 0, 60000));
  let columns: number | undefined;
  if (rows[0]?.cells[0].trim().toLowerCase() === 'name') {
    const header = rows.shift()!.cells.map((cell) => cell.trim().toLowerCase());
    if (
      !['name,email,role,group,side,class_year', 'name,role,group,side,class_year'].includes(
        header.join(','),
      )
    )
      v.invalid('CSV header must be name,email,role,group,side,class_year (email may be omitted).');
    columns = header.length;
  }
  const errors: { row: number; message: string }[] = [];
  let imported = 0;
  for (const row of rows) {
    try {
      if (row.error) v.invalid(row.error);
      if (
        (columns !== undefined && row.cells.length !== columns) ||
        ![5, 6].includes(row.cells.length)
      )
        v.invalid('Each row must have five or six columns.');
      const cells = [...row.cells];
      if (cells.length === 5) cells.splice(1, 0, '');
      const [name, email, role, group_key, side, year] = cells;
      const fields: Record<string, unknown> = {
        name,
        email: email.trim() || null,
        role: role.trim(),
        group_key: group_key.trim() || null,
        side: side.trim() || null,
        class_year: year.trim()
          ? /^\d{4}$/.test(year.trim())
            ? Number(year)
            : v.invalid('Class year is invalid.')
          : null,
      };
      if (row.cells.length === 5) delete fields.email;
      const input = rosterInput(fields);
      ctx.storage.transactionSync(() => {
        const before = input.email
          ? findRoster(ctx.storage, input.email)
          : rosterByName(ctx.storage, input.name);
        saveRoster(ctx, fields, before, 'roster.import');
      });
      imported++;
    } catch (error) {
      if (error instanceof HttpError && [400, 409].includes(error.status))
        errors.push({ row: row.row, message: error.message });
      else if (error instanceof HttpError && error.status === 403)
        errors.push({
          row: row.row,
          message: 'Only admins can add or change admin roster rows.',
        });
      else throw error;
    }
  }
  if (!imported)
    audit(ctx, 'roster.import', 'roster', null, { imported: 0, errors: errors.length });
  return json({ imported, errors });
}
export function settings(ctx: Context) {
  requireStaff(ctx);
  return json(getSettings(ctx.storage));
}
export async function patchSettings(ctx: Context) {
  requireStaff(ctx);
  const body = await readJson(ctx.request);
  const before = getSettings(ctx.storage);
  const after: Settings = { ...before };
  if (body.team_code !== undefined) {
    after.team_code = v.string(body.team_code, 'Team code', 6, 64);
    if (!/^[A-Za-z0-9-]+$/.test(after.team_code))
      v.invalid('Team code may contain only letters, numbers, and hyphens.');
  }
  if (body.season_start !== undefined) {
    const start = v.string(body.season_start, 'Season start', 5, 5);
    v.date('2000-' + start);
    after.season_start = start;
  }
  for (const key of ['zone_factors', 'mode_factors', 'group_targets'] as const)
    if (body[key] !== undefined) {
      const value = v.object(body[key], key);
      const keys = Object.keys(before[key]);
      const result: Record<string, number> = {};
      for (const item of keys)
        result[item] =
          key === 'group_targets'
            ? v.int(value[item], 'Group target', 1000, 1000000)
            : v.number(value[item], 'Factor', 0.01, 100);
      Object.assign(after, { [key]: result });
    }
  ctx.storage.transactionSync(() => {
    for (const key of ['team_code', 'season_start', 'zone_factors', 'mode_factors'] as const)
      if (body[key] !== undefined) setSetting(ctx.storage, key, after[key]);
    if (body.group_targets !== undefined)
      setGroupTargets(ctx.storage, weekStart(today(ctx.now)), after.group_targets);
    const { team_code: _before, ...safeBefore } = before;
    const { team_code: _after, ...safeAfter } = getSettings(ctx.storage);
    void _before;
    void _after;
    audit(ctx, 'settings.update', 'settings', safeBefore, {
      ...safeAfter,
      team_code_changed: before.team_code !== after.team_code,
    });
  });
  return json(getSettings(ctx.storage));
}
function presetInput(body: Record<string, unknown>, before?: Preset): Preset {
  const value: Record<string, unknown> = { ...before, ...body };
  return {
    id: before?.id ?? crypto.randomUUID(),
    modality: v.enumeration(value.modality, ['erg', 'bike', 'run'], 'Modality'),
    zone: v.enumeration(value.zone, ZONES, 'Zone'),
    name: v.string(value.name, 'Name', 1, 120, true),
    distance_m: v.nullable(value.distance_m, (x) => v.int(x, 'Distance', 1, 200000)),
    sort: v.int(value.sort, 'Sort', -1000000, 1000000),
    active: v.boolean(value.active, 'Active'),
  };
}
export function listPresets(ctx: Context) {
  requireStaff(ctx);
  return json(presets(ctx.storage));
}
export async function createPreset(ctx: Context) {
  requireStaff(ctx);
  const preset = presetInput(await readJson(ctx.request));
  ctx.storage.transactionSync(() => {
    savePreset(ctx.storage, preset);
    audit(ctx, 'preset.create', preset.id, null, preset);
  });
  return json(preset, 201);
}
export async function patchPreset(ctx: Context) {
  requireStaff(ctx);
  const before = presets(ctx.storage).find((row) => row.id === ctx.params.id);
  if (!before) missing();
  const preset = presetInput(await readJson(ctx.request), before);
  ctx.storage.transactionSync(() => {
    savePreset(ctx.storage, preset);
    audit(ctx, 'preset.update', preset.id, before, preset);
  });
  return json(preset);
}
export function deletePreset(ctx: Context) {
  requireStaff(ctx);
  const before = presets(ctx.storage).find((row) => row.id === ctx.params.id);
  if (!before) missing();
  ctx.storage.transactionSync(() => {
    ctx.storage.sql.exec('DELETE FROM presets WHERE id = ?', before.id);
    audit(ctx, 'preset.delete', before.id, before, null);
  });
  return noContent();
}
export function recalc(ctx: Context) {
  requireStaff(ctx);
  return json({ updated: recalculate(ctx, getSettings(ctx.storage)) });
}
export function compliance(ctx: Context) {
  requireStaff(ctx);
  const query = new URL(ctx.request.url).searchParams.get('week');
  const week = weekStart(query === null ? today(ctx.now) : v.date(query));
  const users = ctx.storage.sql
    .exec<UserRow>('SELECT * FROM users WHERE active = ? AND role = ?', 1, 'rower')
    .toArray();
  const ranks = leaderboard(ctx.storage, week, 'percent', ctx.now, users);
  return json(
    ranks.map((row) => {
      const last = ctx.storage.sql
        .exec<{ date: string }>(
          'SELECT date FROM entries WHERE user_id = ? ORDER BY date DESC LIMIT ?',
          row.user.id,
          1,
        )
        .toArray()[0];
      return { ...row, last_log: last?.date ?? null };
    }),
  );
}
export function exportCsv(ctx: Context) {
  requireStaff(ctx);
  const params = new URL(ctx.request.url).searchParams;
  const start = v.date(params.get('start'));
  const end = v.date(params.get('end'));
  if (end < start) v.invalid('End date must be on or after the start date.');
  return new Response(exportEntries(ctx, start, end), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="oyo-entries-${start}-to-${end}.csv"`,
    },
  });
}
export function getAudit(ctx: Context) {
  requireStaff(ctx);
  return json(auditPage(ctx));
}
