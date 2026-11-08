import type { Config, RaceWeek, RecapGames, User, WeeklyRecap } from '../../../shared/types';
import { addDays, today } from '../../../shared/dates';
import { raceLeader } from '../../../shared/race';
import { formatCompactMeters, formatEMeters, formatNumber, formatPercent } from './format';

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
const day = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(
    new Date(date + 'T12:00:00Z'),
  );
export function recapDate(week: string) {
  return day(week, { month: 'short', day: 'numeric' });
}
/** "Mar 9 – 15", or "Mar 30 – Apr 5" across months. */
export function recapRange(week: string) {
  const end = addDays(week, 6);
  return `${recapDate(week)} – ${end.slice(5, 7) === week.slice(5, 7) ? day(end, { day: 'numeric' }) : recapDate(end)}`;
}
/** The race from Stanford's side: Won, Lost or Tied, and the margin in E-meters. */
export function raceOutcome(race: RaceWeek) {
  const leader = raceLeader(race.stanford_m, race.berkeley_m);
  return {
    leader,
    word: leader === 'stanford' ? 'Won' : leader === 'berkeley' ? 'Lost' : 'Tied',
    margin: Math.abs(race.stanford_m - race.berkeley_m),
  };
}
export function raceLine(race: RaceWeek) {
  const { word, margin } = raceOutcome(race);
  return word === 'Tied' ? 'Tied Berkeley' : `${word} by ${formatCompactMeters(margin)}`;
}
export function planPercent(plan: NonNullable<WeeklyRecap['plan']>) {
  return plan.planned_m > 0 ? (plan.logged_m / plan.planned_m) * 100 : 0;
}
/** Short game facts in order of interest; empty parts are left out. */
export function gameFacts(games: RecapGames) {
  return [
    games.best_dive !== null && `Best Dive ${formatNumber(games.best_dive)}`,
    games.word_guess_solves > 0 &&
      `${formatNumber(games.word_guess_solves)} Word Guess ${games.word_guess_solves === 1 ? 'Solve' : 'Solves'}`,
    games.streak > 1 && `${formatNumber(games.streak)} Day Streak`,
  ].filter((part): part is string => !!part);
}
export function recapShareText(recap: WeeklyRecap) {
  const parts = [
    `${formatEMeters(recap.total_m, true)} / ${formatEMeters(recap.target_m, true)} E-meters (${formatPercent(recap.percent)})`,
    `${formatNumber(recap.entry_count)} ${recap.entry_count === 1 ? 'workout' : 'workouts'}`,
    recap.rank !== null && `#${formatNumber(recap.rank)} on the team`,
    recap.race && `Stanford ${raceLine(recap.race).replace(/^\w/, (c) => c.toLowerCase())}`,
  ].filter(Boolean);
  return `Week of ${recapDate(recap.week_start)}: ${parts.join(' · ')}`;
}
