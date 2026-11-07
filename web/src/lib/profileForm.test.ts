import { expect, it } from 'vitest';
import { createFixtures } from '../mock/fixtures';
import { profileDraft, profileValues } from './profileForm';
it('keeps best splits out of profile drafts and patches', () => {
  const user = createFixtures(new Date('2026-03-16T18:00:00Z')).users[0];
  const draft = profileDraft(user);
  expect(draft).not.toHaveProperty('six');
  expect(draft).not.toHaveProperty('two');
  const { body, errors } = profileValues({ ...draft, name: ' Marcus ' });
  expect(body.name).toBe('Marcus');
  expect(errors).toEqual({});
  expect(body).not.toHaveProperty('best2k_split_s');
  expect(body).not.toHaveProperty('best6k_split_s');
  expect(profileValues({ ...draft, name: '', bio: 'x'.repeat(161) }).errors).toEqual({
    name: 'Enter a name up to 100 characters',
    bio: 'Keep your bio to 160 characters',
  });
});
