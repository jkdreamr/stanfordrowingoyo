import { createMockApi } from './handlers';
import { FIXTURE_MARKER } from './fixtures';
const key = 'oyo-mock-session';
let session: string | null = 'user-1';
try {
  const saved = localStorage.getItem(key);
  if (saved !== null) session = saved || null;
} catch {
  /* Storage may be unavailable */
}
const mock = createMockApi({
  session,
  onSession: (id) => {
    try {
      localStorage.setItem(key, id || '');
    } catch {
      /* Keep the session in memory */
    }
  },
});
const original = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/'))
    return original(input, init);
  const request = new Request(input instanceof Request ? input : url, init);
  await new Promise<void>((resolve, reject) => {
    if (request.signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(
      () => {
        request.signal.removeEventListener('abort', abort);
        resolve();
      },
      150 + Math.floor(Math.random() * 151),
    );
    request.signal.addEventListener('abort', abort, { once: true });
  });
  return mock.handle(request);
};
console.info(`OYO mock mode is on (${FIXTURE_MARKER})`);
