import type { Api, RosterInput, RosterRow, SignupRequest } from '../../shared/types.ts';

export type ClaimSignup = SignupRequest & { team_code: string; roster_id: string };
export type LoadRosterInput = RosterInput;
export type LoadRosterRow = RosterRow;
export type LoadApi = Api;
