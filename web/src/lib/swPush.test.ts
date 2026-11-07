import { expect, it } from 'vitest';
import { pushMessage } from './swPush';
it('preserves the exact announcement deep link for notification clicks', () => {
  const url = '/announcements?announcement=announcement-id';
  expect(pushMessage(JSON.stringify({ url }), 'https://oyo.test').url).toBe(url);
});
const origin = 'https://oyo.test';
it('keeps valid push payloads and clamps the badge', () => {
  expect(
    pushMessage(
      JSON.stringify({
        title: 'Avery',
        body: 'Gave kudos to 6k',
        url: '/entries/1',
        tag: 't',
        badge: 150,
      }),
      origin,
    ),
  ).toEqual({ title: 'Avery', body: 'Gave kudos to 6k', url: '/entries/1', tag: 't', badge: 99 });
});
it('falls back safely for malformed or cross-origin payloads', () => {
  expect(pushMessage('not json', origin)).toEqual({
    title: 'Stanford Rowing',
    body: '',
    url: '/notifications',
    tag: 'oyo',
    badge: 0,
  });
  expect(pushMessage(JSON.stringify({ url: 'https://evil.test/x' }), origin).url).toBe(
    '/notifications',
  );
  expect(pushMessage(JSON.stringify({ url: '//evil.test/x' }), origin).url).toBe('/notifications');
  expect(pushMessage(JSON.stringify({ url: 'javascript:alert(1)' }), origin).url).toBe(
    '/notifications',
  );
  expect(pushMessage(JSON.stringify({ badge: -2 }), origin).badge).toBe(0);
});
it('is self-contained so it can be embedded in sw.js', () => {
  const embedded = new Function(`return (${pushMessage.toString()})`)() as typeof pushMessage;
  expect(embedded('{"title":"x","url":"/announcements"}', origin)).toMatchObject({
    title: 'x',
    url: '/announcements',
  });
});
