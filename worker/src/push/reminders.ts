import { today, TIME_ZONE } from '../../../shared/dates';
import { byId, type UserRow } from '../db/users';
import { oyoGameAccess } from '../games/access';
import { schedulePush } from './deliver';

export function reminderEligible(storage: DurableObjectStorage, id: string, date: string) {
  const user = byId(storage, id);
  return (
    !!user &&
    !!user.active &&
    user.role === 'rower' &&
    !!user.evening_reminder &&
    oyoGameAccess(storage, user, date).reason === 'locked'
  );
}

export async function enqueueReminders(storage: DurableObjectStorage, now: Date) {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now);
  if (hour !== '19') return;
  const date = today(now);
  storage.transactionSync(() => {
    const users = storage.sql
      .exec<UserRow>(
        `SELECT u.* FROM users u
      WHERE u.active=1 AND u.role='rower' AND u.evening_reminder=1
      AND EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id=u.id)
      AND NOT EXISTS (SELECT 1 FROM reminder_sends r WHERE r.user_id=u.id AND r.date=?)`,
        date,
      )
      .toArray();
    for (const user of users) {
      if (oyoGameAccess(storage, user, date).reason !== 'locked') continue;
      storage.sql.exec(
        'INSERT OR IGNORE INTO reminder_sends (user_id,date) VALUES (?,?)',
        user.id,
        date,
      );
      storage.sql.exec(
        `INSERT INTO push_outbox (notification_id,endpoint,next_at,reminder_date)
        SELECT ?,endpoint,?,? FROM push_subscriptions WHERE user_id=?`,
        'reminder:' + user.id,
        now.getTime(),
        date,
        user.id,
      );
    }
  });
  await schedulePush(storage);
}
