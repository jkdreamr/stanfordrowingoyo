// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { DiveAnswerResult } from '../../../../shared/types';
import { AnswerReveal } from './AnswerReveal';
import { WaterColumn } from './WaterColumn';

afterEach(cleanup);
const answer: DiveAnswerResult = {
  prompt_index: 0,
  answer: 'pomme',
  canonical: 'Apple',
  tier: 'surface',
  points: 10,
  count: 99,
  total: 99,
  hidden: false,
  gem: { answer: 'Rambutan', tier: 'gem', points: 100 },
  notable: [
    { answer: 'Apple', tier: 'surface', points: 10 },
    { answer: 'Banana', tier: 'surface', points: 10 },
    { answer: 'Orange', tier: 'surface', points: 10 },
    { answer: 'Medlar', tier: 'deep', points: 85 },
  ],
};
it('reveals the canonical, friendly tier, Pearl and two notable answers without crowd scoring', () => {
  const next = vi.fn();
  render(<AnswerReveal answer={answer} busy={false} onContinue={next} />);
  expect(screen.getByRole('heading', { name: 'Surface' })).toBeTruthy();
  expect(screen.getByText('Apple')).toBeTruthy();
  expect(screen.getByText('+10 m')).toBeTruthy();
  expect(screen.getByText('Rambutan')).toBeTruthy();
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  expect(screen.getByText('Medlar')).toBeTruthy();
  expect(screen.queryByText(/matched|99|rarity/i)).toBeNull();
  expect(screen.getByRole('button', { name: 'Continue' }).classList.contains('dive-continue')).toBe(
    true,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(next).toHaveBeenCalledOnce();
});
it('shows a playful Too Clever callout and disables Continue while refreshing', () => {
  render(
    <AnswerReveal
      answer={{ ...answer, tier: 'tooclever', points: 15 }}
      busy
      onContinue={vi.fn()}
    />,
  );
  expect(screen.getByRole('heading', { name: 'Too Clever' })).toBeTruthy();
  expect(screen.getByText('The Secret’s Out')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Continue' }).hasAttribute('disabled')).toBe(true);
});
it.each(['', 'Unknown Fruit'])('handles a miss (%j) and an empty notable list', (input) => {
  render(
    <AnswerReveal
      answer={{ ...answer, answer: input, canonical: null, tier: 'miss', points: 0, notable: [] }}
      busy={false}
      onContinue={vi.fn()}
    />,
  );
  expect(screen.getByText('Not On The List')).toBeTruthy();
  expect(screen.getByText('+0 m')).toBeTruthy();
  expect(screen.queryByRole('list')).toBeNull();
});
it('scales the reveal sink to tier points rather than the running score', () => {
  const view = render(<WaterColumn score={10} tier="surface" />);
  const shallow = view.container.querySelector('.dive-marker')!.getAttribute('style');
  expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Depth: 10 meters out of 100');
  view.rerender(<WaterColumn score={100} tier="gem" />);
  expect(view.container.querySelector('.dive-marker')!.getAttribute('style')).not.toBe(shallow);
  expect(view.container.querySelector('.dive-marker-sinking')).toBeTruthy();
  view.rerender(<WaterColumn score={0} tier="miss" />);
  expect(view.container.querySelector('.dive-marker-sinking')).toBeNull();
});
