import { useEffect, useState } from 'react';
import { useMe } from '../lib/queries';
import { dismissSplash } from '../lib/splash';

export function LaunchSplash() {
  const { isPending } = useMe();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!isPending) setReady(true);
  }, [isPending]);
  useEffect(() => {
    if (ready) return dismissSplash();
  }, [ready]);
  return null;
}
