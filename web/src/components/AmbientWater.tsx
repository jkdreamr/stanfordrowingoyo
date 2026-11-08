import { useEffect, useRef } from 'react';
import { afterLaunch } from '../lib/motion';
import './AmbientWater.css';

export const ambientWaterConfig = { enabled: true, intensity: 1 };

const sine = Float32Array.from({ length: 4096 }, (_, i) => Math.sin((i * Math.PI * 2) / 4096));
const sin = (phase: number) => sine[((phase * 651.898647) | 0) & 4095];

const caustics = (() => {
  const light = new Uint8ClampedArray(256 * 256 * 4);
  const dark = new Uint8ClampedArray(256 * 256 * 4);
  const seeds = Float32Array.from({ length: 32 }, (_, i) => sin(i * 127.1 + 31.7) * 16);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const col = x >> 6;
      const row = y >> 6;
      let first = Infinity;
      let second = Infinity;
      let third = Infinity;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const cx = col + dx;
          const cy = row + dy;
          const seed = ((cy & 3) * 4 + (cx & 3)) * 2;
          const sx = cx * 64 + 32 + seeds[seed];
          const sy = cy * 64 + 32 + seeds[seed + 1];
          const distance = (x - sx) ** 2 + (y - sy) ** 2;
          if (distance < first) {
            third = second;
            second = first;
            first = distance;
          } else if (distance < second) {
            third = second;
            second = distance;
          } else if (distance < third) third = distance;
        }
      }
      const p = (y * 256 + x) * 4;
      const edge = Math.max(0, 1 - (Math.sqrt(second) - Math.sqrt(first)) / 14);
      const rim = edge * edge * (3 - 2 * edge);
      const knot = Math.max(0, 1 - (Math.sqrt(third) - Math.sqrt(first)) / 10) * rim;
      light[p] = 115;
      light[p + 1] = 175;
      light[p + 2] = 201;
      light[p + 3] = Math.min(49, (1 - rim) * 49);
      dark[p] = 12 + 84 * rim + 20 * knot;
      dark[p + 1] = 24 + 84 * rim - 12 * knot;
      dark[p + 2] = 44 + 88 * rim - 4 * knot;
      dark[p + 3] = 64;
    }
  }
  return {
    light: new Uint32Array(light.buffer),
    dark: new Uint32Array(dark.buffer),
  };
})();

function createRenderer(canvas: HTMLCanvasElement) {
  canvas.width = 128;
  canvas.height = Math.max(1, Math.ceil((128 * innerHeight) / innerWidth));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const image = ctx.createImageData(canvas.width, canvas.height);
  const pixels = image.data;
  const words = new Uint32Array(pixels.buffer);
  const vertical = new Int32Array(canvas.width);
  const alphaShift = new Uint8Array(new Uint32Array([0x01000000]).buffer)[3] === 1 ? 24 : 0;
  const colorMask = ~(255 << alphaShift);
  let frame = 0;
  return (time: number, dark: boolean, intensity: number) => {
    const start = performance.now();
    const t = time * 0.001;
    const field = dark ? caustics.dark : caustics.light;
    for (let x = 0; x < canvas.width; x++) {
      vertical[x] =
        (Math.floor(-t * 8 + 9 * sin(x * 0.14 - t * 0.8) + 4 * sin(x * 0.3 + t * 0.7)) & 255) << 8;
    }
    for (let y = 0, p = 0; y < canvas.height; y++) {
      const horizontal = Math.floor(
        -t * 20 + 10 * sin(y * 0.15 + t * 0.85) + 4 * sin(y * 0.31 - t * 0.65),
      );
      const row = y * 512;
      const swell = (0.9 + 0.1 * sin(y * 0.025 - t * 0.35)) * intensity;
      if (dark) {
        const alphaOffset = (Math.floor(64 * swell) - 64) << alphaShift;
        for (let x = 0; x < canvas.width; x++, p++) {
          words[p] =
            field[((row + vertical[x]) & 65535) + ((x * 2 + horizontal) & 255)] + alphaOffset;
        }
      } else {
        for (let x = 0; x < canvas.width; x++, p++) {
          const color = field[((row + vertical[x]) & 65535) + ((x * 2 + horizontal) & 255)];
          words[p] = (color & colorMask) | ((((color >>> alphaShift) & 255) * swell) << alphaShift);
        }
      }
    }
    ctx.putImageData(image, 0, 0);
    canvas.dataset.frame = String(++frame);
    canvas.dataset.renderMs = String(performance.now() - start);
  };
}

export function AmbientWater({
  config = ambientWaterConfig,
}: {
  config?: typeof ambientWaterConfig;
}) {
  return config.enabled ? <Water intensity={config.intensity} /> : null;
}

function Water({ intensity }: { intensity: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current!;
    const layer = element.parentElement!;
    const strength = Number.isFinite(intensity) ? Math.max(0, Math.min(1, intensity)) : 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const exclusions = [
      matchMedia('(forced-colors: active)'),
      matchMedia('(prefers-contrast: more)'),
      matchMedia('(prefers-reduced-transparency: reduce)'),
    ];
    let render = createRenderer(element);
    let ready = false;
    let dark = document.documentElement.classList.contains('dark');
    let handle = 0;
    let last = -Infinity;
    let clock = 0;
    let previous = 0;
    const stop = () => {
      cancelAnimationFrame(handle);
      handle = 0;
      previous = 0;
    };
    const tick = (now: number) => {
      if (previous) clock += now - previous;
      previous = now;
      if (now - last >= 1000 / 30 - 0.5) {
        render?.(clock, dark, strength);
        last = now;
      }
      handle = requestAnimationFrame(tick);
    };
    const update = () => {
      stop();
      const excluded = exclusions.some((query) => query.matches);
      layer.hidden = excluded;
      layer.dataset.paused = String(document.hidden || !ready || excluded || reduced.matches);
      if (!ready || document.hidden || excluded || !render) return;
      render(clock, dark, strength);
      last = -Infinity;
      if (!reduced.matches) handle = requestAnimationFrame(tick);
    };
    const theme = new MutationObserver(() => {
      const next = document.documentElement.classList.contains('dark');
      if (dark !== next) {
        dark = next;
        update();
      }
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const resize = () => {
      render = createRenderer(element);
      update();
    };
    document.addEventListener('visibilitychange', update);
    window.addEventListener('resize', resize);
    for (const query of [reduced, ...exclusions]) query.addEventListener('change', update);
    const cancel = afterLaunch(() => {
      ready = true;
      layer.dataset.ready = 'true';
      update();
    });
    return () => {
      cancel();
      stop();
      theme.disconnect();
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('resize', resize);
      for (const query of [reduced, ...exclusions]) query.removeEventListener('change', update);
    };
  }, [intensity]);
  return (
    <div className="ambient-water" aria-hidden="true" data-ready="false" data-paused="true">
      <canvas ref={canvas} />
    </div>
  );
}
