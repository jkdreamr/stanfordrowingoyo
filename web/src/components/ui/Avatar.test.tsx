// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';

vi.mock('./ApiImage', () => ({
  ApiImage: ({ imageId, onError }: { imageId: string; onError: () => void }) => (
    <img src={`/api/images/${imageId}`} alt="" onError={onError} />
  ),
}));
afterEach(cleanup);

it.each(['api', 'src'])('falls back to initials without retrying a failed %s avatar', (kind) => {
  const props = kind === 'src' ? { src: '/missing-avatar.png' } : { imageId: 'missing-avatar' };
  const view = render(<Avatar name="Avery Example" {...props} />);
  fireEvent.error(view.container.querySelector('img')!);
  expect(screen.getByRole('img', { name: 'Avery Example' }).textContent).toBe('AE');
  view.rerender(<Avatar name="Avery Example" {...props} />);
  expect(view.container.querySelector('img')).toBeNull();
  view.rerender(<Avatar name="Avery Example" imageId="replacement-avatar" />);
  expect(view.container.querySelector('img')?.getAttribute('src')).toBe(
    '/api/images/replacement-avatar',
  );
});
it('uses initials without requesting an image when no avatar is set', () => {
  const view = render(<Avatar name="Avery Example" />);
  expect(screen.getByRole('img', { name: 'Avery Example' }).textContent).toBe('AE');
  expect(view.container.querySelector('img')).toBeNull();
});
it('assigns a stable curated hue, including for an empty name', () => {
  const view = render(<Avatar name="Avery Example" />);
  const hue = (screen.getByRole('img') as HTMLElement).style.getPropertyValue('--avatar-hue');
  expect(['205', '155', '265', '85', '185', '295']).toContain(hue);
  view.rerender(<Avatar name="Avery Example" />);
  expect((screen.getByRole('img') as HTMLElement).style.getPropertyValue('--avatar-hue')).toBe(hue);
  view.rerender(<Avatar name="" />);
  expect(screen.getByRole('img').textContent).toBe('?');
});
