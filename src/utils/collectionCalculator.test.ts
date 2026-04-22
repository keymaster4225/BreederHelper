import { describe, expect, it } from 'vitest';

import {
  convertProgressiveToTotalConcentrationMillionsPerMl,
  convertTotalToProgressiveConcentrationMillionsPerMl,
  deriveCollectionMath,
} from './collectionCalculator';

describe('collectionCalculator', () => {
  it('derives the documented progressive-mode sample case', () => {
    const result = deriveCollectionMath({
      rawVolumeMl: 100,
      concentrationMillionsPerMl: 200,
      progressiveMotilityPercent: 50,
      targetMode: 'progressive',
      targetSpermMillionsPerDose: 1000,
      targetPostExtensionConcentrationMillionsPerMl: 17.5,
    });

    expect(result.rawModeConcentrationMillionsPerMl).toBe(100);
    expect(result.semenPerDoseMl).toBe(10);
    expect(result.doseVolumeMl).toBeCloseTo(57.142857, 6);
    expect(result.extenderPerDoseMl).toBeCloseTo(47.142857, 6);
    expect(result.maxDoses).toBe(10);
    expect(result.warnings).toEqual([]);
    expect(result.targetPostExtensionTotalEquivalentMillionsPerMl).toBe(35);
  });

  it('derives the documented total-mode sample case', () => {
    const result = deriveCollectionMath({
      rawVolumeMl: 100,
      concentrationMillionsPerMl: 200,
      progressiveMotilityPercent: 50,
      targetMode: 'total',
      targetSpermMillionsPerDose: 1000,
      targetPostExtensionConcentrationMillionsPerMl: 35,
    });

    expect(result.rawModeConcentrationMillionsPerMl).toBe(200);
    expect(result.semenPerDoseMl).toBe(5);
    expect(result.doseVolumeMl).toBeCloseTo(28.571429, 6);
    expect(result.extenderPerDoseMl).toBeCloseTo(23.571429, 6);
    expect(result.maxDoses).toBe(20);
    expect(result.warnings).toEqual([]);
    expect(result.targetPostExtensionProgressiveEquivalentMillionsPerMl).toBe(17.5);
  });

  it('keeps total-mode math working without motility and emits a non-blocking warning', () => {
    const result = deriveCollectionMath({
      rawVolumeMl: 100,
      concentrationMillionsPerMl: 200,
      progressiveMotilityPercent: null,
      targetMode: 'total',
      targetSpermMillionsPerDose: 1000,
      targetPostExtensionConcentrationMillionsPerMl: 35,
    });

    expect(result.rawModeConcentrationMillionsPerMl).toBe(200);
    expect(result.semenPerDoseMl).toBe(5);
    expect(result.doseVolumeMl).toBeCloseTo(28.571429, 6);
    expect(result.extenderPerDoseMl).toBeCloseTo(23.571429, 6);
    expect(result.maxDoses).toBe(20);
    expect(result.targetPostExtensionProgressiveEquivalentMillionsPerMl).toBeNull();
    expect(result.warnings).toEqual(['total-mode-missing-motility']);
  });

  it.each([
    ['progressive', 150],
    ['total', 300],
  ] as const)(
    'warns when the target concentration exceeds the raw %s concentration',
    (targetMode, targetPostExtensionConcentrationMillionsPerMl) => {
      const result = deriveCollectionMath({
        rawVolumeMl: 100,
        concentrationMillionsPerMl: 200,
        progressiveMotilityPercent: 50,
        targetMode,
        targetSpermMillionsPerDose: 1000,
        targetPostExtensionConcentrationMillionsPerMl,
      });

      expect(result.extenderPerDoseMl).toBeLessThan(0);
      expect(result.warnings).toEqual(['negative-extender']);
    },
  );

  it.each(['progressive', 'total'] as const)(
    'warns when the target exceeds collection capacity in %s mode',
    (targetMode) => {
      const result = deriveCollectionMath({
        rawVolumeMl: 4,
        concentrationMillionsPerMl: 200,
        progressiveMotilityPercent: 50,
        targetMode,
        targetSpermMillionsPerDose: 1000,
        targetPostExtensionConcentrationMillionsPerMl:
          targetMode === 'total' ? 35 : 17.5,
      });

      expect(result.maxDoses).toBeLessThan(1);
      expect(result.warnings).toEqual(['target-exceeds-capacity']);
    },
  );

  it('calculates opposite-mode equivalents when motility exists', () => {
    expect(convertTotalToProgressiveConcentrationMillionsPerMl(35, 50)).toBe(17.5);
    expect(convertProgressiveToTotalConcentrationMillionsPerMl(17.5, 50)).toBe(35);
    expect(convertProgressiveToTotalConcentrationMillionsPerMl(null, 50)).toBeNull();
    expect(convertProgressiveToTotalConcentrationMillionsPerMl(17.5, 0)).toBeNull();
  });
});
