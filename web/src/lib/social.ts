import type {
  Announcement,
  Entry,
  WeekStats,
  Notification,
  PublicUser,
} from '../../../shared/types';

export function withTeammates(users: Pick<PublicUser, 'name'>[]): string {
  if (!users.length) return '';
  if (users.length === 1) return `with ${users[0].name}`;
  if (users.length === 2) return `with ${users[0].name} and ${users[1].name}`;
  return `with ${users[0].name} and ${users.length - 1} others`;
}

export function mentionSegments(
  body: string,
  users: Pick<PublicUser, 'id' | 'name'>[],
): { text: string; userId?: string }[] {
  const names = [...users].sort((a, b) => b.name.length - a.name.length);
  if (!names.length) return [{ text: body }];
  const escaped = names.map((u) => u.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`@(${escaped.join('|')})(?=$|\\s|\\p{P})`, 'giu');
  const result: { text: string; userId?: string }[] = [];
  let start = 0;
  for (const match of body.matchAll(pattern)) {
    const index = match.index;
    if (index > start) result.push({ text: body.slice(start, index) });
    result.push({
      text: match[0],
      userId: names.find((u) => u.name.toLocaleLowerCase() === match[1].toLocaleLowerCase())!.id,
    });
    start = index + match[0].length;
  }
  if (start < body.length || !result.length) result.push({ text: body.slice(start) });
  return result;
}

export function mentionIds(body: string, users: Pick<PublicUser, 'id' | 'name'>[]): string[] {
  return [...new Set(mentionSegments(body, users).flatMap((s) => (s.userId ? [s.userId] : [])))];
}

export function mentionQuery(body: string, caret: number) {
  const match = /(?:^|\s)@([^@\n]*)$/.exec(body.slice(0, caret));
  return match ? { query: match[1], start: caret - match[1].length - 1, end: caret } : null;
}

export function notificationVerb(kind: Notification['kind']): string {
  switch (kind) {
    case 'kudos':
      return 'gave kudos to';
    case 'comment':
      return 'commented on';
    case 'announcement':
      return 'posted an announcement';
    case 'tag':
      return 'tagged you in';
    case 'mention':
      return 'mentioned you in';
    default:
      return 'shared';
  }
}

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
