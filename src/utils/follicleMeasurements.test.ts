import { describe, expect, it } from 'vitest';

import { sortMeasurementsDesc } from './follicleMeasurements';

describe('follicle measurement helpers', () => {
  it('sorts measurements descending without mutating the caller array', () => {
    const input = [34, 36.5, 36.5, 12];

    expect(sortMeasurementsDesc(input)).toEqual([36.5, 36.5, 34, 12]);
    expect(input).toEqual([34, 36.5, 36.5, 12]);
  });

  it('handles empty measurement arrays', () => {
    expect(sortMeasurementsDesc([])).toEqual([]);
  });
});
