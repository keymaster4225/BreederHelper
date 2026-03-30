import {
  BreedingRecord,
  DailyLog,
  Foal,
  FoalingRecord,
  LocalDate,
  Mare,
  MedicationLog,
  PregnancyCheck,
  calculateDaysPostBreeding,
  estimateFoalingDate,
  findCurrentPregnancyCheck,
} from '@/models/types';

import { formatLocalDate } from '@/utils/dates';

// --- Constants ---

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

// --- Types ---

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

// --- Helpers ---

const PRIORITY_ORDER: Record<AlertPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function groupByMareId<T extends { mareId: string }>(
  records: readonly T[]
): ReadonlyMap<string, readonly T[]> {
  const map = new Map<string, T[]>();
  for (const record of records) {
    const existing = map.get(record.mareId);
    if (existing) {
      existing.push(record);
    } else {
      map.set(record.mareId, [record]);
    }
  }
  return map;
}

function daysBetween(dateA: LocalDate, dateB: LocalDate): number {
  return calculateDaysPostBreeding(dateA, dateB);
}

// --- Alert generators ---

function checkApproachingDueDate(
  mare: Mare,
  pregnancyChecks: readonly PregnancyCheck[],
  foalingRecords: readonly FoalingRecord[],
  breedingRecords: readonly BreedingRecord[],
  today: LocalDate
): DashboardAlert | null {
  const currentCheck = findCurrentPregnancyCheck(
    [...pregnancyChecks],
    [...foalingRecords]
  );
  if (!currentCheck) return null;

  const breeding = breedingRecords.find(
    (br) => br.id === currentCheck.breedingRecordId
  );
  if (!breeding) return null;

  const dueDate = estimateFoalingDate(breeding.date);
  const daysUntilDue = daysBetween(dueDate, today);

  if (daysUntilDue > DUE_DATE_ALERT_WINDOW_DAYS) return null;

  const formattedDue = formatLocalDate(dueDate, 'MM-DD-YYYY');

  const title =
    daysUntilDue < 0
      ? `Overdue by ${Math.abs(daysUntilDue)} days`
      : daysUntilDue === 0
        ? 'Due today'
        : `Due in ${daysUntilDue} days`;

  return {
    kind: 'approachingDueDate',
    priority: 'high',
    mareId: mare.id,
    mareName: mare.name,
    title,
    subtitle: `Est. due ${formattedDue}`,
    sortKey: daysUntilDue,
  };
}

function checkPregnancyCheckNeeded(
  mare: Mare,
  pregnancyChecks: readonly PregnancyCheck[],
  foalingRecords: readonly FoalingRecord[],
  breedingRecords: readonly BreedingRecord[],
  today: LocalDate
): DashboardAlert | null {
  // If mare is already confirmed pregnant, no check needed
  const currentCheck = findCurrentPregnancyCheck(
    [...pregnancyChecks],
    [...foalingRecords]
  );
  if (currentCheck) return null;

  // Find the most recent breeding
  const sortedBreedings = [...breedingRecords].sort((a, b) =>
    b.date.localeCompare(a.date)
  );
  const latestBreeding = sortedBreedings[0];
  if (!latestBreeding) return null;

  // Check if a pregnancy check already exists for this breeding
  const hasCheckForBreeding = pregnancyChecks.some(
    (pc) => pc.breedingRecordId === latestBreeding.id
  );
  if (hasCheckForBreeding) return null;

  const daysPost = daysBetween(today, latestBreeding.date);
  if (daysPost < PREG_CHECK_WINDOW_MIN_DAYS) return null;

  const stallionInfo = latestBreeding.stallionName
    ? ` (${latestBreeding.stallionName})`
    : '';

  return {
    kind: 'pregnancyCheckNeeded',
    priority: 'high',
    mareId: mare.id,
    mareName: mare.name,
    title: `Day ${daysPost} post-breeding`,
    subtitle: `Preg check due${stallionInfo}`,
    sortKey: -daysPost, // most overdue first (higher daysPost = lower sortKey)
  };
}

function checkRecentOvulation(
  mare: Mare,
  dailyLogs: readonly DailyLog[],
  today: LocalDate
): DashboardAlert | null {
  const sortedLogs = [...dailyLogs].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  // Find the most recent ovulation within the window
  let ovulationLog: DailyLog | null = null;
  for (const log of sortedLogs) {
    if (!log.ovulationDetected) continue;
    const daysAgo = daysBetween(today, log.date);
    if (daysAgo <= RECENT_OVULATION_WINDOW_DAYS) {
      ovulationLog = log;
      break; // most recent first
    }
  }

  if (!ovulationLog) return null;

  // Check if there's a follow-up log after the ovulation
  const hasFollowUp = sortedLogs.some(
    (log) => log.date > ovulationLog!.date
  );
  if (hasFollowUp) return null;

  const formattedDate = formatLocalDate(ovulationLog.date, 'MM-DD-YYYY');

  return {
    kind: 'recentOvulation',
    priority: 'medium',
    mareId: mare.id,
    mareName: mare.name,
    title: `Ovulated on ${formattedDate}`,
    subtitle: 'Confirm with ultrasound',
    sortKey: daysBetween(today, ovulationLog.date),
  };
}

