import type { CollectionTargetMode } from '@/models/types';

export const DEFAULT_COLLECTION_TARGET_MODE: CollectionTargetMode = 'progressive';

function hasTargetValue(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0;
}

export function getEffectiveCollectionTargetMode(
  targetMode: CollectionTargetMode | null | undefined,
): CollectionTargetMode {
  return targetMode ?? DEFAULT_COLLECTION_TARGET_MODE;
}

export function getPersistedCollectionTargetMode(args: {
  targetMode: CollectionTargetMode | null | undefined;
  targetSpermMillionsPerDose: number | null | undefined;
  targetPostExtensionConcentrationMillionsPerMl: number | null | undefined;
}): CollectionTargetMode | null {
  // `null` is only canonical when both target fields are absent. Once either
  // target exists, the stored mode must be explicit, and legacy rows missing a
  // mode are normalized to `progressive`.
  const {
    targetMode,
    targetSpermMillionsPerDose,
    targetPostExtensionConcentrationMillionsPerMl,
  } = args;

  if (
    !hasTargetValue(targetSpermMillionsPerDose) &&
    !hasTargetValue(targetPostExtensionConcentrationMillionsPerMl)
  ) {
    return null;
  }

  return getEffectiveCollectionTargetMode(targetMode);
}
