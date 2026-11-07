// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AuthFrame } from './AuthLayout';

afterEach(cleanup);

it.each([undefined, ''])('omits the auth subtitle paragraph when it is %s', (subtitle) => {
  const { container } = render(
    <AuthFrame title="Log In" subtitle={subtitle}>
      <label>
        Email
        <input type="email" />
      </label>
    </AuthFrame>,
  );
  expect(screen.getByRole('heading', { name: 'Log In' })).toBeTruthy();
  expect(screen.getByLabelText('Email')).toBeTruthy();
  expect(container.querySelector('header p')).toBeNull();
});

it('keeps required flow instructions when provided', () => {
  render(
    <AuthFrame title="Change Your Password" subtitle="Set a new password to continue.">
      <button>Save Password</button>
    </AuthFrame>,
  );
  expect(screen.getByText('Set a new password to continue.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Save Password' })).toBeTruthy();
});
