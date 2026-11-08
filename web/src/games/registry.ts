import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { Waves, type LucideIcon } from 'lucide-react';
import type { GameScoreDirection } from '../../../shared/types';
import { formatNumber } from '../lib/format';

export interface GameDefinition {
  id: string;
  title: string;
  icon: LucideIcon;
  accent: string;
  direction: GameScoreDirection;
  component: LazyExoticComponent<ComponentType>;
  formatScore(score: number): string;
}
export const GAMES: GameDefinition[] = [
  {
    id: 'dive',
    title: 'Dive',
    icon: Waves,
    accent: 'var(--accent-ink)',
    direction: 'higher',
    component: lazy(() => import('./DiveStart')),
    formatScore: (score) => `${formatNumber(score)} m`,
  },
];
