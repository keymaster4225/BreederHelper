import { COLLECTION_TARGET_MODE_LABELS } from '@/models/enums';
import type { CollectionTargetMode } from '@/models/types';
import { getEffectiveCollectionTargetMode } from './collectionTargetMode';

export const TARGET_SPERM_HELPER_TEXT =
  'BreedWise stores this target in millions. Example: 1 billion sperm/dose = 1000 M.';

export const TARGET_POST_EXTENSION_RANGE_HELPER_TEXT =
  'Common shipped-cooled target: 35 M/mL. Typical planning range is 25-50 M/mL unless you are centrifuging.';

export const TOTAL_MODE_MISSING_MOTILITY_WARNING_TEXT =
  'Progressive motility is blank. Total-mode planning still works, but BreedWise cannot show progressive equivalents yet.';

export function getCollectionTargetModeLabel(
  targetMode: CollectionTargetMode | null | undefined,
): string {
  return COLLECTION_TARGET_MODE_LABELS[getEffectiveCollectionTargetMode(targetMode)];
}

export function getCollectionTargetSpermLabel(
  targetMode: CollectionTargetMode | null | undefined,
): string {
  return getEffectiveCollectionTargetMode(targetMode) === 'total'
    ? 'Target Total Sperm / Dose (M)'
    : 'Target Progressive Sperm / Dose (M)';
}

export function getCollectionTargetPostExtensionLabel(
  targetMode: CollectionTargetMode | null | undefined,
): string {
  return getEffectiveCollectionTargetMode(targetMode) === 'total'
    ? 'Target Post-Extension Total Concentration (M/mL)'
    : 'Target Post-Extension Progressive Concentration (M/mL)';
}

export function getCollectionCardTargetSpermLabel(
  targetMode: CollectionTargetMode | null | undefined,
): string {
  return getEffectiveCollectionTargetMode(targetMode) === 'total'
    ? 'Target Total / Dose'
    : 'Target Progressive / Dose';
}

export function getCollectionCardTargetPostExtensionLabel(
  targetMode: CollectionTargetMode | null | undefined,
): string {
  return getEffectiveCollectionTargetMode(targetMode) === 'total'
    ? 'Target Post-Ext Total Concentration'
    : 'Target Post-Ext Progressive Concentration';
}

export function getCollectionRawConcentrationLabel(
  targetMode: CollectionTargetMode | null | undefined,
): string {
  return getEffectiveCollectionTargetMode(targetMode) === 'total'
    ? 'Raw Total Concentration'
    : 'Raw Progressive Concentration';
}

export function getCollectionEquivalentLabel(
  targetMode: CollectionTargetMode | null | undefined,
): string {
  return getEffectiveCollectionTargetMode(targetMode) === 'total'
    ? 'Progressive Equivalent'
    : 'External Total-Sperm Equivalent';
}

export function getTargetPostExtensionRangeHelperText(
  targetMode: CollectionTargetMode | null | undefined,
): string | null {
  return getEffectiveCollectionTargetMode(targetMode) === 'total'
    ? TARGET_POST_EXTENSION_RANGE_HELPER_TEXT
    : null;
}

export function getTargetPostExtensionModeHelperText(
  targetMode: CollectionTargetMode | null | undefined,
): string {
  return getEffectiveCollectionTargetMode(targetMode) === 'total'
    ? 'BreedWise uses total sperm/mL here. If progressive motility is recorded, BreedWise will also show the progressive equivalent for comparison.'
    : 'BreedWise uses progressive sperm/mL here. If another calculator shows total sperm/mL, convert it before entering: progressive = total x (progressive motility / 100).';
}

export function formatCollectionEquivalentHelperText(args: {
  targetMode: CollectionTargetMode | null | undefined;
  equivalentConcentrationMillionsPerMl: number | null;
  progressiveMotilityPercent: number | null;
}): string | null {
  const {
    targetMode,
    equivalentConcentrationMillionsPerMl,
    progressiveMotilityPercent,
  } = args;

  if (
    equivalentConcentrationMillionsPerMl == null ||
    progressiveMotilityPercent == null
  ) {
    return null;
  }

  return getEffectiveCollectionTargetMode(targetMode) === 'total'
    ? `At ${progressiveMotilityPercent}% progressive motility, this target equals ${equivalentConcentrationMillionsPerMl.toFixed(2)} M progressive/mL.`
    : `At ${progressiveMotilityPercent}% progressive motility, this target equals ${equivalentConcentrationMillionsPerMl.toFixed(2)} M total/mL in calculators that use total sperm/mL.`;
}

export function formatCollectionEquivalentValue(args: {
  equivalentConcentrationMillionsPerMl: number | null;
  progressiveMotilityPercent: number | null;
}): string | null {
  const {
    equivalentConcentrationMillionsPerMl,
    progressiveMotilityPercent,
  } = args;

  if (
    equivalentConcentrationMillionsPerMl == null ||
    progressiveMotilityPercent == null
  ) {
    return null;
  }

  return `${equivalentConcentrationMillionsPerMl.toFixed(2)} M/mL at ${progressiveMotilityPercent}% progressive motility`;
}
