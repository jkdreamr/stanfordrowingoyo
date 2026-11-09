import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { Anchor, Eye, Grid3x3, LayoutGrid, ChevronsUpDown, type LucideIcon } from 'lucide-react';
import { formatHigherLowerScore } from '../../../shared/games/higherlower';
import { formatConnectionsScore } from '../../../shared/games/connections';
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
    id: 'higherlower',
    title: 'Higher or Lower',
    icon: ChevronsUpDown,
    accent: 'var(--accent-ink)',
    direction: 'higher',
    component: lazy(() => import('./higherlower')),
    formatScore: formatHigherLowerScore,
  },
  {
    id: 'dive',
    title: 'Dive',
    icon: Anchor,
    accent: 'var(--accent-ink)',
    direction: 'higher',
    component: lazy(() => import('./DiveStart')),
    formatScore: (score) => `${formatNumber(score)} m`,
  },
  {
    id: 'wordguess',
    title: 'Word Guess',
    icon: Grid3x3,
    accent: 'var(--accent-ink)',
    direction: 'higher',
    component: lazy(() => import('./wordguess')),
    formatScore: (score) => (score ? `${7 - score} / 6` : 'X / 6'),
  },
  {
    id: 'perception',
    title: 'Perception',
    icon: Eye,
    accent: 'var(--accent-ink)',
    direction: 'higher',
    component: lazy(() => import('./perception')),
    formatScore: (score) => `${score} / 500`,
  },
  {
    id: 'connections',
    title: 'Connections',
    icon: LayoutGrid,
    accent: 'var(--accent-ink)',
    direction: 'higher',
    component: lazy(() => import('./connections')),
    formatScore: formatConnectionsScore,
  },
];
