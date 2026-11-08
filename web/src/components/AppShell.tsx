import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { afterLaunch } from '../lib/motion';
import { useTabSwipe } from '../lib/useTabSwipe';
import { Sidebar, TabBar } from './shell/Navigation';
import { RightRail } from './shell/RightRail';
import { NotificationSync } from './NotificationSync';
import { PasskeyOffer } from './auth/PasskeyOffer';
import { SaveCelebration } from './ui/SaveCelebration';
export default function AppShell() {
  const task = useLocation().pathname === '/log';
  const content = useRef<HTMLElement>(null);
  useTabSwipe(content);
  // One entrance per session: once the first screen has risen in, later screens arrive
  // through the tab transition instead of replaying the staggered entrance.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = afterLaunch(() => {
      timer = setTimeout(() => {
        document.documentElement.dataset.entered = '';
      }, 900);
    });
    return () => {
      cancel();
      clearTimeout(timer);
    };
  }, []);
  return (
    <div className={`app-shell ${task ? 'app-shell-task' : ''}`}>
      <a className="skip-link" href="#main-content">
        Skip To Content
      </a>
      <NotificationSync />
      <Sidebar />
      <main ref={content} id="main-content" className="shell-content">
        <Outlet />
      </main>
      <RightRail />
      {!task && <TabBar />}
      <PasskeyOffer />
      <SaveCelebration />
    </div>
  );
}
