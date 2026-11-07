import type {
  Announcement,
  Entry,
  WeekStats,
  Notification,
  PublicUser,
} from '../../../shared/types';

export function publicSubtitle(
  user: Pick<PublicUser, 'role' | 'side' | 'class_year' | 'group_key'>,
): string {
  if (user.role !== 'rower')
    return user.role === 'coxswain' ? 'Coxswain' : user.role === 'coach' ? 'Coach' : 'Admin';
  const groups = { frosh: 'Frosh Group', normal: 'Normal Group', u23: 'U23 Group' };
  return [
    user.side &&
      (user.side === 'both'
        ? 'Both Sides'
        : user.side === 'cox'
          ? 'Cox'
          : user.side === 'port'
            ? 'Port'
            : 'Starboard'),
    user.class_year && `Class of ${user.class_year}`,
    groups[user.group_key],
  ]
    .filter(Boolean)
    .join(' · ');
}

export function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('en-US').trim();
}

export function notificationAnnouncements(
  notification: Notification,
  announcements: Announcement[],
): Announcement[] {
  const matching = announcements
    .filter((a) => a.author_id === notification.actor_id)
    .sort(
      (a, b) =>
        Math.abs(Date.parse(a.created_at) - Date.parse(notification.created_at)) -
        Math.abs(Date.parse(b.created_at) - Date.parse(notification.created_at)),
    );
  return matching.length
    ? matching.slice(0, 1)
    : [...announcements].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function relativeTime(createdAt: string, now = Date.now()): string {
  const elapsed = Math.max(0, now - Date.parse(createdAt));
  if (!Number.isFinite(elapsed) || elapsed < 60_000) return 'just now';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return `${Math.floor(elapsed / 86_400_000)}d ago`;
}

export function hitsTarget(
  entry: Pick<Entry, 'id' | 'created_at' | 'equiv_m'>,
  stats: Pick<WeekStats, 'target_m' | 'entries'>,
): boolean {
  if (stats.target_m <= 0 || !stats.entries.some((e) => e.id === entry.id)) return false;
  const ordered = [...stats.entries].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
  let before = 0;
  for (const item of ordered) {
    if (item.id === entry.id)
      return before < stats.target_m && before + entry.equiv_m >= stats.target_m;
    before += item.equiv_m;
  }
  return false;
}

export function groupNotifications(items: Notification[]): Notification[][] {
  const groups: Notification[][] = [];
  for (const item of items) {
    const existing =
      item.kind === 'kudos'
        ? groups.find((g) => g[0].kind === 'kudos' && g[0].entry_id === item.entry_id)
        : undefined;
    if (existing) existing.push(item);
    else groups.push([item]);
  }
  return groups;
}
