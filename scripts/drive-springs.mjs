import { stdout } from 'node:process';
// Damped harmonic oscillator samples for CSS linear(). Output is normalized at rest.
for (const [name, stiffness, damping, duration] of [
  ['snappy', 420, 30, 380],
  ['smooth', 240, 2 * Math.sqrt(240), 520],
  ['bouncy', 260, 14, 760],
]) {
  const omega = Math.sqrt(stiffness);
  const ratio = damping / (2 * omega);
  const samples = Array.from({ length: 41 }, (_, i) => {
    const t = ((i / 40) * duration) / 1000;
    const wd = omega * Math.sqrt(1 - ratio ** 2);
    const y =
      ratio >= 1
        ? 1 - (1 + omega * t) * Math.exp(-omega * t)
        : 1 -
          Math.exp(-ratio * omega * t) *
            (Math.cos(wd * t) + ((ratio * omega) / wd) * Math.sin(wd * t));
    return i === 40 ? '1' : Number(y.toFixed(4));
  });
  stdout.write(`--spring-${name}: linear(${samples.join(', ')});\n`);
}
