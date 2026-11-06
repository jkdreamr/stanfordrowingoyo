import { Bell, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../lib/queries';
import { IconButton } from '../ui';
export function HeaderActions({ settings = false }: { settings?: boolean }) {
  const navigate = useNavigate();
  const { data = [] } = useNotifications();
  const unread = data.some((n) => !n.read_at);
  return (
    <div className="flex items-center gap-1 lg:hidden">
      <IconButton
        aria-label={unread ? 'Notifications, Unread Updates' : 'Notifications'}
        onClick={() => navigate('/notifications')}
      >
        <span className="relative">
          <Bell size={20} strokeWidth={1.75} aria-hidden="true" />
          {unread && <span className="unread-dot" />}
        </span>
      </IconButton>
      {settings && (
        <IconButton aria-label="Settings" onClick={() => navigate('/settings')}>
          <Settings size={20} strokeWidth={1.75} aria-hidden="true" />
        </IconButton>
      )}
    </div>
  );
}
