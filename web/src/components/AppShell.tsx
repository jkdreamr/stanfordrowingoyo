import { NavLink, Outlet } from 'react-router-dom';
export default function AppShell() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <header>
        <h1 className="text-2xl font-semibold">Stanford Rowing OYO</h1>
        <nav className="flex flex-wrap gap-5" aria-label="Main">
          {[
            ['/', 'Home'],
            ['/feed', 'Feed'],
            ['/log', 'Log'],
            ['/leaderboard', 'Leaderboard'],
            ['/me', 'Me'],
          ].map(([to, label]) => (
            <NavLink key={to} to={to}>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mt-8">
        <Outlet />
      </main>
    </div>
  );
}
