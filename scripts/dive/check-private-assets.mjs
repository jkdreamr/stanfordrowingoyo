import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { request } from 'node:https';
import { request as httpRequest } from 'node:http';
import { pathToFileURL, URL } from 'node:url';
import console from 'node:console';
import process from 'node:process';
import { privateUrls } from './private-urls.ts';

function get(base, path, method) {
  const url = new URL(base);
  const send = url.protocol === 'https:' ? request : httpRequest;
  return new Promise((resolve, reject) => {
    const req = send(
      {
        hostname: url.hostname,
        port: url.port,
        path,
        method,
        rejectUnauthorized: !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname),
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            body,
            location: response.headers.location,
            contentType: response.headers['content-type'],
          }),
        );
      },
    );
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Private asset request timed out')));
    req.end();
  });
}

export async function checkPrivateAssets(baseURL) {
  const index = await get(baseURL, '/', 'GET');
  assert.equal(index.status, 200);
  for (const id of ['instruments', 'universities', 'animals']) {
    const source = await readFile(
      new URL(`../../worker/private-assets/_private/dive/${id}.json`, import.meta.url),
      'utf8',
    );
    const set = JSON.parse(source);
    const secrets = [
      source.trim(),
      set.answers,
      set.gem.answer,
      'DIVE_PRIVATE_SENTINEL_NOT_REAL_ANSWER_DATA',
    ];
    for (const [method, original] of privateUrls(id)) {
      let path = original;
      const redirects = [];
      for (let hop = 0; ; hop++) {
        assert(hop < 10, `Redirect loop: ${original}`);
        const response = await get(baseURL, path, method);
        for (const secret of secrets)
          assert(!response.body.includes(secret), `PRIVATE BYTES: ${method} ${path}`);
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          assert(response.location, `Missing Location: ${path}`);
          redirects.push(`${response.status} ${path} -> ${response.location}`);
          const target = new URL(response.location, baseURL);
          assert.equal(target.origin, new URL(baseURL).origin, 'Cross-origin redirect');
          path = target.pathname + target.search;
          continue;
        }
        assert(
          response.status === 404 ||
            (response.status === 200 &&
              (method === 'HEAD'
                ? response.contentType === index.contentType &&
                  response.contentType?.includes('text/html')
                : response.body === index.body)),
          `Unexpected public response: ${method} ${path} ${response.status}`,
        );
        console.log(
          `PASS ${method} ${original}: ${redirects.join('; ')}${redirects.length ? '; ' : ''}final ${response.status}; no private bytes`,
        );
        break;
      }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const position = process.argv.indexOf('--base-url');
  assert(
    position >= 0 && process.argv[position + 1],
    'Usage: check-private-assets.mjs --base-url <url>',
  );
  await checkPrivateAssets(process.argv[position + 1]);
}
