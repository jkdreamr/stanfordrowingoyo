import { useEffect, useState } from 'react';
import { useConfig, useMe, useSeasonStats, useTarget, useWeekStats } from '../lib/queries';
import { dismissSplash } from '../lib/splash';

export function LaunchSplash() {
  const { isPending, data: user } = useMe();
  const [ready, setReady] = useState(false);
  const [warm] = useState(() => location.pathname === '/');
  useEffect(() => {
    if (!isPending) setReady(true);
  }, [isPending]);
  useEffect(() => {
    if (ready) return dismissSplash();
  }, [ready]);
  // Landing on Home: fetch the Week Hero's data alongside the intro check instead of after
  // it, so the hero is more often on screen in time to receive the launch handoff.
  return warm && user && !user.must_change_password ? <WarmHome /> : null;
}

function WarmHome() {
  useConfig();
  useWeekStats();
  useTarget();
  useSeasonStats();
  return null;
}
