import { useEffect, useState, type CSSProperties } from 'react';
import { afterLaunch } from '../lib/motion';
import './AmbientWater.css';

export const ambientWaterConfig = { enabled: true, intensity: 1 };

export function AmbientWater({
  config = ambientWaterConfig,
}: {
  config?: typeof ambientWaterConfig;
}) {
  return config.enabled ? <Water intensity={config.intensity} /> : null;
}

function Water({ intensity }: { intensity: number }) {
  const [hidden, setHidden] = useState(() => document.hidden);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', update);
    const cancel = afterLaunch(() => setReady(true));
    return () => {
      document.removeEventListener('visibilitychange', update);
      cancel();
    };
  }, []);
  return (
    <div
      className="ambient-water"
      aria-hidden="true"
      data-paused={hidden || !ready}
      data-ready={ready}
      style={
        {
          '--ambient-intensity': Number.isFinite(intensity)
            ? Math.max(0, Math.min(1, intensity))
            : 0,
        } as CSSProperties
      }
    >
      <div className="ambient-water__field">
        <div className="ambient-water__caustic ambient-water__caustic--one" />
        <div className="ambient-water__caustic ambient-water__caustic--two" />
        <div className="ambient-water__oar" />
      </div>
    </div>
  );
}
