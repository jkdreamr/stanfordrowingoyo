import type { Entry } from '../../../shared/types';
import { addDays, today, weekStart } from '../../../shared/dates';
import { equivalentMeters, ZONES } from '../../../shared/math';
import type { Context } from '../context';
import { refreshUser, requireUser } from '../auth/guards';
import { getSettings } from '../db/settings';
import {
  checkImages,
  deleteEntry,
  details,
  findEntry,
  listEntries,
  saveEntry,
  visibleEntry,
} from '../db/entries';
import { HttpError, json, noContent, readJson } from '../http';
import * as v from '../validate';
import { audit } from '../db/audit';
function imageIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 4)
    return v.invalid('Select at most four unique images.');
  const ids = value.map((id) => v.string(id, 'Image ID', 1, 200));
  if (new Set(ids).size !== ids.length) return v.invalid('Image IDs must be unique.');
  return ids;
}
function validate(ctx: Context, body: Record<string, unknown>, previous?: Entry): Entry {
  const merged: Record<string, unknown> = { ...previous, ...body };
  const date = v.date(merged.date);
  if (date < '2020-01-01' || date > addDays(today(ctx.now), 1))
    v.invalid('Date must be between 2020-01-01 and tomorrow.');
  const modality = v.enumeration(merged.modality, ['erg', 'bike', 'run'], 'Modality');
  const zone = v.enumeration(merged.zone, ZONES, 'Zone');
  const distance = v.int(merged.distance_m, 'Distance', 1, 200000);
  const preset =
    merged.preset_id === undefined
      ? null
      : v.nullable(merged.preset_id, (value) => v.string(value, 'Preset', 1, 200));
  if (preset && !ctx.storage.sql.exec('SELECT id FROM presets WHERE id = ?', preset).toArray()[0])
    v.invalid('Preset does not exist.');
  const settings = getSettings(ctx.storage);
  const resnapshot =
    !previous ||
    previous.distance_m !== distance ||
    previous.modality !== modality ||
    previous.zone !== zone;
  const modes = resnapshot
    ? settings.mode_factors
    : { ...settings.mode_factors, [modality]: previous.mode_factor };
  const zones = resnapshot
    ? settings.zone_factors
    : { ...settings.zone_factors, [zone]: previous.zone_factor };
  const optional = (key: string, min: number, max: number, integer = true) =>
    merged[key] === undefined
      ? null
      : v.nullable(merged[key], (value) => v.number(value, key, min, max, integer));
  return {
    id: previous?.id ?? crypto.randomUUID(),
    user_id: previous?.user_id ?? requireUser(ctx).id,
    date,
    week_start: weekStart(date),
    modality,
    zone,
    distance_m: distance,
    duration_s: optional('duration_s', 1, 86400),
    avg_split_s: optional('avg_split_s', 60, 600, false),
    stroke_rate: optional('stroke_rate', 10, 60),
    avg_hr: optional('avg_hr', 30, 240),
    title: v.string(merged.title, 'Title', 0, 120, true),
    notes: v.string(merged.notes, 'Notes', 0, 2000),
    preset_id: preset,
    visibility: v.enumeration(merged.visibility, ['team', 'private'], 'Visibility'),
    mode_factor: modes[modality],
    zone_factor: zones[zone],
    equiv_m: equivalentMeters(distance, modality, zone, modes, zones),
    created_at: previous?.created_at ?? ctx.now.toISOString(),
    updated_at: ctx.now.toISOString(),
  };
}
export function get(ctx: Context) {
  const user = requireUser(ctx);
  return json(
    details(ctx.storage, [visibleEntry(ctx.storage, ctx.params.id, user.id)], user.id)[0],
  );
}
export async function create(ctx: Context) {
  const body = await readJson(ctx.request);
  const user = refreshUser(ctx);
  const entry = validate(ctx, body);
  const ids = body.image_ids === undefined ? [] : imageIds(body.image_ids);
  checkImages(ctx.storage, ids, user.id, entry.id);
  saveEntry(ctx.storage, entry, ids);
  return json(details(ctx.storage, [entry], user.id)[0], 201);
}
function editable(ctx: Context) {
  const user = requireUser(ctx);
  const entry = findEntry(ctx.storage, ctx.params.id);
  if (!entry) throw new HttpError(404, 'NOT_FOUND', 'Entry not found.');
  if (entry.user_id !== user.id && user.role === 'rower') {
    if (entry.visibility === 'private') throw new HttpError(404, 'NOT_FOUND', 'Entry not found.');
    throw new HttpError(403, 'FORBIDDEN', 'Only the owner or staff may change this entry.');
  }
  return entry;
}
export async function patch(ctx: Context) {
  const body = await readJson(ctx.request);
  refreshUser(ctx);
  const previous = editable(ctx);
  const entry = validate(ctx, body, previous);
  const ids = body.image_ids === undefined ? undefined : imageIds(body.image_ids);
  if (ids) checkImages(ctx.storage, ids, entry.user_id, entry.id);
  ctx.storage.transactionSync(() => {
    saveEntry(ctx.storage, entry, ids, true);
    if (entry.user_id !== requireUser(ctx).id)
      audit(ctx, 'entry.update', entry.id, previous, entry);
  });
  return json(details(ctx.storage, [entry], requireUser(ctx).id)[0]);
}
export function remove(ctx: Context) {
  const entry = editable(ctx);
  deleteEntry(ctx.storage, entry.id);
  if (entry.user_id !== requireUser(ctx).id) audit(ctx, 'entry.delete', entry.id, entry, null);
  return noContent();
}
export function list(ctx: Context) {
  const user = requireUser(ctx);
  const params = new URL(ctx.request.url).searchParams;
  const scope = params.get('scope') ?? 'feed';
  if (!['feed', 'mine'].includes(scope) && !/^user:.+$/.test(scope)) v.invalid('Scope is invalid.');
  let cursor: [string, string] | undefined;
  if (params.has('cursor')) {
    try {
      const encoded = params.get('cursor')!;
      if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error();
      const parts = atob(encoded.replaceAll('-', '+').replaceAll('_', '/')).split('|');
      if (
        parts.length !== 2 ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(parts[0]) ||
        !Number.isFinite(Date.parse(parts[0])) ||
        !/^[0-9a-f-]{36}$/.test(parts[1])
      )
        throw new Error();
      cursor = [parts[0], parts[1]];
    } catch {
      v.invalid('Cursor is invalid.');
    }
  }
  const rows = listEntries(ctx.storage, user.id, scope, cursor);
  const items = rows.slice(0, 20);
  const last = items[items.length - 1];
  return json({
    items: details(ctx.storage, items, user.id),
    next_cursor:
      rows.length > 20
        ? btoa(last.created_at + '|' + last.id)
            .replaceAll('+', '-')
            .replaceAll('/', '_')
            .replaceAll('=', '')
        : null,
  });
}
