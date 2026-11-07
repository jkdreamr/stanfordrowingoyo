import { Outlet, useLocation } from 'react-router-dom';
import { useRef } from 'react';
import { useTabSwipe } from '../lib/useTabSwipe';
import { Sidebar, TabBar } from './shell/Navigation';
import { RightRail } from './shell/RightRail';
export default function AppShell() {
  const task = useLocation().pathname === '/log';
  const content = useRef<HTMLElement>(null);
  useTabSwipe(content);
  return (
    <div className={`app-shell ${task ? 'app-shell-task' : ''}`}>
      <a className="skip-link" href="#main-content">
        Skip To Content
      </a>
      <Sidebar />
      <main ref={content} id="main-content" className="shell-content">
        <Outlet />
      </main>
      <RightRail />
      {!task && <TabBar />}
    </div>
  );
}
