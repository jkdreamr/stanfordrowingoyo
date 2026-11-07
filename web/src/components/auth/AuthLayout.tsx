import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useMe } from '../../lib/queries';
import { safeNext } from '../../lib/auth';
import { ShellSkeleton } from '../shell/ShellSkeleton';
import { BrandMark } from '../shell/Brand';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
export function AuthLayout() {
  const { data, isPending } = useMe();
  const location = useLocation();
  const next = safeNext(location.search);
  if (location.pathname === '/login' && typeof location.state?.passwordError === 'string')
    return <Outlet />;
  if (isPending) return <ShellSkeleton />;
  if (data)
    return (
      <Navigate
        to={data.must_change_password ? `/change-password?next=${encodeURIComponent(next)}` : next}
        replace
      />
    );
  return <Outlet />;
}
export function AuthFrame({
  title,
  subtitle,
  children,
  leading,
  action,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  leading?: ReactNode;
  action?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const hasAction = !!action;
  useEffect(() => {
    const frame = ref.current;
    if (!hasAction || !frame) return;
    const viewport = window.visualViewport;
    let animation = 0;
    const update = () => {
      if (viewport) {
        frame.style.setProperty('--auth-viewport-height', `${viewport.height}px`);
        frame.style.setProperty('--auth-viewport-top', `${viewport.offsetTop}px`);
      }
      cancelAnimationFrame(animation);
      animation = requestAnimationFrame(() => {
        const focused = document.activeElement;
        if (
          focused instanceof HTMLElement &&
          frame.contains(focused) &&
          focused.matches('input:not([type="radio"]):not([type="checkbox"]), textarea')
        )
          focused.scrollIntoView({ block: 'nearest' });
      });
    };
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    frame.addEventListener('focusin', update);
    return () => {
      cancelAnimationFrame(animation);
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      frame.removeEventListener('focusin', update);
    };
  }, [hasAction]);
  return (
    <main ref={ref} className={`auth-frame${hasAction ? ' auth-flow' : ''}`}>
      <div className={hasAction ? 'auth-scroll' : undefined}>
        <header className="mb-8">
          {leading && <div className="mb-4">{leading}</div>}
          <BrandMark />
          <h1 className="mt-6 text-title1">{title}</h1>
          <p className="mt-3 text-callout text-muted">{subtitle}</p>
        </header>
        {children}
      </div>
      {action && <div className="auth-actions">{action}</div>}
    </main>
  );
}