function checkHeatActivity(
  mare: Mare,
  dailyLogs: readonly DailyLog[],
  today: LocalDate
): DashboardAlert | null {
  const sortedLogs = [...dailyLogs].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  // Find the most recent high-heat log within the window
  let heatLog: DailyLog | null = null;
  for (const log of sortedLogs) {
    const daysAgo = daysBetween(today, log.date);
    if (daysAgo > HEAT_ACTIVITY_WINDOW_DAYS) break;

    const highTeasing =
      log.teasingScore !== null &&
      log.teasingScore !== undefined &&
      log.teasingScore >= 4;
    const highEdema =
      log.edema !== null && log.edema !== undefined && log.edema >= 4;

    if (highTeasing || highEdema) {
      heatLog = log;
      break;
    }
  }

  if (!heatLog) return null;

  // Check if ovulation was already detected on or after the heat log
  const hasOvulation = sortedLogs.some(
    (log) => log.ovulationDetected && log.date >= heatLog!.date
  );
  if (hasOvulation) return null;

  const parts: string[] = [];
  if (
    heatLog.teasingScore !== null &&
    heatLog.teasingScore !== undefined &&
    heatLog.teasingScore >= 4
  ) {
    parts.push(`Teasing ${heatLog.teasingScore}/5`);
  }
  if (
    heatLog.edema !== null &&
    heatLog.edema !== undefined &&
    heatLog.edema >= 4
  ) {
    parts.push(`Edema ${heatLog.edema}/5`);
  }

  return {
    kind: 'heatActivity',
    priority: 'medium',
    mareId: mare.id,
    mareName: mare.name,
    title: parts.join(', '),
    subtitle: 'May be approaching ovulation',
    sortKey: -(heatLog.teasingScore ?? heatLog.edema ?? 0), // highest score first
  };
}

function checkNoRecentLog(
  mare: Mare,
  dailyLogs: readonly DailyLog[],
  pregnancyChecks: readonly PregnancyCheck[],
  foalingRecords: readonly FoalingRecord[],
  breedingRecords: readonly BreedingRecord[],
  today: LocalDate
): DashboardAlert | null {
  // Check if mare is pregnant past maintenance threshold
  const currentCheck = findCurrentPregnancyCheck(
    [...pregnancyChecks],
    [...foalingRecords]
  );
  if (currentCheck) {
    const breeding = breedingRecords.find(
      (br) => br.id === currentCheck.breedingRecordId
    );
    if (breeding) {
      const daysPostBreeding = daysBetween(today, breeding.date);
      if (daysPostBreeding >= PREGNANT_MAINTENANCE_DPO) return null;
    }
  }

  if (dailyLogs.length === 0) {
    return {
      kind: 'noRecentLog',
      priority: 'low',
      mareId: mare.id,
      mareName: mare.name,
      title: 'No logs recorded',
      subtitle: 'Start tracking this mare',
      sortKey: -Infinity, // no logs = most neglected
    };
  }

  const sortedLogs = [...dailyLogs].sort((a, b) =>
    b.date.localeCompare(a.date)
  );
  const mostRecent = sortedLogs[0];
  const daysAgo = daysBetween(today, mostRecent.date);

  if (daysAgo <= STALE_LOG_THRESHOLD_DAYS) return null;

  return {
    kind: 'noRecentLog',
    priority: 'low',
    mareId: mare.id,
    mareName: mare.name,
    title: `Last log ${daysAgo} days ago`,
    subtitle: `Last: ${formatLocalDate(mostRecent.date, 'MM-DD-YYYY')}`,
    sortKey: -daysAgo, // most neglected first
  };
}

