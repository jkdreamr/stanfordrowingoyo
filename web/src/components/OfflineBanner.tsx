import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';

function subscribe(notify: () => void) {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
}
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine !== false,
    () => true,
  );
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="offline-status">
      {!online && (
        <span className="offline-status-label">
          <WifiOff size={16} strokeWidth={1.75} aria-hidden="true" />
          Offline
        </span>
      )}
    </div>
  );
}
