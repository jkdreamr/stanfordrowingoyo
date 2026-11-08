import { useEffect, useRef } from 'react';
import { afterLaunch } from '../lib/motion';
import './AmbientWater.css';

export const ambientWaterConfig = { enabled: true, intensity: 1 };

const sine = Float32Array.from({ length: 4096 }, (_, i) => Math.sin((i * Math.PI * 2) / 4096));
const sin = (phase: number) => sine[((phase * 651.898647) | 0) & 4095];

function createRenderer(canvas: HTMLCanvasElement) {
  canvas.width = 64;
  canvas.height = Math.max(1, Math.ceil((64 * innerHeight) / innerWidth));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const image = ctx.createImageData(canvas.width, canvas.height);
  const pixels = image.data;
  const count = canvas.width * canvas.height;
  const xPhase = new Float32Array(count);
  const yPhase = new Float32Array(count);
  const diagonal = new Float32Array(count);
  const swell = new Float32Array(count);
  for (let y = 0, i = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++, i++) {
      const u = (x / canvas.width) * 7;
      const v = (y / canvas.width) * 7;
      xPhase[i] = u * 1.6;
      yPhase[i] = v * 1.35;
      diagonal[i] = (u + v) * 1.1;
      swell[i] = v * 0.35;
    }
  }
  let frame = 0;
  return (time: number, dark: boolean, intensity: number) => {
    const start = performance.now();
    const t = time * 0.00085;
    for (let i = 0, p = 0; i < count; i++, p += 4) {
      const x = xPhase[i];
      const y = yPhase[i];
      const bendX = sin(y * 0.65 + t * 0.32);
      const bendY = sin(x * 0.7 - t * 0.27);
      const wave =
        sin(x + bendX * 1.2 + t) +
        sin(y + bendY * 1.1 - t * 0.8) +
        0.55 * sin(diagonal[i] + t * 0.65) +
        0.35 * sin(swell[i] - t * 0.32);
      const pool = Math.max(0, Math.min(1, 0.5 + wave / 5.8));
      const smooth = pool * pool * (3 - 2 * pool);
      if (dark) {
        pixels[p] = 140 + 65 * smooth;
        pixels[p + 1] = 21 + 99 * smooth;
        pixels[p + 2] = 21 + 44 * smooth;
        pixels[p + 3] = Math.min(96, smooth * 96) * intensity;
      } else {
        pixels[p] = 174 + 14 * smooth;
        pixels[p + 1] = 188 - 10 * smooth;
        pixels[p + 2] = 197 - 37 * smooth;
        pixels[p + 3] = Math.min(76, (1 - smooth) * 76) * intensity;
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
