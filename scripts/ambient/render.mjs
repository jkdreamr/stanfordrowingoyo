import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import console from 'node:console';

// Periodic wave-warped focal cells, with narrow midspans and softened junctions.
const output = new URL('../../web/public/ambient/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const dark of [false, true]) {
    for (const oar of [false, true]) {
      const data = await page.evaluate(
        ({ dark, oar }) => {
          const { document } = globalThis;
          const size = 640;
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (oar) {
            ctx.filter = 'blur(6px)';
            ctx.fillStyle = dark ? '#8c1515' : '#966e46';
            ctx.translate(320, 320);
            ctx.rotate(-0.45);
            ctx.fillRect(-450, -12, 485, 24);
            ctx.beginPath();
            ctx.moveTo(-120, -8);
            ctx.lineTo(-255, -155);
            ctx.lineTo(-320, -170);
            ctx.lineWidth = 12;
            ctx.strokeStyle = ctx.fillStyle;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, -10);
            ctx.bezierCurveTo(48, -12, 78, -75, 178, -83);
            ctx.quadraticCurveTo(198, -22, 180, 60);
            ctx.bezierCurveTo(118, 78, 67, 27, 0, 10);
            ctx.fill();
          } else {
            let seed = 9147;
            const random = () => {
              seed = (seed * 1664525 + 1013904223) >>> 0;
              return seed / 4294967296;
            };
            const cells = [];
            for (let y = 0; y < 8; y++)
              for (let x = 0; x < 8; x++)
                cells.push([(x + 0.15 + random() * 0.7) * 80, (y + 0.15 + random() * 0.7) * 80]);
            const tau = (Math.PI * 2) / size;
            const pixels = ctx.createImageData(size, size);
            for (let y = 0; y < size; y++)
              for (let x = 0; x < size; x++) {
                const u = x + 25 * Math.sin(y * tau * 2) + 12 * Math.sin((x + y) * tau * 3);
                const v = y + 22 * Math.sin(x * tau * 2) + 10 * Math.cos((x - y) * tau * 3);
                let first = Infinity,
                  second = Infinity,
                  third = Infinity;
                for (const [cx, cy] of cells) {
                  const dx = Math.abs(((u - cx + size * 2.5) % size) - size / 2);
                  const dy = Math.abs(((v - cy + size * 2.5) % size) - size / 2);
                  const distance = Math.hypot(dx, dy);
                  if (distance < first) {
                    third = second;
                    second = first;
                    first = distance;
                  } else if (distance < second) {
                    third = second;
                    second = distance;
                  } else if (distance < third) third = distance;
                }
                const junction = Math.exp(-(((third - first) / 7) ** 2));
                const width =
                  1.9 +
                  1.1 * (0.5 + 0.5 * Math.sin(x * tau * 3 + Math.cos(y * tau * 2))) +
                  junction * 1.3;
                const focal = Math.exp(-(((second - first) / width) ** 2));
                const brightness = 0.65 + 0.35 * (0.5 + 0.5 * Math.cos((x - y) * tau * 4));
                const base = dark ? [140, 21, 21] : [150, 110, 70];
                const light = dark ? [205, 126, 63] : base;
                const i = (y * size + x) * 4;
                for (let c = 0; c < 3; c++)
                  pixels.data[i + c] = base[c] + (light[c] - base[c]) * junction;
                pixels.data[i + 3] = Math.min(255, focal * (210 * brightness + junction * 35));
              }
            ctx.putImageData(pixels, 0, 0);
            const copy = document.createElement('canvas');
            copy.width = copy.height = size * 3;
            for (let y = 0; y < 3; y++)
              for (let x = 0; x < 3; x++)
                copy.getContext('2d').drawImage(canvas, x * size, y * size);
            ctx.clearRect(0, 0, size, size);
            const blurred = document.createElement('canvas');
            blurred.width = blurred.height = size * 3;
            blurred.getContext('2d').filter = 'blur(2.4px)';
            blurred.getContext('2d').drawImage(copy, 0, 0);
            ctx.drawImage(blurred, size, size, size, size, 0, 0, size, size);
          }
          if (!oar) {
            const raster = document.createElement('canvas');
            raster.width = raster.height = 320;
            const rasterContext = raster.getContext('2d');
            rasterContext.drawImage(canvas, 0, 0, 320, 320);
            const rgba = rasterContext.getImageData(0, 0, 320, 320);
            for (let i = 3; i < rgba.data.length; i += 4) {
              rgba.data[i] = Math.round(Math.min(255, rgba.data[i] * 1.3) / 8) * 8;
            }
            rasterContext.putImageData(rgba, 0, 0);
            return raster.toDataURL('image/webp', 0.76).split(',')[1];
          }
          const feathered = ctx.getImageData(0, 0, size, size);
          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              const edge = Math.min(1, Math.min(x, y, size - 1 - x, size - 1 - y) / 80);
              feathered.data[(y * size + x) * 4 + 3] *= edge * edge * (3 - 2 * edge);
            }
          }
          ctx.putImageData(feathered, 0, 0);
          return canvas.toDataURL('image/webp', 0.76).split(',')[1];
        },
        { dark, oar },
      );
      const name = `${oar ? 'oar' : 'caustic'}-${dark ? 'dark' : 'light'}.webp`;
      const bytes = Buffer.from(data, 'base64');
      await writeFile(new URL(name, output), bytes);
      console.log(`${name}: ${bytes.length} bytes`);
    }
  }
} finally {
  await browser.close();
}
