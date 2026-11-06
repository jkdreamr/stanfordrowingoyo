import type { Settings } from '../../../shared/types';
export function getSetting<T>(storage: DurableObjectStorage, key: string): T {
  return JSON.parse(
    storage.sql
      .exec<{ value_json: string }>('SELECT value_json FROM settings WHERE key = ?', key)
      .one().value_json,
  ) as T;
}
export function setSetting(storage: DurableObjectStorage, key: string, value: unknown) {
  storage.sql.exec(
    'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json',
    key,
    JSON.stringify(value),
  );
}
export function getSettings(storage: DurableObjectStorage): Settings {
  return {
    team_code: getSetting(storage, 'team_code'),
    mode_factors: getSetting(storage, 'mode_factors'),
    zone_factors: getSetting(storage, 'zone_factors'),
    group_targets: getSetting(storage, 'group_targets'),
    season_start: getSetting(storage, 'season_start'),
  };
}
export interface TargetVersion {
  week_start: string;
  targets: Settings['group_targets'];
}
export function setGroupTargets(
  storage: DurableObjectStorage,
  week: string,
  targets: Settings['group_targets'],
) {
  const history = getSetting<TargetVersion[]>(storage, 'group_target_history').filter(
    (row) => row.week_start !== week,
  );
  history.push({ week_start: week, targets });
  history.sort((a, b) => a.week_start.localeCompare(b.week_start));
  storage.transactionSync(() => {
    setSetting(storage, 'group_target_history', history);
    setSetting(storage, 'group_targets', history[history.length - 1].targets);
  });
}
