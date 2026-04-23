export type CollectionMathWarning = 'negative-extender' | 'target-exceeds-capacity';

export interface CollectionMathInputs {
  rawVolumeMl: number | null;
  concentrationMillionsPerMl: number | null;
  progressiveMotilityPercent: number | null;
  targetMotileSpermMillionsPerDose: number | null;
  targetPostExtensionConcentrationMillionsPerMl: number | null;
}

export interface CollectionMathDerived {
  rawMotileConcentrationMillionsPerMl: number | null;
  semenPerDoseMl: number | null;
  doseVolumeMl: number | null;
  extenderPerDoseMl: number | null;
  maxDoses: number | null;
  warnings: readonly CollectionMathWarning[];
}

export function deriveCollectionMath(
  input: CollectionMathInputs,
): CollectionMathDerived {
  const warnings: CollectionMathWarning[] = [];

  const hasRawConcentration =
    input.concentrationMillionsPerMl != null &&
    Number.isFinite(input.concentrationMillionsPerMl) &&
    input.concentrationMillionsPerMl > 0;
  const hasMotility =
    input.progressiveMotilityPercent != null &&
    Number.isFinite(input.progressiveMotilityPercent) &&
    input.progressiveMotilityPercent > 0;
  const hasTargetMotile =
    input.targetMotileSpermMillionsPerDose != null &&
    Number.isFinite(input.targetMotileSpermMillionsPerDose) &&
    input.targetMotileSpermMillionsPerDose > 0;
  const hasTargetPostExtension =
    input.targetPostExtensionConcentrationMillionsPerMl != null &&
    Number.isFinite(input.targetPostExtensionConcentrationMillionsPerMl) &&
    input.targetPostExtensionConcentrationMillionsPerMl > 0;
  const hasRawVolume =
    input.rawVolumeMl != null &&
    Number.isFinite(input.rawVolumeMl) &&
    input.rawVolumeMl > 0;

  const rawMotileConcentrationMillionsPerMl =
    hasRawConcentration && hasMotility
      ? (input.concentrationMillionsPerMl as number) *
        ((input.progressiveMotilityPercent as number) / 100)
      : null;

  const semenPerDoseMl =
    rawMotileConcentrationMillionsPerMl != null &&
    rawMotileConcentrationMillionsPerMl > 0 &&
    hasTargetMotile
      ? (input.targetMotileSpermMillionsPerDose as number) /
        rawMotileConcentrationMillionsPerMl
      : null;

  const doseVolumeMl =
    hasTargetMotile && hasTargetPostExtension
      ? (input.targetMotileSpermMillionsPerDose as number) /
        (input.targetPostExtensionConcentrationMillionsPerMl as number)
      : null;

  const extenderPerDoseMl =
    semenPerDoseMl != null && doseVolumeMl != null
      ? doseVolumeMl - semenPerDoseMl
      : null;

  const maxDoses =
    hasRawVolume && semenPerDoseMl != null && semenPerDoseMl > 0
      ? (input.rawVolumeMl as number) / semenPerDoseMl
      : null;

  if (extenderPerDoseMl != null && extenderPerDoseMl < 0) {
    warnings.push('negative-extender');
  }

  if (maxDoses != null && maxDoses < 1) {
    warnings.push('target-exceeds-capacity');
  }

  return {
    rawMotileConcentrationMillionsPerMl,
    semenPerDoseMl,
    doseVolumeMl,
    extenderPerDoseMl,
    maxDoses,
    warnings,
  };
}
