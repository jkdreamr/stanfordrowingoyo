import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { qk, useNotifications } from '../lib/queries';
import { setAppBadge } from '../lib/badge';
import { syncPush } from '../lib/push';

/** Keeps notifications fresh (every minute while visible), the app badge current, and push routed. */
export function NotificationSync() {
  const { data } = useNotifications(true);
  const client = useQueryClient();
  const navigate = useNavigate();
  const unread = data?.filter((n) => !n.read_at).length;
  useEffect(() => {
    if (unread !== undefined) setAppBadge(unread);
  }, [unread]);
  useEffect(() => {
    void syncPush().catch(() => {});
  }, []);
  useEffect(() => {
    const service = navigator.serviceWorker;
    if (!service) return;
    const onMessage = (event: MessageEvent) => {
      const message = event.data as { type?: string; url?: unknown } | null;
      if (message?.type === 'oyo-push')
        void client.invalidateQueries({ queryKey: qk.request('GET /api/notifications', {}) });
      if (
        message?.type === 'oyo-navigate' &&
        typeof message.url === 'string' &&
        message.url.startsWith('/')
      )
        navigate(message.url);
    };
    service.addEventListener('message', onMessage);
    return () => service.removeEventListener('message', onMessage);
  }, [client, navigate]);
  return null;
}
