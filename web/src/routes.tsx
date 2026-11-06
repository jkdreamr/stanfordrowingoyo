import { createBrowserRouter } from 'react-router-dom';
import AppShell from './components/AppShell';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import Log from './pages/Log';
import Feed from './pages/Feed';
import EntryDetail from './pages/EntryDetail';
import Leaderboard from './pages/Leaderboard';
import Me from './pages/Me';
import RowerProfile from './pages/RowerProfile';
import Plan from './pages/Plan';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import EditProfile from './pages/EditProfile';
import WeeklyTarget from './pages/WeeklyTarget';
import Admin from './pages/Admin';
import Roster from './pages/admin/Roster';
import Compliance from './pages/admin/Compliance';
import TeamSettings from './pages/admin/TeamSettings';
import Presets from './pages/admin/Presets';
import PlanEditor from './pages/admin/PlanEditor';
import Announcements from './pages/admin/Announcements';
import Export from './pages/admin/Export';
import AuditLog from './pages/admin/AuditLog';
export const router = createBrowserRouter([
  ...(import.meta.env.DEV
    ? [
        {
          path: '/dev/kit',
          lazy: async () => ({ Component: (await import('./pages/Kit')).default }),
        },
      ]
    : []),
  {
    element: <AppShell />,
    children: [
      { path: '/login', element: <Login /> },
      { path: '/signup', element: <Signup /> },
      { path: '/', element: <Home /> },
      { path: '/log', element: <Log /> },
      { path: '/feed', element: <Feed /> },
      { path: '/entries/:id', element: <EntryDetail /> },
      { path: '/leaderboard', element: <Leaderboard /> },
      { path: '/me', element: <Me /> },
      { path: '/users/:id', element: <RowerProfile /> },
      { path: '/plan', element: <Plan /> },
      { path: '/notifications', element: <Notifications /> },
      { path: '/settings', element: <Settings /> },
      { path: '/me/edit', element: <EditProfile /> },
      { path: '/me/target', element: <WeeklyTarget /> },
      { path: '/admin', element: <Admin /> },
      { path: '/admin/roster', element: <Roster /> },
      { path: '/admin/compliance', element: <Compliance /> },
      { path: '/admin/settings', element: <TeamSettings /> },
      { path: '/admin/presets', element: <Presets /> },
      { path: '/admin/plan', element: <PlanEditor /> },
      { path: '/admin/announcements', element: <Announcements /> },
      { path: '/admin/export', element: <Export /> },
      { path: '/admin/audit', element: <AuditLog /> },
      { path: '*', element: <p>Page not found</p> },
    ],
  },
]);
