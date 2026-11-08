import { useEffect, useState } from 'react';
import { useMe, useConfig, useWeekStats, useTarget } from '../lib/queries';
import { dismissSplash } from '../lib/splash';

export function LaunchSplash() {
  const { isPending, data: user } = useMe();
  const [ready, setReady] = useState<{ waitForHome: boolean }>();
  useEffect(() => {
    if (!isPending)
      setReady(
        (current) =>
          current ?? {
            waitForHome: !!user && !user.must_change_password && location.pathname === '/',
          },
      );
  }, [isPending, user]);
  useEffect(() => {
    if (ready) return dismissSplash(ready);
  }, [ready]);
  return user && !user.must_change_password && location.pathname === '/' ? <WarmHome /> : null;
}

function WarmHome() {
  useConfig();
  useWeekStats();
  useTarget();
  return null;
}
