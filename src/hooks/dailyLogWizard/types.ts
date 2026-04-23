import type {
  CervicalFirmness,
  FluidLocation,
  FollicleState,
  OvaryConsistency,
  OvaryStructure,
  UterineToneCategory,
} from '@/models/types';

export type ScoreOption = '' | '0' | '1' | '2' | '3' | '4' | '5';

export type TriStateOption = 'unknown' | 'no' | 'yes';

export type DailyLogWizardMeasurementDraft = {
  clientId: string;
  value: string;
};

export type DailyLogWizardOvaryDraft = {
  ovulation: boolean | null;
  follicleState: FollicleState | null;
  follicleMeasurements: DailyLogWizardMeasurementDraft[];
  consistency: OvaryConsistency | null;
  structures: OvaryStructure[];
};

export type DailyLogWizardFluidPocketDraft = {
  clientId: string;
  id?: string;
  depthMm: number;
  location: FluidLocation;
  createdAt?: string;
  updatedAt?: string;
};

export type DailyLogWizardUterusDraft = {
  edema: ScoreOption;
  uterineToneCategory: UterineToneCategory | null;
  cervicalFirmness: CervicalFirmness | null;
  dischargeObserved: boolean | null;
  dischargeNotes: string;
  uterineCysts: string;
  fluidPockets: DailyLogWizardFluidPocketDraft[];
};

export type DailyLogWizardLegacyNotes = {
  rightOvary: string | null;
  leftOvary: string | null;
  uterineTone: string | null;
};

export type BasicsErrors = {
  date?: string;
};

export type OvaryStepErrors = {
  measurements?: string;
};

export type UterusStepErrors = {
  dischargeNotes?: string;
  fluidPockets?: string;
};

export type DailyLogWizardErrors = {
  basics: BasicsErrors;
  rightOvary: OvaryStepErrors;
  leftOvary: OvaryStepErrors;
  uterus: UterusStepErrors;
};
