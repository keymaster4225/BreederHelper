import type { Dispatch, SetStateAction } from 'react';
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

export type DailyLogWizardStepId =
  | 'basics'
  | 'rightOvary'
  | 'leftOvary'
  | 'uterus'
  | 'flush'
  | 'review';

export type DailyLogWizardStepDescriptor = {
  id: DailyLogWizardStepId;
  title: string;
};

export type DailyLogWizardOvarySide = 'right' | 'left';

export type FlushDecision = 'yes' | 'no' | null;

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

export type DailyLogWizardFlushProductDraft = {
  clientId: string;
  id?: string;
  productName: string;
  dose: string;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
};

export type DailyLogWizardFlushDraft = {
  id?: string;
  baseSolution: string;
  totalVolumeMl: string;
  notes: string;
  products: DailyLogWizardFlushProductDraft[];
  createdAt?: string;
  updatedAt?: string;
};

export type DailyLogWizardLegacyNotes = {
  rightOvary: string | null;
  leftOvary: string | null;
  uterineTone: string | null;
};

export type BasicsErrors = {
  date?: string;
  time?: string;
};

export type OvaryStepErrors = {
  measurements?: string;
};

export type UterusStepErrors = {
  dischargeNotes?: string;
  fluidPockets?: string;
  flushDecision?: string;
};

export type FlushStepErrors = {
  baseSolution?: string;
  totalVolumeMl?: string;
  products?: string;
};

export type DailyLogWizardErrors = {
  basics: BasicsErrors;
  rightOvary: OvaryStepErrors;
  leftOvary: OvaryStepErrors;
  uterus: UterusStepErrors;
  flush: FlushStepErrors;
};

export type DailyLogWizardSetErrors = Dispatch<SetStateAction<DailyLogWizardErrors>>;

export type UpsertFluidPocketInput = {
  depthMm: number;
  location: FluidLocation;
};
