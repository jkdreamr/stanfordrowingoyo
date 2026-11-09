import type { WorldleGuess } from '../../../../shared/types';
import { worldleNames } from '../../../../shared/games/worldleNames';
import { compass8, haversineKm, initialBearing, proximity } from '../../../../shared/games/worldle';
import { WORLDLE_SCHEDULE, WORLDLE_START, worldleData } from './data';

export function dailyIndex(date: string): number {
  const days = Math.round(
    (Date.parse(date + 'T00:00:00Z') - Date.parse(WORLDLE_START + 'T00:00:00Z')) / 86400000,
  );
  const length = WORLDLE_SCHEDULE.length / 2;
  const offset = ((days % length) + length) % length;
  return parseInt(WORLDLE_SCHEDULE.slice(offset * 2, offset * 2 + 2), 36);
}

export function dailyCountry(date: string) {
  const index = dailyIndex(date);
  const [lat, lon, shape] = worldleData[index];
  return { index, name: worldleNames[index].name, lat, lon, shape };
}

export function guessRow(index: number, answerIndex: number): WorldleGuess {
  const [lat, lon] = worldleData[index];
  const [answerLat, answerLon] = worldleData[answerIndex];
  const correct = index === answerIndex;
  const km = correct ? 0 : Math.round(haversineKm(lat, lon, answerLat, answerLon));
  const bearing = correct ? 0 : Math.round(initialBearing(lat, lon, answerLat, answerLon)) % 360;
  return {
    name: worldleNames[index].name,
    km,
    bearing,
    direction: compass8(bearing),
    proximity: correct ? 100 : proximity(km),
    correct,
  };
}
