export { TeamDO } from './do';
export interface Env {
  TEAM: DurableObjectNamespace;
  ASSETS: Fetcher;
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/'))
      return env.TEAM.get(env.TEAM.idFromName('stanford')).fetch(request);
    return env.ASSETS.fetch(request);
  },
};
