import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import type { Plugin } from 'vite';
import { shellRoute } from './src/lib/swRouting';
import { pushMessage } from './src/lib/swPush';
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
            /\.(html|js|css|png|webp|svg|webmanifest|woff2)$/.test(entry.name) &&
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
      hash.update(pushMessage.toString());
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
const pushMessage=${pushMessage.toString()};
const windows=()=>self.clients.matchAll({type:'window',includeUncontrolled:true});
self.addEventListener('push',event=>{
 const message=pushMessage(event.data?event.data.text():'',self.location.origin);
 const badge=navigator.setAppBadge?(message.badge?navigator.setAppBadge(message.badge):navigator.clearAppBadge()).catch(()=>{}):Promise.resolve();
 event.waitUntil(Promise.all([
  self.registration.showNotification(message.title,{body:message.body,tag:message.tag,renotify:true,icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',data:{url:message.url}}),
  badge,
  windows().then(list=>list.forEach(client=>client.postMessage({type:'oyo-push'}))),
 ]));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const url=pushMessage(JSON.stringify(event.notification.data||{}),self.location.origin).url;
 event.waitUntil(windows().then(list=>{
  const client=list.find(item=>new URL(item.url).origin===self.location.origin&&'focus' in item);
  if(!client)return self.clients.openWindow(url);
  client.postMessage({type:'oyo-navigate',url});
  return client.focus();
 }));
});
self.addEventListener('pushsubscriptionchange',event=>{
 event.waitUntil(fetch('/api/me/push',{credentials:'same-origin'}).then(response=>response.ok?response.json():null).then(config=>config&&config.public_key?self.registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(atob(config.public_key.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))}):null).then(subscription=>{
  if(!subscription)return;
  const json=subscription.toJSON();
  return fetch('/api/me/push',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json','X-OYO-CSRF':'1'},body:JSON.stringify({endpoint:subscription.endpoint,keys:json.keys})});
 }).catch(()=>{}));
});
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
