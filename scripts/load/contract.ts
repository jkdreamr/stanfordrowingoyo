import type { Api, Endpoint, GroupKey, Role, Side, User } from '../../shared/types.ts';

export interface ClaimSignup {
  team_code: string;
  roster_id: string;
  email: string;
  password: string;
  group_key?: GroupKey;
}
export interface LoadRosterInput {
  name: string;
  email: string | null;
  role: Role;
  group_key: GroupKey | null;
  side: Side | null;
  class_year: number | null;
}
export interface LoadRosterRow extends LoadRosterInput {
  id: string;
  claimed_by_user_id: string | null;
}
export type LoadApi = Omit<
  Api,
  'POST /api/auth/signup' | 'GET /api/admin/roster' | 'POST /api/admin/roster'
> & {
  'POST /api/auth/signup': Endpoint<
    Api['POST /api/auth/signup']['request'] | ClaimSignup | { email: string; password: string },
    User
  >;
  'POST /api/auth/roster': Endpoint<
    { team_code: string },
    Pick<LoadRosterRow, 'id' | 'name' | 'role'>[]
  >;
  'GET /api/admin/roster': Endpoint<void, LoadRosterRow[]>;
  'POST /api/admin/roster': Endpoint<LoadRosterInput, LoadRosterRow>;
  'POST /api/admin/roster/:id/unlink': Endpoint<void, unknown>;
  'DELETE /api/admin/roster/:id': Endpoint<void, void>;
};
