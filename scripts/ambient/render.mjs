import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import console from 'node:console';

const output = new URL('../../web/public/ambient/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const dark of [false, true]) {
    for (const swell of [false, true]) {
      const data = await page.evaluate(
        ({ dark, swell }) => {
          const { document } = globalThis;
          const size = 640;
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = size;
          const ctx = canvas.getContext('2d');
          const pixels = ctx.createImageData(size, size);
          const tau = (Math.PI * 2) / size;
          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              const u = x * tau;
              const v = y * tau;
              const a = u * 4 + 0.8 * Math.sin(v * 3) + 0.3 * Math.cos(u * 2 - v * 2);
              const b = v * 5 + 0.9 * Math.sin(u * 3) + 0.35 * Math.cos(v * 2 + u);
              const surface = Math.cos(a) + Math.cos(b);
              const focus = Math.exp(-((surface / 0.12) ** 2));
              const halo = Math.exp(-(((surface - 0.16) / 0.24) ** 2));
              const glint = 0.5 + 0.5 * Math.sin(a * 2 - b + 0.7 * Math.sin(v));
              const band = 0.5 + 0.5 * Math.cos(v + 0.3 * Math.sin(u));
              const palette = dark ? [140, 30, 27] : [150, 110, 70];
              const highlight = dark ? [205, 112, 58] : [191, 146, 92];
              const i = (y * size + x) * 4;
              for (let c = 0; c < 3; c++)
                pixels.data[i + c] = palette[c] + (highlight[c] - palette[c]) * glint * halo;
              pixels.data[i + 3] = swell ? 42 * band ** 3 : focus * (125 + 65 * glint) + halo * 22;
            }
          }
          ctx.putImageData(pixels, 0, 0);
          const wrapped = document.createElement('canvas');
          wrapped.width = wrapped.height = size * 3;
          const wrap = wrapped.getContext('2d');
          for (let y = 0; y < 3; y++)
            for (let x = 0; x < 3; x++) wrap.drawImage(canvas, x * size, y * size);
          const blurred = document.createElement('canvas');
          blurred.width = blurred.height = size * 3;
          const blur = blurred.getContext('2d');
          blur.filter = swell ? 'blur(18px)' : 'blur(3.2px)';
          blur.drawImage(wrapped, 0, 0);
          const raster = document.createElement('canvas');
          raster.width = swell ? 256 : 315;
          raster.height = swell ? 128 : 210;
          raster
            .getContext('2d')
            .drawImage(blurred, size, size, size, size, 0, 0, raster.width, raster.height);
          return raster.toDataURL('image/webp', 0.78).split(',')[1];
        },
        { dark, swell },
      );
      const name = `${swell ? 'swell' : 'caustic'}-${dark ? 'dark' : 'light'}.webp`;
      const bytes = Buffer.from(data, 'base64');
      await writeFile(new URL(name, output), bytes);
      console.log(`${name}: ${bytes.length} bytes`);
    }
  }
} finally {
  await browser.close();
}
