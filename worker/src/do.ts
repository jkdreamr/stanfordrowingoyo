import { DurableObject } from 'cloudflare:workers';
import type { Env } from './index';
import { migrate } from './db/migrate';
import { route } from './router';
import { now } from './clock';
export class TeamDO extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      migrate(ctx.storage, env.TEAM_CODE);
    });
  }
  async fetch(request: Request): Promise<Response> {
    return route({
      request,
      storage: this.ctx.storage,
      env: this.env,
      now: now(request, this.env),
      params: {},
    });
  }
}
