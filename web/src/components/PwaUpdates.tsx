import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';
const reloadPage = () => window.location.reload();
export function PwaUpdates({
  enabled = import.meta.env.PROD && import.meta.env.VITE_MOCK !== '1',
  reload = reloadPage,
}: {
  enabled?: boolean;
  reload?: () => void;
}) {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const requested = useRef(false);
  const [updating, setUpdating] = useState(false);
  useEffect(() => {
    if (!enabled || !('serviceWorker' in navigator)) return;
    const service = navigator.serviceWorker;
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let worker: ServiceWorker | null = null;
    const check = () => {
      if (disposed) return;
      const candidate = registration?.waiting;
      setWaiting(
        candidate?.state === 'installed' && service.controller && candidate !== service.controller
          ? candidate
          : null,
      );
    };
    const found = () => {
      worker?.removeEventListener('statechange', check);
      worker = registration?.installing ?? registration?.waiting ?? null;
      worker?.addEventListener('statechange', check);
      check();
    };
    const changed = () => {
      check();
      if (requested.current) reload();
    };
    service.addEventListener('controllerchange', changed);
    void service
      .register('/sw.js', { updateViaCache: 'none' })
      .then((value) => {
        if (disposed) return;
        registration = value;
        registration.addEventListener('updatefound', found);
        found();
      })
      .catch(() => {});
    return () => {
      disposed = true;
      registration?.removeEventListener('updatefound', found);
      worker?.removeEventListener('statechange', check);
      service.removeEventListener('controllerchange', changed);
    };
  }, [enabled, reload]);
  return waiting ? (
    <div role="status" className="ui-update-banner">
      <span>A new version is available</span>
      <Button
        loading={updating}
        onClick={() => {
          requested.current = true;
          setUpdating(true);
          waiting.postMessage('SKIP_WAITING');
        }}
      >
        Reload
      </Button>
    </div>
  ) : null;
}
