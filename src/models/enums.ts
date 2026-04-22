type LabeledOption<T extends string> = {
  label: string;
  value: T;
};

function buildOptions<T extends string>(
  values: readonly T[],
  labels: Readonly<Record<T, string>>,
): LabeledOption<T>[] {
  return values.map((value) => ({
    label: labels[value],
    value,
  }));
}

export const BREEDING_METHOD_VALUES = [
  'liveCover',
  'freshAI',
  'shippedCooledAI',
  'frozenAI',
] as const;
type BreedingMethodValue = (typeof BREEDING_METHOD_VALUES)[number];

export const BREEDING_METHOD_LABELS: Readonly<Record<BreedingMethodValue, string>> = {
  liveCover: 'Live Cover',
  freshAI: 'Fresh AI',
  shippedCooledAI: 'Shipped/Cooled AI',
  frozenAI: 'Frozen AI',
};

export const AI_BREEDING_METHOD_VALUES = [
  'freshAI',
  'shippedCooledAI',
  'frozenAI',
] as const;
type AiBreedingMethodValue = (typeof AI_BREEDING_METHOD_VALUES)[number];

const AI_BREEDING_METHOD_OPTION_LABELS: Readonly<Record<AiBreedingMethodValue, string>> = {
  freshAI: 'Fresh',
  shippedCooledAI: 'Shipped Cooled',
  frozenAI: 'Frozen',
};

export const AI_BREEDING_METHOD_OPTIONS = buildOptions(
  AI_BREEDING_METHOD_VALUES,
  AI_BREEDING_METHOD_OPTION_LABELS,
);

export const PREGNANCY_RESULT_VALUES = ['positive', 'negative'] as const;
type PregnancyResultValue = (typeof PREGNANCY_RESULT_VALUES)[number];

export const PREGNANCY_RESULT_LABELS: Readonly<Record<PregnancyResultValue, string>> = {
  positive: 'Positive',
  negative: 'Negative',
};

export const PREGNANCY_RESULT_OPTIONS = buildOptions(
  PREGNANCY_RESULT_VALUES,
  PREGNANCY_RESULT_LABELS,
);

export const FOALING_OUTCOME_VALUES = [
  'liveFoal',
  'stillbirth',
  'aborted',
  'unknown',
] as const;
type FoalingOutcomeValue = (typeof FOALING_OUTCOME_VALUES)[number];

export const FOALING_OUTCOME_LABELS: Readonly<Record<FoalingOutcomeValue, string>> = {
  liveFoal: 'Live Foal',
  stillbirth: 'Stillbirth',
  aborted: 'Aborted',
  unknown: 'Unknown',
};

export const EDITABLE_FOALING_OUTCOME_VALUES = [
  'liveFoal',
  'stillbirth',
  'aborted',
] as const;

export const FOALING_OUTCOME_OPTIONS = buildOptions(
  EDITABLE_FOALING_OUTCOME_VALUES,
  FOALING_OUTCOME_LABELS,
);

export const FOAL_SEX_VALUES = ['colt', 'filly', 'unknown'] as const;
type FoalSexValue = (typeof FOAL_SEX_VALUES)[number];

export const FOAL_SEX_LABELS: Readonly<Record<FoalSexValue, string>> = {
  colt: 'Colt',
  filly: 'Filly',
  unknown: 'Unknown',
};

export const SELECTABLE_FOAL_SEX_VALUES = ['colt', 'filly'] as const;

export const FOAL_SEX_OPTIONS = buildOptions(
  SELECTABLE_FOAL_SEX_VALUES,
  FOAL_SEX_LABELS,
);

export const FOAL_COLOR_VALUES = [
  'bay',
  'chestnut',
  'black',
  'gray',
  'palomino',
  'buckskin',
  'roan',
  'pintoPaint',
  'sorrel',
  'dun',
  'cremello',
  'other',
] as const;
type FoalColorValue = (typeof FOAL_COLOR_VALUES)[number];

export const FOAL_COLOR_LABELS: Readonly<Record<FoalColorValue, string>> = {
  bay: 'Bay',
  chestnut: 'Chestnut',
  black: 'Black',
  gray: 'Gray',
  palomino: 'Palomino',
  buckskin: 'Buckskin',
  roan: 'Roan',
  pintoPaint: 'Pinto/Paint',
  sorrel: 'Sorrel',
  dun: 'Dun',
  cremello: 'Cremello',
  other: 'Other',
};

export const FOAL_COLOR_OPTIONS = buildOptions(
  FOAL_COLOR_VALUES,
  FOAL_COLOR_LABELS,
);

export const MEDICATION_ROUTE_VALUES = [
  'oral',
  'IM',
  'IV',
  'intrauterine',
  'SQ',
] as const;
type MedicationRouteValue = (typeof MEDICATION_ROUTE_VALUES)[number];

export const MEDICATION_ROUTE_LABELS: Readonly<Record<MedicationRouteValue, string>> = {
  oral: 'Oral',
  IM: 'IM',
  IV: 'IV',
  intrauterine: 'Intrauterine',
  SQ: 'SQ',
};

export const MEDICATION_ROUTE_OPTIONS = buildOptions(
  MEDICATION_ROUTE_VALUES,
  MEDICATION_ROUTE_LABELS,
);

export const FOAL_MILESTONE_KEYS = [
  'stood',
  'nursed',
  'passedMeconium',
  'iggTested',
  'enemaGiven',
  'umbilicalTreated',
  'firstVetCheck',
] as const;
type FoalMilestoneKeyValue = (typeof FOAL_MILESTONE_KEYS)[number];

export const FOAL_MILESTONE_LABELS: Readonly<Record<FoalMilestoneKeyValue, string>> = {
  stood: 'Stood',
  nursed: 'Nursed',
  passedMeconium: 'Passed Meconium',
  iggTested: 'IgG Tested',
  enemaGiven: 'Enema Given',
  umbilicalTreated: 'Umbilical Treated',
  firstVetCheck: 'First Vet Check',
};

export const DOSE_EVENT_TYPE_VALUES = ['shipped', 'usedOnSite'] as const;
type DoseEventTypeValue = (typeof DOSE_EVENT_TYPE_VALUES)[number];

export const DOSE_EVENT_TYPE_LABELS: Readonly<Record<DoseEventTypeValue, string>> = {
  shipped: 'Shipped',
  usedOnSite: 'On-farm',
};

export const DOSE_EVENT_TYPE_OPTIONS = buildOptions(
  DOSE_EVENT_TYPE_VALUES,
  DOSE_EVENT_TYPE_LABELS,
);

export const COLLECTION_TARGET_MODE_VALUES = ['progressive', 'total'] as const;
type CollectionTargetModeValue = (typeof COLLECTION_TARGET_MODE_VALUES)[number];

export const COLLECTION_TARGET_MODE_LABELS: Readonly<
  Record<CollectionTargetModeValue, string>
> = {
  progressive: 'Progressive',
  total: 'Total',
};

export const COLLECTION_TARGET_MODE_OPTIONS = buildOptions(
  COLLECTION_TARGET_MODE_VALUES,
  COLLECTION_TARGET_MODE_LABELS,
);
