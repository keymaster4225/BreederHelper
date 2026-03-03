import { describe, expect, it } from 'vitest';
import { getScoreColors } from '@/utils/scoreColors';
import { colors } from '@/theme';

describe('getScoreColors', () => {
  it('returns score0 colors for null', () => {
    const result = getScoreColors(null);
    expect(result.backgroundColor).toBe(colors.score0);
  });

  it('returns score0 colors for N/A string', () => {
    const result = getScoreColors('N/A');
    expect(result.backgroundColor).toBe(colors.score0);
  });

  it('returns correct colors for score 1', () => {
    const result = getScoreColors(1);
    expect(result.backgroundColor).toBe(colors.score1);
    expect(result.textColor).toBe(colors.onPrimaryContainer);
  });

  it('returns correct colors for score 4', () => {
    const result = getScoreColors(4);
    expect(result.backgroundColor).toBe(colors.score4);
    expect(result.textColor).toBe('#FFFFFF');
  });

  it('returns correct colors for score 5', () => {
    const result = getScoreColors(5);
    expect(result.backgroundColor).toBe(colors.score5);
    expect(result.textColor).toBe('#FFFFFF');
  });

  it('returns score0 colors for undefined', () => {
    const result = getScoreColors(undefined);
    expect(result.backgroundColor).toBe(colors.score0);
  });

  it('returns score0 colors for dash string', () => {
    const result = getScoreColors('-');
    expect(result.backgroundColor).toBe(colors.score0);
  });

  it('returns correct colors for score 0', () => {
    const result = getScoreColors(0);
    expect(result.backgroundColor).toBe(colors.score0);
    expect(result.textColor).toBe(colors.onSurfaceVariant);
  });

  it('returns correct colors for score 2', () => {
    const result = getScoreColors(2);
    expect(result.backgroundColor).toBe(colors.score2);
    expect(result.textColor).toBe(colors.onPrimaryContainer);
  });

  it('returns correct colors for score 3', () => {
    const result = getScoreColors(3);
    expect(result.backgroundColor).toBe(colors.score3);
    expect(result.textColor).toBe(colors.onPrimaryContainer);
  });
});
