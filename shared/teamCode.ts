export const TEAM_CODE_MIN_LENGTH = 4;
export const TEAM_CODE_MAX_LENGTH = 64;
export function isValidTeamCode(value: string): boolean {
  return (
    value.length >= TEAM_CODE_MIN_LENGTH &&
    value.length <= TEAM_CODE_MAX_LENGTH &&
    /^[A-Za-z0-9-]+$/.test(value)
  );
}
