import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import process from 'node:process';
import { join } from 'node:path';
import console from 'node:console';

export async function checkWorldleWeb(
  directory = fileURLToPath(new URL('../../web/dist', import.meta.url)),
) {
  const data = await readFile(
    new URL('../../worker/src/games/worldle/data.ts', import.meta.url),
    'utf8',
  );
  const schedule = data.match(/WORLDLE_SCHEDULE\s*=\s*['"]([^'"]+)['"]/)[1];
  const ids = Object.values(
    JSON.parse(await readFile(new URL('./shape-ids.json', import.meta.url), 'utf8')),
  );
  const countries = JSON.parse(
    await readFile(new URL('./countries.json', import.meta.url), 'utf8'),
  );
  let assets = 0;
  let shapes = 0;
  async function scan(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        await scan(path);
        continue;
      }
      if (!/\.(?:js|css|html)$/i.test(entry.name)) continue;
      const source = await readFile(path, 'utf8');
      for (const secret of ['WORLDLE_SCHEDULE', schedule, ...ids]) {
        assert(!source.includes(secret), `Worldle Worker data leaked into ${path}`);
      }
      assets++;
    }
  }
  await scan(directory);
  assert(assets > 0, 'Build the web assets first');
  for (const name of await readdir(join(directory, 'worldle'))) {
    assert(/^(?:[a-f0-9]{16}|world)\.svg$/.test(name), `Invalid Worldle SVG filename: ${name}`);
    const source = await readFile(join(directory, 'worldle', name), 'utf8');
    assert(
      !/<\s*(?:text|title|metadata)\b/i.test(source),
      `Worldle SVG has text or metadata: ${name}`,
    );
    assert(
      !/<!--|<\s*(?!\/?(?:svg|path)\b)/i.test(source),
      `Worldle SVG has unexpected markup: ${name}`,
    );
    for (const { name: country } of countries) {
      assert(
        !source.toLowerCase().includes(country.toLowerCase()),
        `Country name in Worldle SVG: ${name}`,
      );
    }
    shapes++;
  }
  assert(shapes > 0, 'Worldle SVG assets missing');
  return `PASS: ${assets} built web JS/CSS/HTML assets exclude Worldle schedule and ${ids.length} shape IDs; ${shapes} opaque SVGs contain no country names, text, titles or metadata.`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(await checkWorldleWeb());
}
