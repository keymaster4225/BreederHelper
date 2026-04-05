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

export type MedicationRoute = 'oral' | 'IM' | 'IV' | 'intrauterine' | 'SQ';

export interface MedicationLog {
  id: UUID;
  mareId: UUID;
  date: LocalDate;
  medicationName: string;
  dose: string | null;
  route: MedicationRoute | null;
  notes: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type FoalColor =
  | 'bay'
  | 'chestnut'
  | 'black'
  | 'gray'
  | 'palomino'
  | 'buckskin'
  | 'roan'
  | 'pintoPaint'
  | 'sorrel'
  | 'dun'
  | 'cremello'
  | 'other';

export type FoalMilestoneKey =
  | 'stood'
  | 'nursed'
  | 'passedMeconium'
  | 'iggTested'
  | 'enemaGiven'
  | 'umbilicalTreated'
  | 'firstVetCheck';

export interface FoalMilestoneEntry {
  done: boolean;
  recordedAt?: ISODateTime | null;
}

export type FoalMilestones = Partial<Record<FoalMilestoneKey, FoalMilestoneEntry>>;

export type IggInterpretation = 'adequate' | 'partialFailure' | 'completeFailure';

export interface IggTest {
  readonly date: LocalDate;
  readonly valueMgDl: number;
  readonly recordedAt: ISODateTime;
}

export interface Foal {
  id: UUID;
  foalingRecordId: UUID;
  name?: string | null;
  sex?: FoalSex | null;
  color?: FoalColor | null;
  markings?: string | null;
  birthWeightLbs?: number | null;
  milestones: FoalMilestones;
  iggTests: readonly IggTest[];
  notes?: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

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
  dateOfBirth?: LocalDate | null;
  avTemperatureF?: number | null;
  avType?: string | null;
  avLinerType?: string | null;
  avWaterVolumeMl?: number | null;
  avNotes?: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt?: ISODateTime | null;
}

export interface SemenCollection {
  id: UUID;
  stallionId: UUID;
  collectionDate: LocalDate;
  rawVolumeMl?: number | null;
  extendedVolumeMl?: number | null;
  concentrationMillionsPerMl?: number | null;
  progressiveMotilityPercent?: number | null;
  doseCount?: number | null;
  doseSizeMillions?: number | null;
  shipped?: boolean | null;
  shippedTo?: string | null;
  notes?: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
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
  collectionId?: UUID | null;
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
  const check = new Date(`${checkDate}T00:00:00Z`);
  const breeding = new Date(`${breedingDate}T00:00:00Z`);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((check.getTime() - breeding.getTime()) / msPerDay);
}

export function estimateFoalingDate(breedingDate: LocalDate): LocalDate {
  const base = new Date(`${breedingDate}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + 340);
  return base.toISOString().slice(0, 10);
}

export function findMostRecentOvulationDate(
  dailyLogs: DailyLog[],
  onOrBeforeDate: LocalDate
): LocalDate | null {
  let result: LocalDate | null = null;
  for (const log of dailyLogs) {
    if (log.ovulationDetected && log.date <= onOrBeforeDate) {
      if (result === null || log.date > result) {
        result = log.date;
      }
    }
  }
  return result;
}

export interface PregnancyInfo {
  daysPostOvulation: number | null;
  estimatedDueDate: LocalDate | null;
}

function comparePregnancyChecksDesc(a: PregnancyCheck, b: PregnancyCheck): number {
  return (
    b.date.localeCompare(a.date) ||
    b.updatedAt.localeCompare(a.updatedAt) ||
    b.createdAt.localeCompare(a.createdAt) ||
    b.id.localeCompare(a.id)
  );
}

export function findCurrentPregnancyCheck(
  pregnancyChecks: PregnancyCheck[],
  foalingRecords: FoalingRecord[]
): PregnancyCheck | null {
  const sorted = [...pregnancyChecks].sort(comparePregnancyChecksDesc);
  const latestCheck = sorted[0];

  if (!latestCheck || latestCheck.result !== 'positive') {
    return null;
  }

  const foaledAfterCheck = foalingRecords.some((record) => record.date >= latestCheck.date);
  return foaledAfterCheck ? null : latestCheck;
}

export function buildPregnancyInfoForCheck(
  check: PregnancyCheck,
  dailyLogs: DailyLog[],
  breedingRecord: BreedingRecord | null,
  today: LocalDate
): PregnancyInfo {
  const ovulationDate = findMostRecentOvulationDate(dailyLogs, check.date);

  return {
    daysPostOvulation: ovulationDate ? calculateDaysPostBreeding(today, ovulationDate) : null,
    estimatedDueDate: breedingRecord ? estimateFoalingDate(breedingRecord.date) : null,
  };
}
