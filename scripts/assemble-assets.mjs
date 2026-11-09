import { cp, mkdir, rm } from 'node:fs/promises';
import { URL } from 'node:url';
import console from 'node:console';

const site = new URL('../dist/site/', import.meta.url);
await rm(site, { recursive: true, force: true });
await mkdir(site, { recursive: true });
await cp(new URL('../web/dist/', import.meta.url), site, { recursive: true });
await cp(new URL('../worker/private-assets/', import.meta.url), site, { recursive: true });
console.log('Assembled web and private Worker assets in dist/site.');
