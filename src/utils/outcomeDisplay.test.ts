import { describe, expect, it } from 'vitest';

import {
  formatBreedingMethod,
  formatDoseEventType,
  formatFoalColor,
  formatFoalSex,
  formatOutcome,
} from './outcomeDisplay';

describe('outcomeDisplay', () => {
  it('formats known shared enum values with the existing labels', () => {
    expect(formatDoseEventType('usedOnSite')).toBe('On-farm');
    expect(formatBreedingMethod('freshAI')).toBe('Fresh AI');
    expect(formatOutcome('unknown')).toBe('Unknown');
    expect(formatFoalColor('pintoPaint')).toBe('Pinto/Paint');
    expect(formatFoalSex('filly')).toBe('Filly');
  });

  it('preserves fallback behavior for unexpected strings', () => {
    expect(formatBreedingMethod('customMethod')).toBe('customMethod');
    expect(formatOutcome('customOutcome')).toBe('Unknown');
    expect(formatFoalColor('customColor')).toBe('customColor');
    expect(formatFoalSex('customSex')).toBe('customSex');
  });
});
