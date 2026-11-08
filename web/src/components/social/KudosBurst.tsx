import { useEffect, useState, type CSSProperties } from 'react';

export function KudosBurst() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setDone(true), 600);
    return () => clearTimeout(timer);
  }, []);
  if (done || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return null;
  return (
    <span className="kudos-particles" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <i
          key={i}
          style={
            {
              '--x': `${Math.cos((i * Math.PI) / 4) * 22}px`,
              '--y': `${Math.sin((i * Math.PI) / 4) * 22}px`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

export function RollingCount({ value }: { value: number }) {
  const [count, setCount] = useState({ value, previous: value });
  if (count.value !== value) setCount({ value, previous: count.value });
  return (
    <span
      key={value}
      aria-hidden="true"
      className={`kudos-count ${count.previous !== value ? 'is-changing' : ''}`}
      data-previous={count.previous}
    >
      <span>{value}</span>
    </span>
  );
}
