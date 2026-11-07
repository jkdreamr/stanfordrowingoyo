import { today, weekStart } from '../../../shared/dates';
import { ZONES } from '../../../shared/math';
import type { Preset } from '../../../shared/types';
import type { Row } from '../db/row';
import type { Context } from '../context';
import { requireUser } from '../auth/guards';
import { getSettings } from '../db/settings';
import { json } from '../http';
export function get(ctx: Context) {
  requireUser(ctx);
  const { team_code: _code, ...settings } = getSettings(ctx.storage);
  void _code;
  const presets = ctx.storage.sql
    .exec<Row<Preset>>('SELECT * FROM presets WHERE active = ? ORDER BY sort, id', 1)
    .toArray()
    .map((row) => ({ ...row, active: !!row.active }));
  return json({
    ...settings,
    today: today(ctx.now),
    current_week_start: weekStart(today(ctx.now)),
    presets,
    zones: ZONES,
  });
}
