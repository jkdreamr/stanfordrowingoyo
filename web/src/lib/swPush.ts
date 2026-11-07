export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
  badge: number;
}
/** Parses a decrypted push payload into safe notification fields. Embedded verbatim in sw.js. */
export function pushMessage(text: string, origin: string): PushMessage {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>;
  } catch {
    data = {};
  }
  const str = (value: unknown, fallback: string) =>
    typeof value === 'string' && value.trim() ? value.slice(0, 200) : fallback;
  let url = '/notifications';
  try {
    const target = new URL(str(data.url, '/notifications'), origin);
    if (target.origin === origin) url = target.pathname + target.search + target.hash;
  } catch {
    url = '/notifications';
  }
  const badge = Number(data.badge);
  return {
    title: str(data.title, 'Stanford Rowing'),
    body: str(data.body, ''),
    url,
    tag: str(data.tag, 'oyo'),
    badge: Number.isInteger(badge) && badge > 0 ? Math.min(badge, 99) : 0,
  };
}
