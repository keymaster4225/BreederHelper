import { describe, expect, it } from 'vitest';

import {
  formatCervicalFirmness,
  formatBreedingMethod,
  formatDoseEventType,
  formatFluidLocation,
  formatFollicleState,
  formatFoalColor,
  formatFoalSex,
  formatOvaryConsistency,
  formatOvaryStructure,
  formatOutcome,
  formatPhotoOwnerType,
  formatUterineToneCategory,
} from './outcomeDisplay';

describe('outcomeDisplay', () => {
  it('formats known shared enum values with the existing labels', () => {
    expect(formatDoseEventType('usedOnSite')).toBe('On-farm');
    expect(formatBreedingMethod('freshAI')).toBe('Fresh AI');
    expect(formatOutcome('unknown')).toBe('Unknown');
    expect(formatFoalColor('pintoPaint')).toBe('Pinto/Paint');
    expect(formatFoalSex('filly')).toBe('Filly');
    expect(formatFollicleState('measured')).toBe('Measured');
    expect(formatOvaryConsistency('firm')).toBe('Firm');
    expect(formatOvaryStructure('corpusLuteum')).toBe('Corpus Luteum');
    expect(formatUterineToneCategory('tight')).toBe('Tight');
    expect(formatCervicalFirmness('closed')).toBe('Closed');
    expect(formatFluidLocation('leftHorn')).toBe('Left Horn');
    expect(formatPhotoOwnerType('dailyLog')).toBe('Daily Log');
    expect(formatPhotoOwnerType('pregnancyCheck')).toBe('Pregnancy Check');
  });

  it('preserves fallback behavior for unexpected strings', () => {
    expect(formatBreedingMethod('customMethod')).toBe('customMethod');
    expect(formatOutcome('customOutcome')).toBe('Unknown');
    expect(formatFoalColor('customColor')).toBe('customColor');
    expect(formatFoalSex('customSex')).toBe('customSex');
  });
});
