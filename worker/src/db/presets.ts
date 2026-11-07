import type { Preset } from '../../../shared/types';
import type { Row } from './row';
import { HttpError } from '../http';
export function presets(storage: DurableObjectStorage): Preset[] {
  return storage.sql
    .exec<Row<Preset>>('SELECT * FROM presets ORDER BY sort,id')
    .toArray()
    .map((row) => ({ ...row, active: !!row.active }));
}
export function savePreset(storage: DurableObjectStorage, preset: Preset, update = false) {
  const values = [
    preset.modality,
    preset.zone,
    preset.name,
    preset.distance_m,
    preset.sort,
    Number(preset.active),
    preset.id,
  ];
  if (update) {
    if (
      !storage.sql.exec(
        'UPDATE presets SET modality=?,zone=?,name=?,distance_m=?,sort=?,active=? WHERE id=?',
        ...values,
      ).rowsWritten
    )
      throw new HttpError(404, 'NOT_FOUND', 'Preset not found.');
  } else
    storage.sql.exec(
      'INSERT INTO presets (modality,zone,name,distance_m,sort,active,id) VALUES (?,?,?,?,?,?,?)',
      ...values,
    );
}