function checkMedicationGap(
  mare: Mare,
  medicationLogs: readonly MedicationLog[],
  today: LocalDate
): DashboardAlert | null {
  if (medicationLogs.length === 0) return null;

  const byName = new Map<string, string[]>();
  for (const log of medicationLogs) {
    const existing = byName.get(log.medicationName);
    if (existing) {
      existing.push(log.date);
    } else {
      byName.set(log.medicationName, [log.date]);
    }
  }

  let bestAlert: DashboardAlert | null = null;
  let bestDaysAgo = Infinity;

  for (const [medName, dates] of byName) {
    const uniqueDates = [...new Set(dates)].sort();

    let streakLength = 1;
    for (let i = uniqueDates.length - 1; i > 0; i--) {
      const curr = daysBetween(uniqueDates[i], uniqueDates[i - 1]);
      if (curr === 1) {
        streakLength++;
      } else {
        break;
      }
    }

    if (streakLength < MEDICATION_GAP_MIN_STREAK_DAYS) continue;

    const lastDoseDate = uniqueDates[uniqueDates.length - 1];
    const daysAgo = daysBetween(today, lastDoseDate);

    if (daysAgo > MEDICATION_GAP_ACTIVE_WINDOW_DAYS) continue;
    if (daysAgo < 1) continue;

    if (daysAgo < bestDaysAgo) {
      bestDaysAgo = daysAgo;
      bestAlert = {
        kind: 'medicationGap',
        priority: 'medium',
        mareId: mare.id,
        mareName: mare.name,
        title: `${medName} gap`,
        subtitle: daysAgo === 1 ? 'Last dose: yesterday' : `Last dose: ${daysAgo} days ago`,
        sortKey: daysAgo,
      };
    }
  }

  return bestAlert;
}

function checkFoalNeedsIgg(
  mare: Mare,
  foalingRecords: readonly FoalingRecord[],
  foalByFoalingRecordId: ReadonlyMap<string, Foal>,
  today: LocalDate
): DashboardAlert | null {
  const liveFoalings = foalingRecords.filter((fr) => fr.outcome === 'liveFoal');

  for (const foaling of liveFoalings) {
    const daysAgo = daysBetween(today, foaling.date);
    if (daysAgo > FOAL_IGG_ALERT_WINDOW_DAYS) continue;

    const foal = foalByFoalingRecordId.get(foaling.id);
    if (!foal) continue;
    if (foal.iggTests.length > 0) continue;

    const foalLabel = foal.name || 'Foal';

    return {
      kind: 'foalNeedsIgg',
      priority: 'high',
      mareId: mare.id,
      mareName: mare.name,
      title: `${foalLabel} needs IgG test`,
      subtitle: `Born ${foaling.date}`,
      sortKey: daysAgo,
      foalingRecordId: foaling.id,
      foalId: foal.id,
    };
  }

  return null;
}

// --- Main ---

export function generateDashboardAlerts(
  input: DashboardInput
): readonly DashboardAlert[] {
  const { mares, today } = input;

  if (mares.length === 0) return [];

  const logsByMare = groupByMareId(input.dailyLogs);
  const breedingsByMare = groupByMareId(input.breedingRecords);
  const checksByMare = groupByMareId(input.pregnancyChecks);
  const foalingsByMare = groupByMareId(input.foalingRecords);
  const medsByMare = groupByMareId(input.medicationLogs ?? []);

  const foalByFoalingRecordId = new Map<string, Foal>();
  for (const foal of input.foals ?? []) {
    foalByFoalingRecordId.set(foal.foalingRecordId, foal);
  }

  const alerts: DashboardAlert[] = [];

  for (const mare of mares) {
    const mareLogs = logsByMare.get(mare.id) ?? [];
    const mareBreedings = breedingsByMare.get(mare.id) ?? [];
    const mareChecks = checksByMare.get(mare.id) ?? [];
    const mareFoalings = foalingsByMare.get(mare.id) ?? [];

    const dueAlert = checkApproachingDueDate(
      mare,
      mareChecks,
      mareFoalings,
      mareBreedings,
      today
    );
    if (dueAlert) alerts.push(dueAlert);

    const pregCheckAlert = checkPregnancyCheckNeeded(
      mare,
      mareChecks,
      mareFoalings,
      mareBreedings,
      today
    );
    if (pregCheckAlert) alerts.push(pregCheckAlert);

    const ovulationAlert = checkRecentOvulation(mare, mareLogs, today);
    if (ovulationAlert) alerts.push(ovulationAlert);

    const heatAlert = checkHeatActivity(mare, mareLogs, today);
    if (heatAlert) alerts.push(heatAlert);

    const staleLogAlert = checkNoRecentLog(
      mare,
      mareLogs,
      mareChecks,
      mareFoalings,
      mareBreedings,
      today
    );
    if (staleLogAlert) alerts.push(staleLogAlert);

    const mareMeds = medsByMare.get(mare.id) ?? [];
    const medGapAlert = checkMedicationGap(mare, mareMeds, today);
    if (medGapAlert) alerts.push(medGapAlert);

    const iggAlert = checkFoalNeedsIgg(mare, mareFoalings, foalByFoalingRecordId, today);
    if (iggAlert) alerts.push(iggAlert);
  }

  return [...alerts].sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.sortKey - b.sortKey;
  });
}
