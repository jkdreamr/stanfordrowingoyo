import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
export function useUnsavedChanges(dirty: boolean) {
  const allowed = useRef(false);
  const blocker = useBlocker(() => dirty && !allowed.current);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      if (allowed.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  return {
    blocker,
    allowNavigation: () => {
      allowed.current = true;
    },
  };
}
