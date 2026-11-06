import type { UserRow } from './db/users';
import type { Env } from './index';
export interface Context {
  request: Request;
  storage: DurableObjectStorage;
  env: Env;
  now: Date;
  params: Record<string, string>;
  user?: UserRow;
  tokenHash?: string;
  cookie?: string;
  audited?: boolean;
}
