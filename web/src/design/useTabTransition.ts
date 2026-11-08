import { useLocation } from 'react-router-dom';

export const driveTabs = ['/', '/feed', '/log', '/leaderboard', '/me'];
export function useTabTransition(to: string) {
  const { pathname } = useLocation();
  return tabTransition(pathname, to);
}
export function tabTransition(pathname: string, to: string) {
  const fromIndex = driveTabs.indexOf(pathname);
  const toIndex = driveTabs.indexOf(to);
  const enabled =
    fromIndex >= 0 &&
    toIndex >= 0 &&
    fromIndex !== toIndex &&
    typeof document.startViewTransition === 'function' &&
    typeof matchMedia === 'function' &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    viewTransition: enabled,
    onClick: () => {
      if (enabled)
        document.documentElement.style.setProperty(
          '--tab-direction',
          toIndex > fromIndex ? '1' : '-1',
        );
    },
  };
}
