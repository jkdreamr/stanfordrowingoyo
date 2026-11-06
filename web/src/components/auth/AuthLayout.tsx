import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useMe } from '../../lib/queries';
import { safeNext } from '../../lib/auth';
import { ShellSkeleton } from '../shell/ShellSkeleton';
import { BrandMark } from '../shell/Brand';
import type { ReactNode } from 'react';
export function AuthLayout() {
  const { data, isPending } = useMe();
  const location = useLocation();
  const next = safeNext(location.search);
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
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-frame">
      <header className="mb-8">
        <BrandMark />
        <h1 className="mt-6 text-title1">{title}</h1>
        <p className="mt-3 text-callout text-muted">{subtitle}</p>
      </header>
      {children}
    </main>
  );
}
