import { colors } from '@/theme';

type BadgeColors = {
  backgroundColor: string;
  textColor: string;
};

const SCORE_MAP: Record<number, BadgeColors> = {
  0: { backgroundColor: colors.score0, textColor: colors.onSurfaceVariant },
  1: { backgroundColor: colors.score1, textColor: colors.onPrimaryContainer },
  2: { backgroundColor: colors.score2, textColor: colors.onPrimaryContainer },
  3: { backgroundColor: colors.score3, textColor: colors.onPrimaryContainer },
  4: { backgroundColor: colors.score4, textColor: '#FFFFFF' },
  5: { backgroundColor: colors.score5, textColor: '#FFFFFF' },
};

const DEFAULT_COLORS: BadgeColors = {
  backgroundColor: colors.score0,
  textColor: colors.onSurfaceVariant,
};

export function getScoreColors(score: number | string | null | undefined): BadgeColors {
  if (score == null || score === 'N/A' || score === '-') {
    return DEFAULT_COLORS;
  }
  const num = typeof score === 'string' ? parseInt(score, 10) : score;
  return SCORE_MAP[num] ?? DEFAULT_COLORS;
}
