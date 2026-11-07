import { useEffect } from 'react';
import { ScrollRestoration, useLocation, useNavigationType } from 'react-router-dom';
export function RouteFocus() {
  const location = useLocation();
  const navigation = useNavigationType();
  useEffect(() => {
    const focus = () => {
      const heading = document.querySelector<HTMLElement>('main h1');
      if (!heading) return false;
      document.title = `${heading.textContent} · Stanford OYO`;
      if (navigation === 'POP') return true;
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
  }, [location.pathname, navigation]);
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
