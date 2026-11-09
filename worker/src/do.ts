import { DurableObject } from 'cloudflare:workers';
import type { Env } from './index';
import { migrate } from './db/migrate';
import { route } from './router';
import { now } from './clock';
import { takePendingPush } from './db/notifications';
import { deliverPush, schedulePush } from './push/deliver';
import { enqueueReminders } from './push/reminders';
export class TeamDO extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      migrate(ctx.storage, env.TEAM_CODE);
    });
  }
  async fetch(request: Request): Promise<Response> {
    if (
      new URL(request.url).pathname === '/internal/reminders' &&
      request.headers.get('X-OYO-Internal') === '1'
    ) {
      await enqueueReminders(this.ctx.storage, now(request, this.env));
      return new Response(null, { status: 204 });
    }
    const response = await route({
      request,
      storage: this.ctx.storage,
      env: this.env,
      now: now(request, this.env),
      params: {},
    });
    if (takePendingPush(this.ctx.storage)) await schedulePush(this.ctx.storage);
    return response;
  }
  async alarm(): Promise<void> {
    await deliverPush(this.ctx.storage, this.env);
  }
}
