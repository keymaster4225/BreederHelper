export type UUID = string;
export type LocalDate = string; // YYYY-MM-DD
export type ISODateTime = string; // ISO-8601

export type BreedingMethod =
  | 'liveCover'
  | 'freshAI'
  | 'shippedCooledAI'
  | 'frozenAI';

export type PregnancyResult = 'positive' | 'negative';

export type FoalingOutcome = 'liveFoal' | 'stillbirth' | 'aborted' | 'unknown';

export type FoalSex = 'colt' | 'filly' | 'unknown';

export interface Mare {
  id: UUID;
  name: string;
  breed: string;
  dateOfBirth?: LocalDate | null;
  registrationNumber?: string | null;
  notes?: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt?: ISODateTime | null;
}

export interface Stallion {
  id: UUID;
  name: string;
  breed?: string | null;
  registrationNumber?: string | null;
  sire?: string | null;
  dam?: string | null;
  notes?: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt?: ISODateTime | null;
}

export interface DailyLog {
  id: UUID;
  mareId: UUID;
  date: LocalDate;
  teasingScore?: number | null; // 0-5
  rightOvary?: string | null;
  leftOvary?: string | null;
  ovulationDetected?: boolean | null;
  edema?: number | null; // 0-5
  uterineTone?: string | null;
  uterineCysts?: string | null;
  notes?: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface BreedingRecord {
  id: UUID;
  mareId: UUID;
  stallionId: UUID | null;
  stallionName?: string | null;
  date: LocalDate;
  method: BreedingMethod;
  notes?: string | null;

  // freshAI, shippedCooledAI
  volumeMl?: number | null;
  concentrationMPerMl?: number | null;
  motilityPercent?: number | null; // 0-100

  // frozenAI
  numberOfStraws?: number | null;
  strawVolumeMl?: number | null;
  strawDetails?: string | null;

  // shippedCooledAI, frozenAI
  collectionDate?: LocalDate | null;

  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface PregnancyCheck {
  id: UUID;
  mareId: UUID;
  breedingRecordId: UUID;
  date: LocalDate;
  result: PregnancyResult;
  heartbeatDetected?: boolean | null; // only valid when result = positive
  notes?: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface FoalingRecord {
  id: UUID;
  mareId: UUID;
  breedingRecordId?: UUID | null;
  date: LocalDate;
  outcome: FoalingOutcome;
  foalSex?: FoalSex | null;
  complications?: string | null;
  notes?: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface PregnancyCheckView extends PregnancyCheck {
  daysPostBreeding: number;
}

export function calculateDaysPostBreeding(
  checkDate: LocalDate,
  breedingDate: LocalDate
): number {
  const check = new Date(`${checkDate}T00:00:00`);
  const breeding = new Date(`${breedingDate}T00:00:00`);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((check.getTime() - breeding.getTime()) / msPerDay);
}

export function estimateFoalingDate(breedingDate: LocalDate): LocalDate {
  const base = new Date(`${breedingDate}T00:00:00`);
  base.setDate(base.getDate() + 340);
  return base.toISOString().slice(0, 10);
}
