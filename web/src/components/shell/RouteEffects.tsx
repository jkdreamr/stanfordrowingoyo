import { useEffect } from 'react';
import { ScrollRestoration, useLocation } from 'react-router-dom';
export function RouteFocus() {
  const location = useLocation();
  useEffect(() => {
    const focus = () => {
      const heading = document.querySelector<HTMLElement>('main h1');
      if (!heading) return false;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      return true;
    };
    if (focus()) return;
    const observer = new MutationObserver(() => {
      if (focus()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [location.pathname]);
  return null;
}
export function RouteEffects() {
  return (
    <>
      <RouteFocus />
      <ScrollRestoration />
    </>
  );
}
