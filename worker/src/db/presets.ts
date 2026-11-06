import type { Preset } from '../../../shared/types';
import type { Row } from './row';
export function presets(storage: DurableObjectStorage): Preset[] {
  return storage.sql
    .exec<Row<Preset>>('SELECT * FROM presets ORDER BY sort,id')
    .toArray()
    .map((row) => ({ ...row, active: !!row.active }));
}
export function savePreset(storage: DurableObjectStorage, preset: Preset) {
  storage.sql.exec(
    'INSERT OR REPLACE INTO presets VALUES (?,?,?,?,?,?,?)',
    preset.id,
    preset.modality,
    preset.zone,
    preset.name,
    preset.distance_m,
    preset.sort,
    Number(preset.active),
  );
}
