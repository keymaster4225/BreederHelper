import { describe, expect, it } from 'vitest';
import { estimateFoalingDate } from './types';

describe('estimateFoalingDate', () => {
  it('adds 340 days to the breeding date', () => {
    // 2026-01-01 + 340 days = 2026-12-07
    expect(estimateFoalingDate('2026-01-01')).toBe('2026-12-07');
  });

  it('handles year boundary crossing', () => {
    // 2026-03-01 + 340 days = 2027-02-04
    expect(estimateFoalingDate('2026-03-01')).toBe('2027-02-04');
  });

  it('handles leap year crossing', () => {
    // 2027-05-01 + 340 days = 2028-04-05 (2028 is a leap year)
    expect(estimateFoalingDate('2027-05-01')).toBe('2028-04-05');
  });
});
