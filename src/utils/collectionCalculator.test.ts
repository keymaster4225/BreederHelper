import { describe, expect, it } from 'vitest';

import {
  convertMotileToTotalConcentrationMillionsPerMl,
  convertTotalToMotileConcentrationMillionsPerMl,
  deriveCollectionMath,
} from './collectionCalculator';

describe('collectionCalculator', () => {
  it('derives the documented motile-based sample case', () => {
    const result = deriveCollectionMath({
      rawVolumeMl: 100,
      concentrationMillionsPerMl: 200,
      progressiveMotilityPercent: 50,
      targetMotileSpermMillionsPerDose: 1000,
      targetPostExtensionConcentrationMillionsPerMl: 35,
    });

    expect(result.rawMotileConcentrationMillionsPerMl).toBe(100);
    expect(result.semenPerDoseMl).toBe(10);
    expect(result.doseVolumeMl).toBeCloseTo(28.571429, 6);
    expect(result.extenderPerDoseMl).toBeCloseTo(18.571429, 6);
    expect(result.maxDoses).toBe(10);
    expect(result.warnings).toEqual([]);
  });

  it('matches the external calculator after converting total concentration to motile concentration', () => {
    const convertedTarget = convertTotalToMotileConcentrationMillionsPerMl(35, 50);

    expect(convertedTarget).toBe(17.5);

    const result = deriveCollectionMath({
      rawVolumeMl: 100,
      concentrationMillionsPerMl: 200,
      progressiveMotilityPercent: 50,
      targetMotileSpermMillionsPerDose: 1000,
      targetPostExtensionConcentrationMillionsPerMl: convertedTarget,
    });

    expect(result.semenPerDoseMl).toBe(10);
    expect(result.doseVolumeMl).toBeCloseTo(57.142857, 6);
    expect(result.extenderPerDoseMl).toBeCloseTo(47.142857, 6);
  });

  it('omits raw motile-dependent values when motility is zero', () => {
    const result = deriveCollectionMath({
      rawVolumeMl: 100,
      concentrationMillionsPerMl: 200,
      progressiveMotilityPercent: 0,
      targetMotileSpermMillionsPerDose: 1000,
      targetPostExtensionConcentrationMillionsPerMl: 35,
    });

    expect(result.rawMotileConcentrationMillionsPerMl).toBeNull();
    expect(result.semenPerDoseMl).toBeNull();
    expect(result.doseVolumeMl).toBeCloseTo(28.571429, 6);
    expect(result.extenderPerDoseMl).toBeNull();
    expect(result.maxDoses).toBeNull();
    expect(result.warnings).toEqual([]);
  });

  it('warns when the target concentration exceeds the raw motile concentration', () => {
    const result = deriveCollectionMath({
      rawVolumeMl: 100,
      concentrationMillionsPerMl: 200,
      progressiveMotilityPercent: 50,
      targetMotileSpermMillionsPerDose: 1000,
      targetPostExtensionConcentrationMillionsPerMl: 150,
    });

    expect(result.extenderPerDoseMl).toBeCloseTo(-3.333333, 6);
    expect(result.warnings).toEqual(['negative-extender']);
  });

  it('warns when the target exceeds the collection capacity', () => {
    const result = deriveCollectionMath({
      rawVolumeMl: 5,
      concentrationMillionsPerMl: 200,
      progressiveMotilityPercent: 50,
      targetMotileSpermMillionsPerDose: 1000,
      targetPostExtensionConcentrationMillionsPerMl: 35,
    });

    expect(result.maxDoses).toBe(0.5);
    expect(result.warnings).toEqual(['target-exceeds-capacity']);
  });

  it('converts motile concentration back to an external total-sperm equivalent', () => {
    expect(convertMotileToTotalConcentrationMillionsPerMl(17.5, 50)).toBe(35);
    expect(convertMotileToTotalConcentrationMillionsPerMl(null, 50)).toBeNull();
    expect(convertMotileToTotalConcentrationMillionsPerMl(17.5, 0)).toBeNull();
  });
});
