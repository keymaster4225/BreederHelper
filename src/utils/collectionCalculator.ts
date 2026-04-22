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

function isPositiveFiniteNumber(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0;
}

export function convertTotalToMotileConcentrationMillionsPerMl(
  totalConcentrationMillionsPerMl: number | null,
  progressiveMotilityPercent: number | null,
): number | null {
  if (
    !isPositiveFiniteNumber(totalConcentrationMillionsPerMl) ||
    !isPositiveFiniteNumber(progressiveMotilityPercent)
  ) {
    return null;
  }

  return totalConcentrationMillionsPerMl * (progressiveMotilityPercent / 100);
}

export function convertMotileToTotalConcentrationMillionsPerMl(
  motileConcentrationMillionsPerMl: number | null,
  progressiveMotilityPercent: number | null,
): number | null {
  if (
    !isPositiveFiniteNumber(motileConcentrationMillionsPerMl) ||
    !isPositiveFiniteNumber(progressiveMotilityPercent)
  ) {
    return null;
  }

  return motileConcentrationMillionsPerMl / (progressiveMotilityPercent / 100);
}

export function deriveCollectionMath(
  input: CollectionMathInputs,
): CollectionMathDerived {
  const warnings: CollectionMathWarning[] = [];

  const hasTargetMotile = isPositiveFiniteNumber(
    input.targetMotileSpermMillionsPerDose,
  );
  const hasTargetPostExtension = isPositiveFiniteNumber(
    input.targetPostExtensionConcentrationMillionsPerMl,
  );
  const hasRawVolume = isPositiveFiniteNumber(input.rawVolumeMl);
  const targetMotileSpermMillionsPerDose = hasTargetMotile
    ? input.targetMotileSpermMillionsPerDose
    : null;
  const targetPostExtensionConcentrationMillionsPerMl = hasTargetPostExtension
    ? input.targetPostExtensionConcentrationMillionsPerMl
    : null;
  const rawVolumeMl = hasRawVolume ? input.rawVolumeMl : null;

  const rawMotileConcentrationMillionsPerMl =
    convertTotalToMotileConcentrationMillionsPerMl(
      input.concentrationMillionsPerMl,
      input.progressiveMotilityPercent,
    );

  const semenPerDoseMl =
    rawMotileConcentrationMillionsPerMl != null &&
    rawMotileConcentrationMillionsPerMl > 0 &&
    targetMotileSpermMillionsPerDose != null
      ? targetMotileSpermMillionsPerDose / rawMotileConcentrationMillionsPerMl
      : null;

  const doseVolumeMl =
    targetMotileSpermMillionsPerDose != null &&
    targetPostExtensionConcentrationMillionsPerMl != null
      ? targetMotileSpermMillionsPerDose /
        targetPostExtensionConcentrationMillionsPerMl
      : null;

  const extenderPerDoseMl =
    semenPerDoseMl != null && doseVolumeMl != null
      ? doseVolumeMl - semenPerDoseMl
      : null;

  const maxDoses =
    rawVolumeMl != null && semenPerDoseMl != null && semenPerDoseMl > 0
      ? rawVolumeMl / semenPerDoseMl
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
