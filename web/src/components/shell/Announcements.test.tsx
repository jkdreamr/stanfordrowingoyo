// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createQueryClient } from '../../lib/queryClient';
import { createMockApi } from '../../mock/handlers';
import Home from '../../pages/Home';
import { RightRail } from './RightRail';

const clients: ReturnType<typeof createQueryClient>[] = [];
beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.unstubAllGlobals();
});
for (const [name, Component] of [
  ['Home', Home],
  ['right rail', RightRail],
] as const) {
  for (const state of ['empty', 'unpinned', 'pinned', 'error'] as const) {
    it(`${name} only renders the announcement heading when pinned items exist (${state})`, async () => {
      const mock = createMockApi();
      if (state === 'empty') mock.state.announcements = [];
      else
        mock.state.announcements.forEach((item) => {
          item.pinned = state === 'pinned';
        });
      vi.stubGlobal('fetch', (url: URL, init: RequestInit) => {
        if (state === 'error' && String(url).includes('/announcements'))
          return Promise.resolve(
            Response.json({ error: { code: 'ERROR', message: 'Unavailable' } }, { status: 500 }),
          );
        return mock.handle(new Request(String(url), init));
      });
      const client = createQueryClient();
      clients.push(client);
      render(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={['/feed']}>
            <Component />
          </MemoryRouter>
        </QueryClientProvider>,
      );
      await screen.findByText(name === 'Home' ? 'Quick Log' : 'View Your Week');
      if (state === 'pinned') {
        expect(await screen.findByRole('heading', { name: 'Pinned Announcements' })).toBeTruthy();
        expect(
          await screen.findByRole('heading', { name: mock.state.announcements[0].title }),
        ).toBeTruthy();
      } else expect(screen.queryByRole('heading', { name: 'Pinned Announcements' })).toBeNull();
    });
  }
}
