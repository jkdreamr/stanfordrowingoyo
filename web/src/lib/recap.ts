import type { Config, User, WeeklyRecap } from '../../../shared/types';
import { addDays, today } from '../../../shared/dates';
import { formatEMeters, formatNumber } from './format';

export const recapKey = (user: string, week: string) => `oyo-recap-dismissed:${user}:${week}`;
export function recapVisible(user: User, config: Config, storage?: Pick<Storage, 'getItem'>) {
  const week = addDays(config.current_week_start, -7);
  if (
    config.today < config.current_week_start ||
    config.today > addDays(config.current_week_start, 2) ||
    today(new Date(user.created_at)) > addDays(week, 6)
  )
    return false;
  try {
    return !(storage ?? localStorage).getItem(recapKey(user.id, week));
  } catch {
    return true;
  }
}
export function recapDate(week: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(week + 'T12:00:00Z'));
}
export function recapShareText(recap: WeeklyRecap) {
  return `Week of ${recapDate(recap.week_start)}: ${formatEMeters(recap.total_m, true)} / ${formatEMeters(recap.target_m, true)} E-meters · ${formatNumber(recap.entry_count)} ${recap.entry_count === 1 ? 'workout' : 'workouts'}`;
}
