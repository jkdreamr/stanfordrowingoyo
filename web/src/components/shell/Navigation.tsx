import {
  Bell,
  CalendarDays,
  House,
  Newspaper,
  Plus,
  Settings,
  Shield,
  Trophy,
  User,
  type LucideIcon,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useMe, useNotifications } from '../../lib/queries';
import { Button } from '../ui';
import { Brand } from './Brand';
export const main: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Home', icon: House },
  { to: '/feed', label: 'Feed', icon: Newspaper },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/me', label: 'Me', icon: User },
];
/** Grid column of each main tab; the Log button holds column 2. */
const column = (to: string) => {
  const index = main.findIndex((tab) => tab.to === to);
  return index < 0 ? -1 : index < 2 ? index : index + 1;
};
/** Tells the content transition which way to travel before a tab change. */
export function setNavDirection(from: string, to: string) {
  const a = column(from);
  const b = column(to);
  document.documentElement.dataset.navDir =
    a < 0 || b < 0 || a === b ? 'none' : b > a ? 'forward' : 'back';
}
export function TabBar() {
  const { pathname } = useLocation();
  const active = column(pathname);
  return (
    <nav
      aria-label="Main Navigation"
      className="shell-tabbar"
      style={{ '--tab': Math.max(0, active) } as CSSProperties}
    >
      <span className={`shell-tab-indicator ${active < 0 ? 'is-hidden' : ''}`} aria-hidden="true" />
      {main.slice(0, 2).map((item) => (
        <Tab key={item.to} {...item} from={pathname} />
      ))}
      <NavLink to="/log" className="shell-log-tab" aria-label="Log Session">
        <span>
          <Plus size={24} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span>Log</span>
      </NavLink>
      {main.slice(2).map((item) => (
        <Tab key={item.to} {...item} from={pathname} />
      ))}
    </nav>
  );
}
function Tab({ to, label, icon: Icon, from }: (typeof main)[number] & { from: string }) {
  return (
    <NavLink
      end={to === '/'}
      to={to}
      viewTransition
      onClick={() => setNavDirection(from, to)}
      className={({ isActive }) => `shell-tab ${isActive ? 'is-active' : ''}`}
    >
      <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  );
}
export function Sidebar() {
  const { data: user } = useMe();
  const { data: notifications = [] } = useNotifications();
  const unread = notifications.filter((n) => !n.read_at).length;
  const links = [
    ...main,
    { to: '/plan', label: 'Plan', icon: CalendarDays },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/settings', label: 'Settings', icon: Settings },
    ...(user && user.role !== 'rower' ? [{ to: '/admin', label: 'Admin', icon: Shield }] : []),
  ];
  return (
    <aside className="shell-sidebar">
      <Link to="/" className="shell-brand-link" aria-label="Stanford OYO Home">
        <Brand />
      </Link>
      <Button to="/log" fullWidth leading={<Plus size={20} strokeWidth={1.75} />}>
        Log Session
      </Button>
      <nav aria-label="Main Navigation" className="mt-6 space-y-1">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `shell-nav-row ${isActive ? 'is-active' : ''}`}
          >
            <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
            <span className="flex-1">{label}</span>
            {to === '/notifications' && unread > 0 && (
              <span className="text-footnote text-muted" aria-label={`${unread} unread`}>
                {unread}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
