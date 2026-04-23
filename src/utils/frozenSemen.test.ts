import { describe, expect, it } from 'vitest';

import {
  computeDosesAvailable,
  computeTotalSpermPerStrawMillions,
} from './frozenSemen';

describe('computeTotalSpermPerStrawMillions', () => {
  it('returns null when either input is missing', () => {
    expect(computeTotalSpermPerStrawMillions(null, 0.5)).toBeNull();
    expect(computeTotalSpermPerStrawMillions(300, null)).toBeNull();
  });

  it('returns null for invalid numeric values', () => {
    expect(computeTotalSpermPerStrawMillions(Number.NaN, 0.5)).toBeNull();
    expect(computeTotalSpermPerStrawMillions(300, Number.NaN)).toBeNull();
    expect(computeTotalSpermPerStrawMillions(-1, 0.5)).toBeNull();
    expect(computeTotalSpermPerStrawMillions(300, -0.5)).toBeNull();
  });

  it('multiplies concentration and straw volume in millions', () => {
    expect(computeTotalSpermPerStrawMillions(250, 0.5)).toBe(125);
    expect(computeTotalSpermPerStrawMillions(180, 0.25)).toBe(45);
  });
});

describe('computeDosesAvailable', () => {
  it('returns null when strawsPerDose is missing or invalid', () => {
    expect(computeDosesAvailable(20, null)).toBeNull();
    expect(computeDosesAvailable(20, 0)).toBeNull();
    expect(computeDosesAvailable(20, -1)).toBeNull();
    expect(computeDosesAvailable(20, 2.5 as never)).toBeNull();
  });

  it('returns null for invalid straw counts', () => {
    expect(computeDosesAvailable(-1, 2)).toBeNull();
    expect(computeDosesAvailable(5.5 as never, 2)).toBeNull();
  });

  it('computes full doses and leftover straws', () => {
    expect(computeDosesAvailable(24, 2)).toEqual({
      fullDoses: 12,
      leftoverStraws: 0,
    });

    expect(computeDosesAvailable(25, 2)).toEqual({
      fullDoses: 12,
      leftoverStraws: 1,
    });
  });
});
