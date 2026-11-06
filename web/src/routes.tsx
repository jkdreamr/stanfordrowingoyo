import { createBrowserRouter } from 'react-router-dom';
import AppShell from './components/AppShell';
import Page0 from './pages/Login';
import Page1 from './pages/Signup';
import Page2 from './pages/Home';
import Page3 from './pages/Log';
import Page4 from './pages/Feed';
import Page5 from './pages/EntryDetail';
import Page6 from './pages/Leaderboard';
import Page7 from './pages/Me';
import Page8 from './pages/RowerProfile';
import Page9 from './pages/Plan';
import Page10 from './pages/Notifications';
import Page11 from './pages/Settings';
import Page12 from './pages/EditProfile';
import Page13 from './pages/WeeklyTarget';
import Page14 from './pages/Admin';
import Page15 from './pages/admin/Roster';
import Page16 from './pages/admin/Compliance';
import Page17 from './pages/admin/TeamSettings';
import Page18 from './pages/admin/Presets';
import Page19 from './pages/admin/PlanEditor';
import Page20 from './pages/admin/Announcements';
import Page21 from './pages/admin/Export';
import Page22 from './pages/admin/AuditLog';
export const router = createBrowserRouter([{ element: <AppShell />, children: [
{ path: '/login', element: <Page0 /> },
{ path: '/signup', element: <Page1 /> },
{ path: '/', element: <Page2 /> },
{ path: '/log', element: <Page3 /> },
{ path: '/feed', element: <Page4 /> },
{ path: '/entries/:id', element: <Page5 /> },
{ path: '/leaderboard', element: <Page6 /> },
{ path: '/me', element: <Page7 /> },
{ path: '/users/:id', element: <Page8 /> },
{ path: '/plan', element: <Page9 /> },
{ path: '/notifications', element: <Page10 /> },
{ path: '/settings', element: <Page11 /> },
{ path: '/me/edit', element: <Page12 /> },
{ path: '/me/target', element: <Page13 /> },
{ path: '/admin', element: <Page14 /> },
{ path: '/admin/roster', element: <Page15 /> },
{ path: '/admin/compliance', element: <Page16 /> },
{ path: '/admin/settings', element: <Page17 /> },
{ path: '/admin/presets', element: <Page18 /> },
{ path: '/admin/plan', element: <Page19 /> },
{ path: '/admin/announcements', element: <Page20 /> },
{ path: '/admin/export', element: <Page21 /> },
{ path: '/admin/audit', element: <Page22 /> },
{ path: '*', element: <p>Page not found</p> }
] }]);
