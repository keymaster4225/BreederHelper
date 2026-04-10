import {
  BreedingRecord,
  DailyLog,
  Foal,
  FoalingRecord,
  LocalDate,
  Mare,
  MedicationLog,
  PregnancyCheck,
} from '@/models/types';

export const DUE_DATE_ALERT_WINDOW_DAYS = 30;
export const PREG_CHECK_WINDOW_MIN_DAYS = 14;
export const PREG_CHECK_WINDOW_MAX_DAYS = 18;
export const RECENT_OVULATION_WINDOW_DAYS = 2;
export const HEAT_ACTIVITY_WINDOW_DAYS = 3;
export const STALE_LOG_THRESHOLD_DAYS = 7;
export const PREGNANT_MAINTENANCE_DPO = 60;
export const MEDICATION_GAP_MIN_STREAK_DAYS = 2;
export const MEDICATION_GAP_ACTIVE_WINDOW_DAYS = 3;
export const FOAL_IGG_ALERT_WINDOW_DAYS = 2;

export type AlertPriority = 'high' | 'medium' | 'low';

export type AlertKind =
  | 'approachingDueDate'
  | 'pregnancyCheckNeeded'
  | 'recentOvulation'
  | 'heatActivity'
  | 'noRecentLog'
  | 'medicationGap'
  | 'foalNeedsIgg';

export interface DashboardAlert {
  readonly kind: AlertKind;
  readonly priority: AlertPriority;
  readonly mareId: string;
  readonly mareName: string;
  readonly title: string;
  readonly subtitle: string;
  readonly sortKey: number;
  readonly foalingRecordId?: string;
  readonly foalId?: string;
}

export interface DashboardInput {
  readonly mares: readonly Mare[];
  readonly dailyLogs: readonly DailyLog[];
  readonly breedingRecords: readonly BreedingRecord[];
  readonly pregnancyChecks: readonly PregnancyCheck[];
  readonly foalingRecords: readonly FoalingRecord[];
  readonly medicationLogs?: readonly MedicationLog[];
  readonly foals?: readonly Foal[];
  readonly today: LocalDate;
}

export const PRIORITY_ORDER: Record<AlertPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};
