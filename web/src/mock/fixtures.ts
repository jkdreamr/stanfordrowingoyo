import type {
  Announcement,
  Comment,
  Entry,
  ImageMetadata,
  Notification,
  PublicUser,
  RosterRow,
  User,
  WeeklyTarget,
} from '../../../shared/types';
import { addDays, seasonRange, today, weekStart } from '../../../shared/dates';
import { equivalentMeters, MODE_FACTORS, ZONE_FACTORS } from '../../../shared/math';
import { PRESETS } from '../../../shared/seed';
export const FIXTURE_MARKER = 'OYO_MOCK_FIXTURE_MARCUS_2026';
const ROSTER_NAMES = [
  'Marcus Albrecht',
  'Matteo Amodio',
  'Zander Auth',
  'Callen Berwick',
  'Barron Celli',
  'Tom Corbett',
  'Elliott Donovan-Davies',
  'Braun Endicott',
  'Maxim Ericson',
  'Augie Freijo',
  'Jack Frye',
  'Gabe George',
  'Jack Griffin',
  'Leopold Hainlein',
  'Ferdi Hainlein',
  'Raph Hardwick-Skottowe',
  'Hylton Harvey',
  'Theo Herzog',
  'Finn Lorgen',
  'Tony Madigan',
  'Chris Muehl',
  'Tyler Murphy',
  'Andrew Orio',
  'Tom Pakulis',
  'George Petrow',
  'John Piersma',
  'Dom Pucinelli',
  'Kalen Routley',
  'John Salvi',
  'Sandro Scalfi',
  'Luke Smith',
  'Danny Stephenson',
  'Ody Tubidis',
  'Charlie Vachris',
  'Philip Wolfensberger',
  'Kannan Alford',
  'Gabrielle Zammit',
  'Ginger Bernstein',
  'Joshua Koo',
];
export function publicUser(user: User): PublicUser {
  const result: Partial<User> = { ...user };
  delete result.email;
  delete result.must_change_password;
  return result as PublicUser;
}
export function seededRandom(seed = 1847) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export function createFixtures(now = new Date()) {
  const date = today(now);
  const currentWeek = weekStart(date);
  const start = seasonRange(date).start;
  const random = seededRandom();
  const timestamp = `${date}T12:00:00Z`;
  const users: User[] = ROSTER_NAMES.map((name, i): User => ({
    id: `user-${i + 1}`,
    name,
    email:
      i === 38 ? 'joskoo@stanford.edu' : `${name.toLowerCase().replaceAll(' ', '.')}@stanford.edu`,
    must_change_password: false,
    role: i === 38 ? 'admin' : i >= 35 ? 'coxswain' : 'rower',
    group_key: i === 0 || i >= 35 ? 'normal' : (['frosh', 'normal', 'u23'] as const)[i % 3],
    side: i >= 35 && i <= 37 ? 'cox' : i === 38 ? null : i % 2 ? 'port' : 'starboard',
    class_year: i === 38 ? null : 2027 + (i % 4),
    bio: i === 0 ? 'Extra meters, one session at a time' : '',
    avatar_image_id: null,
    best6k_split_s: i === 0 ? 112 : 108 + (i % 12),
    best2k_split_s: i === 0 ? 104 : 100 + (i % 10),
    on_leaderboard: i < 35,
    active: true,
    created_at: `${start}T12:00:00Z`,
    updated_at: timestamp,
  })).filter((_, i) => i < 29 || i === 35 || i === 36 || i === 38);
  const roster: RosterRow[] = ROSTER_NAMES.map((name, i) => ({
    id: `roster-${i + 1}`,
    name,
    email: i === 38 ? 'joskoo@stanford.edu' : null,
    role: i === 38 ? 'admin' : i >= 35 ? 'coxswain' : 'rower',
    group_key: null,
    side: i >= 35 && i <= 37 ? 'cox' : null,
    class_year: null,
    claimed_by_user_id: users.find((u) => u.name === name)?.id ?? null,
    added_by: 'user-39',
    created_at: timestamp,
  }));
  const entries: Entry[] = [];
  const imageLinks: Record<string, ImageMetadata[]> = {};
  const kudos: Record<string, { user_id: string; created_at: string }[]> = {};
  const comments: Comment[] = [];
  function add(
    user: User,
    day: string,
    distance: number,
    modality: Entry['modality'],
    zone: Entry['zone'],
    title: string,
  ) {
    const id = `entry-${entries.length + 1}`;
    const time = `${day}T${String(14 + (entries.length % 8)).padStart(2, '0')}:00:00Z`;
    entries.push({
      id,
      user_id: user.id,
      date: day,
      week_start: weekStart(day),
      modality,
      zone,
      distance_m: distance,
      mode_factor: MODE_FACTORS[modality],
      zone_factor: ZONE_FACTORS[zone],
      equiv_m: equivalentMeters(distance, modality, zone),
      title,
      notes: random() < 0.35 ? 'Steady effort with the team. Kept the rate controlled.' : '',
      visibility: 'team',
      duration_s: Math.round(
        modality === 'bike'
          ? distance * 0.12
          : modality === 'run'
            ? distance * 0.3
            : (distance / 500) * 125,
      ),
      avg_split_s: modality === 'erg' ? 125 : null,
      stroke_rate: modality === 'erg' ? 20 : null,
      avg_hr: 138 + Math.floor(random() * 20),
      preset_id: null,
      created_at: time,
      updated_at: time,
    });
    imageLinks[id] =
      random() < 0.3
        ? Array.from({ length: 1 + Math.floor(random() * 4) }, (_, n) => ({
            id: `photo-${id}-${n}`,
            owner_id: user.id,
            mime: 'image/jpeg',
            width: 960,
            height: 640,
            created_at: time,
          }))
        : [];
    kudos[id] = users
      .filter((u) => u.id !== user.id && random() < 0.12)
      .map((u) => ({ user_id: u.id, created_at: time }));
    if (random() < 0.25)
      comments.push({
        id: `comment-${comments.length + 1}`,
        entry_id: id,
        user_id: users[(entries.length + 3) % 20].id,
        body: 'Solid session, nice consistency',
        created_at: time,
      });
  }
  const historyStart = `${Number(start.slice(0, 4)) - 1}-${start.slice(5)}`;
  for (let day = historyStart; day < currentWeek; day = addDays(day, 1))
    for (const user of users.filter(
      (u) => u.role === 'rower' && (day >= start || u.id === 'user-1'),
    )) {
      if (random() > 0.48) continue;
      const preset = PRESETS[Math.floor(random() * PRESETS.length)];
      add(
        user,
        day,
        preset.distance_m || 18000,
        preset.modality,
        preset.zone,
        preset.modality === 'run'
          ? preset.distance_m === 6240
            ? 'Campus Loop'
            : 'Dish Loop'
          : preset.name,
      );
    }
  for (const [index, user] of users.filter((u) => u.role === 'rower').entries()) {
    const distances =
      index === 0
        ? [18000, 60000, 8000]
        : index % 4 === 0
          ? [30000, 60000 + (index % 3) * 15000, 20000, 30000]
          : [
              18000 + (index % 7) * 1000,
              30000 + (index % 6) * 6000,
              [6240, 8000, 10000, 12000][index % 4],
            ];
    distances.forEach((distance, n) => {
      const offset = Math.min(
        n,
        Math.round(
          (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${currentWeek}T12:00:00Z`)) / 86400000,
        ),
      );
      add(
        user,
        addDays(currentWeek, offset),
        distance,
        n === 1 ? 'bike' : n === 2 ? 'run' : 'erg',
        'E',
        n === 1
          ? `${distance / 1000}k E Bike`
          : n === 2
            ? distance === 6240
              ? 'Campus Loop'
              : `${distance / 1000}k E Run`
            : distance === 18000
              ? '3x6k E'
              : distance === 30000
                ? '3x10k E'
                : `${distance / 1000}k E Steady`,
      );
    });
  }
  const targets: WeeklyTarget[] = [
    { user_id: users[0].id, week_start: weekStart(start), target_m: 80000 },
  ];
  const announcements: Announcement[] = [
    {
      id: 'announcement-1',
      author_id: users.at(-1)!.id,
      author: publicUser(users.at(-1)!),
      title: 'This Week On The Water',
      body: 'Keep your extra work steady around team sessions. Log your meters before Sunday evening.',
      pinned: true,
      created_at: timestamp,
    },
    {
      id: 'announcement-2',
      author_id: users.at(-1)!.id,
      author: publicUser(users.at(-1)!),
      title: 'November Training',
      body: 'Choose the right zone and focus on consistent volume.',
      pinned: false,
      created_at: timestamp,
    },
  ];
  const notifications: Notification[] = [
    {
      id: 'notification-1',
      user_id: users[0].id,
      kind: 'comment',
      actor_id: users[1].id,
      actor: publicUser(users[1]),
      entry_id: entries.find((e) => e.user_id === users[0].id)?.id || null,
      entry_title: '3x6k E',
      created_at: timestamp,
      read_at: null,
    },
    {
      id: 'notification-2',
      user_id: users[0].id,
      kind: 'announcement',
      actor_id: users.at(-1)!.id,
      actor: publicUser(users.at(-1)!),
      entry_id: null,
      entry_title: null,
      created_at: timestamp,
      read_at: null,
    },
  ];
  return {
    users,
    roster,
    entries,
    imageLinks,
    kudos,
    comments,
    targets,
    announcements,
    notifications,
  };
}
