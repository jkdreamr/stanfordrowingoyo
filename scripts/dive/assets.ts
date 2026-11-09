import { readFile } from 'node:fs/promises';
import { answerSet as load } from '../../worker/src/games/dive/sets';

const env = {
  ASSETS: {
    async fetch(input: RequestInfo | URL) {
      const url = new URL(input instanceof Request ? input.url : String(input));
      return new Response(
        await readFile(
          new URL('../../worker/private-assets' + url.pathname, import.meta.url),
          'utf8',
        ),
      );
    },
  },
};

export const answerSet = (id: string) => load(env, id);
