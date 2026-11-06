import { DurableObject } from 'cloudflare:workers';
import type { Env } from './index';
import { migrate } from './db/migrate';
import { notImplemented } from './routes/stub';
export class TeamDO extends DurableObject<Env> {
 constructor(ctx: DurableObjectState, env: Env) { super(ctx, env); ctx.blockConcurrencyWhile(async () => { migrate(ctx.storage); }); }
 async fetch(request: Request): Promise<Response> {
  if (request.method === 'GET' && new URL(request.url).pathname === '/api/health') return Response.json({ ok: true, schema_version: 1 });
  return notImplemented();
 }
}
