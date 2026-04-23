import type { CollectionTargetMode } from '@/models/types';
import { getEffectiveCollectionTargetMode } from './collectionTargetMode';

export type CollectionMathWarning =
  | 'negative-extender'
  | 'target-exceeds-capacity'
  | 'total-mode-missing-motility';

export interface CollectionMathInputs {
  rawVolumeMl: number | null;
  concentrationMillionsPerMl: number | null;
  progressiveMotilityPercent: number | null;
  targetMode: CollectionTargetMode | null;
  targetSpermMillionsPerDose: number | null;
  targetPostExtensionConcentrationMillionsPerMl: number | null;
}

export interface CollectionMathDerived {
  activeTargetMode: CollectionTargetMode;
  rawModeConcentrationMillionsPerMl: number | null;
  rawProgressiveConcentrationMillionsPerMl: number | null;
  rawTotalConcentrationMillionsPerMl: number | null;
  targetPostExtensionProgressiveEquivalentMillionsPerMl: number | null;
  targetPostExtensionTotalEquivalentMillionsPerMl: number | null;
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
  return convertTotalToProgressiveConcentrationMillionsPerMl(
    totalConcentrationMillionsPerMl,
    progressiveMotilityPercent,
  );
}

export function convertTotalToProgressiveConcentrationMillionsPerMl(
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
  progressiveConcentrationMillionsPerMl: number | null,
  progressiveMotilityPercent: number | null,
): number | null {
  return convertProgressiveToTotalConcentrationMillionsPerMl(
    progressiveConcentrationMillionsPerMl,
    progressiveMotilityPercent,
  );
}

export function convertProgressiveToTotalConcentrationMillionsPerMl(
  progressiveConcentrationMillionsPerMl: number | null,
  progressiveMotilityPercent: number | null,
): number | null {
  if (
    !isPositiveFiniteNumber(progressiveConcentrationMillionsPerMl) ||
    !isPositiveFiniteNumber(progressiveMotilityPercent)
  ) {
    return null;
  }

  return progressiveConcentrationMillionsPerMl / (progressiveMotilityPercent / 100);
}

export function deriveCollectionMath(
  input: CollectionMathInputs,
): CollectionMathDerived {
  const warnings: CollectionMathWarning[] = [];
  const activeTargetMode = getEffectiveCollectionTargetMode(input.targetMode);

  const hasTargetSperm = isPositiveFiniteNumber(
    input.targetSpermMillionsPerDose,
  );
  const hasTargetPostExtension = isPositiveFiniteNumber(
    input.targetPostExtensionConcentrationMillionsPerMl,
  );
  const hasRawConcentration = isPositiveFiniteNumber(input.concentrationMillionsPerMl);
  const hasRawVolume = isPositiveFiniteNumber(input.rawVolumeMl);
  const targetSpermMillionsPerDose = hasTargetSperm
    ? input.targetSpermMillionsPerDose
    : null;
  const targetPostExtensionConcentrationMillionsPerMl = hasTargetPostExtension
    ? input.targetPostExtensionConcentrationMillionsPerMl
    : null;
  const rawVolumeMl = hasRawVolume ? input.rawVolumeMl : null;
  const rawTotalConcentrationMillionsPerMl = hasRawConcentration
    ? input.concentrationMillionsPerMl
    : null;

  const rawProgressiveConcentrationMillionsPerMl =
    convertTotalToProgressiveConcentrationMillionsPerMl(
      rawTotalConcentrationMillionsPerMl,
      input.progressiveMotilityPercent,
    );
  const rawModeConcentrationMillionsPerMl =
    activeTargetMode === 'total'
      ? rawTotalConcentrationMillionsPerMl
      : rawProgressiveConcentrationMillionsPerMl;
  const targetPostExtensionProgressiveEquivalentMillionsPerMl =
    convertTotalToProgressiveConcentrationMillionsPerMl(
      targetPostExtensionConcentrationMillionsPerMl,
      input.progressiveMotilityPercent,
    );
  const targetPostExtensionTotalEquivalentMillionsPerMl =
    convertProgressiveToTotalConcentrationMillionsPerMl(
      targetPostExtensionConcentrationMillionsPerMl,
      input.progressiveMotilityPercent,
    );

  const semenPerDoseMl =
    rawModeConcentrationMillionsPerMl != null &&
    rawModeConcentrationMillionsPerMl > 0 &&
    targetSpermMillionsPerDose != null
      ? targetSpermMillionsPerDose / rawModeConcentrationMillionsPerMl
      : null;

  const doseVolumeMl =
    targetSpermMillionsPerDose != null &&
    targetPostExtensionConcentrationMillionsPerMl != null
      ? targetSpermMillionsPerDose /
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

  if (activeTargetMode === 'total' && input.progressiveMotilityPercent == null) {
    warnings.push('total-mode-missing-motility');
  }

  return {
    activeTargetMode,
    rawModeConcentrationMillionsPerMl,
    rawProgressiveConcentrationMillionsPerMl,
    rawTotalConcentrationMillionsPerMl,
    targetPostExtensionProgressiveEquivalentMillionsPerMl,
    targetPostExtensionTotalEquivalentMillionsPerMl,
    semenPerDoseMl,
    doseVolumeMl,
    extenderPerDoseMl,
    maxDoses,
    warnings,
  };
}
