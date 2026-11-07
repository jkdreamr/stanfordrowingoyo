import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar, TabBar } from './shell/Navigation';
import { RightRail } from './shell/RightRail';
import { NotificationSync } from './NotificationSync';
export default function AppShell() {
  const task = useLocation().pathname === '/log';
  return (
    <div className={`app-shell ${task ? 'app-shell-task' : ''}`}>
      <a className="skip-link" href="#main-content">
        Skip To Content
      </a>
      <NotificationSync />
      <Sidebar />
      <main id="main-content" className="shell-content">
        <Outlet />
      </main>
      <RightRail />
      {!task && <TabBar />}
    </div>
  );
}
