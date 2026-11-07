import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import type { Plugin } from 'vite';
import { shellRoute } from './src/lib/swRouting';
export function pwaPlugin(): Plugin {
  let directory: string;
  return {
    name: 'oyo-shell-worker',
    apply: 'build',
    configResolved(config) {
      directory = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const files: string[] = [];
      function scan(dir: string) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const path = join(dir, entry.name);
          if (entry.isDirectory()) scan(path);
          else if (
            /\.(html|js|css|png|svg|webmanifest)$/.test(entry.name) &&
            entry.name !== 'sw.js'
          )
            files.push(path);
        }
      }
      scan(directory);
      files.sort();
      const hash = createHash('sha256');
      hash.update(readFileSync(new URL('./pwaPlugin.ts', import.meta.url)));
      hash.update(shellRoute.toString());
      for (const file of files) {
        hash.update(relative(directory, file));
        hash.update(readFileSync(file));
      }
      const version = hash.digest('hex').slice(0, 16);
      const assets = files.map((file) => '/' + relative(directory, file).split('\\').join('/'));
      writeFileSync(
        join(directory, 'sw.js'),
        `const CACHE='oyo-shell-${version}';
const ASSETS=${JSON.stringify(assets)};
const route=${shellRoute.toString()};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('oyo-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const decision=route(event.request.url,event.request.method,event.request.mode,self.location.origin,ASSETS);
 if(decision==='bypass')return;
 if(decision==='navigation'){event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/index.html')).then(response=>response||Response.error())));return;}
 event.respondWith(caches.open(CACHE).then(cache=>cache.match(new URL(event.request.url).pathname)).then(cached=>cached||fetch(event.request)));
});
`,
      );
    },
  };
}
