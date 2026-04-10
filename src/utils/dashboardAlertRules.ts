import { Foal, LocalDate, calculateDaysPostBreeding, estimateFoalingDate } from '@/models/types';

import { MareAlertContext } from '@/utils/dashboardAlertContext';
import {
  DUE_DATE_ALERT_WINDOW_DAYS,
  DashboardAlert,
  FOAL_IGG_ALERT_WINDOW_DAYS,
  HEAT_ACTIVITY_WINDOW_DAYS,
  MEDICATION_GAP_ACTIVE_WINDOW_DAYS,
  MEDICATION_GAP_MIN_STREAK_DAYS,
  PREG_CHECK_WINDOW_MIN_DAYS,
  PREGNANT_MAINTENANCE_DPO,
  RECENT_OVULATION_WINDOW_DAYS,
  STALE_LOG_THRESHOLD_DAYS,
} from '@/utils/dashboardAlertTypes';
import { formatLocalDate } from '@/utils/dates';

function daysBetween(dateA: LocalDate, dateB: LocalDate): number {
  return calculateDaysPostBreeding(dateA, dateB);
}

function checkApproachingDueDate(
  ctx: MareAlertContext,
  today: LocalDate,
): DashboardAlert | null {
  const currentCheck = ctx.currentPregnancyCheck;
  if (!currentCheck) return null;

  const breeding = ctx.breedingRecords.find((record) => record.id === currentCheck.breedingRecordId);
  if (!breeding) return null;

  const dueDate = estimateFoalingDate(breeding.date);
  const daysUntilDue = daysBetween(dueDate, today);
  if (daysUntilDue > DUE_DATE_ALERT_WINDOW_DAYS) return null;

  const title =
    daysUntilDue < 0
      ? `Overdue by ${Math.abs(daysUntilDue)} days`
      : daysUntilDue === 0
        ? 'Due today'
        : `Due in ${daysUntilDue} days`;

  return {
    kind: 'approachingDueDate',
    priority: 'high',
    mareId: ctx.mare.id,
    mareName: ctx.mare.name,
    title,
    subtitle: `Est. due ${formatLocalDate(dueDate, 'MM-DD-YYYY')}`,
    sortKey: daysUntilDue,
  };
}

function checkPregnancyCheckNeeded(
  ctx: MareAlertContext,
  today: LocalDate,
): DashboardAlert | null {
  if (ctx.currentPregnancyCheck) return null;

  const latestBreeding = ctx.breedingRecordsDesc[0];
  if (!latestBreeding) return null;

  const hasCheckForBreeding = ctx.pregnancyChecks.some(
    (check) => check.breedingRecordId === latestBreeding.id,
  );
  if (hasCheckForBreeding) return null;

  const daysPost = daysBetween(today, latestBreeding.date);
  if (daysPost < PREG_CHECK_WINDOW_MIN_DAYS) return null;

  const stallionInfo = latestBreeding.stallionName ? ` (${latestBreeding.stallionName})` : '';

  return {
    kind: 'pregnancyCheckNeeded',
    priority: 'high',
    mareId: ctx.mare.id,
    mareName: ctx.mare.name,
    title: `Day ${daysPost} post-breeding`,
    subtitle: `Preg check due${stallionInfo}`,
    sortKey: -daysPost,
  };
}

function checkRecentOvulation(
  ctx: MareAlertContext,
  today: LocalDate,
): DashboardAlert | null {
  let ovulationLog = null;
  for (const log of ctx.dailyLogsDesc) {
    if (!log.ovulationDetected) continue;
    const daysAgo = daysBetween(today, log.date);
    if (daysAgo <= RECENT_OVULATION_WINDOW_DAYS) {
      ovulationLog = log;
      break;
    }
  }

  if (!ovulationLog) return null;

  const hasFollowUp = ctx.dailyLogsDesc.some((log) => log.date > ovulationLog.date);
  if (hasFollowUp) return null;

  return {
    kind: 'recentOvulation',
    priority: 'medium',
    mareId: ctx.mare.id,
    mareName: ctx.mare.name,
    title: `Ovulated on ${formatLocalDate(ovulationLog.date, 'MM-DD-YYYY')}`,
    subtitle: 'Confirm with ultrasound',
    sortKey: daysBetween(today, ovulationLog.date),
  };
}

function checkHeatActivity(
  ctx: MareAlertContext,
  today: LocalDate,
): DashboardAlert | null {
  let heatLog = null;
  for (const log of ctx.dailyLogsDesc) {
    const daysAgo = daysBetween(today, log.date);
    if (daysAgo > HEAT_ACTIVITY_WINDOW_DAYS) break;

    const highTeasing = log.teasingScore !== null && log.teasingScore !== undefined && log.teasingScore >= 4;
    const highEdema = log.edema !== null && log.edema !== undefined && log.edema >= 4;

    if (highTeasing || highEdema) {
      heatLog = log;
      break;
    }
  }

  if (!heatLog) return null;

  const hasOvulation = ctx.dailyLogsDesc.some(
    (log) => log.ovulationDetected && log.date >= heatLog.date,
  );
  if (hasOvulation) return null;

  const parts: string[] = [];
  if (heatLog.teasingScore !== null && heatLog.teasingScore !== undefined && heatLog.teasingScore >= 4) {
    parts.push(`Teasing ${heatLog.teasingScore}/5`);
  }
  if (heatLog.edema !== null && heatLog.edema !== undefined && heatLog.edema >= 4) {
    parts.push(`Edema ${heatLog.edema}/5`);
  }

  return {
    kind: 'heatActivity',
    priority: 'medium',
    mareId: ctx.mare.id,
    mareName: ctx.mare.name,
    title: parts.join(', '),
    subtitle: 'May be approaching ovulation',
    sortKey: -(heatLog.teasingScore ?? heatLog.edema ?? 0),
  };
}

function checkNoRecentLog(
  ctx: MareAlertContext,
  today: LocalDate,
): DashboardAlert | null {
  if (ctx.currentPregnancyCheck) {
    const breeding = ctx.breedingRecords.find(
      (record) => record.id === ctx.currentPregnancyCheck?.breedingRecordId,
    );
    if (breeding) {
      const daysPostBreeding = daysBetween(today, breeding.date);
      if (daysPostBreeding >= PREGNANT_MAINTENANCE_DPO) return null;
    }
  }

  if (ctx.dailyLogs.length === 0) {
    return {
      kind: 'noRecentLog',
      priority: 'low',
      mareId: ctx.mare.id,
      mareName: ctx.mare.name,
      title: 'No logs recorded',
      subtitle: 'Start tracking this mare',
      sortKey: -Infinity,
    };
  }

  const mostRecent = ctx.dailyLogsDesc[0];
  const daysAgo = daysBetween(today, mostRecent.date);
  if (daysAgo <= STALE_LOG_THRESHOLD_DAYS) return null;

  return {
    kind: 'noRecentLog',
    priority: 'low',
    mareId: ctx.mare.id,
    mareName: ctx.mare.name,
    title: `Last log ${daysAgo} days ago`,
    subtitle: `Last: ${formatLocalDate(mostRecent.date, 'MM-DD-YYYY')}`,
    sortKey: -daysAgo,
  };
}

function checkMedicationGap(
  ctx: MareAlertContext,
  today: LocalDate,
): DashboardAlert | null {
  if (ctx.medicationLogs.length === 0) return null;

  const byName = new Map<string, string[]>();
  for (const log of ctx.medicationLogs) {
    const existing = byName.get(log.medicationName);
    if (existing) {
      existing.push(log.date);
    } else {
      byName.set(log.medicationName, [log.date]);
    }
  }

  let bestAlert: DashboardAlert | null = null;
  let bestDaysAgo = Infinity;

  for (const [medicationName, dates] of byName) {
    const uniqueDates = [...new Set(dates)].sort();
    let streakLength = 1;

    for (let i = uniqueDates.length - 1; i > 0; i--) {
      const gapDays = daysBetween(uniqueDates[i], uniqueDates[i - 1]);
      if (gapDays === 1) {
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
        mareId: ctx.mare.id,
        mareName: ctx.mare.name,
        title: `${medicationName} gap`,
        subtitle: daysAgo === 1 ? 'Last dose: yesterday' : `Last dose: ${daysAgo} days ago`,
        sortKey: daysAgo,
      };
    }
  }

  return bestAlert;
}

function checkFoalNeedsIgg(
  ctx: MareAlertContext,
  foalByFoalingRecordId: ReadonlyMap<string, Foal>,
  today: LocalDate,
): DashboardAlert | null {
  const liveFoalings = ctx.foalingRecords.filter((record) => record.outcome === 'liveFoal');

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
      mareId: ctx.mare.id,
      mareName: ctx.mare.name,
      title: `${foalLabel} needs IgG test`,
      subtitle: `Born ${foaling.date}`,
      sortKey: daysAgo,
      foalingRecordId: foaling.id,
      foalId: foal.id,
    };
  }

  return null;
}

export function generateAlertsForMare(
  ctx: MareAlertContext,
  foalByFoalingRecordId: ReadonlyMap<string, Foal>,
  today: LocalDate,
): readonly DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  const dueAlert = checkApproachingDueDate(ctx, today);
  if (dueAlert) alerts.push(dueAlert);

  const pregCheckAlert = checkPregnancyCheckNeeded(ctx, today);
  if (pregCheckAlert) alerts.push(pregCheckAlert);

  const ovulationAlert = checkRecentOvulation(ctx, today);
  if (ovulationAlert) alerts.push(ovulationAlert);

  const heatAlert = checkHeatActivity(ctx, today);
  if (heatAlert) alerts.push(heatAlert);

  const staleLogAlert = checkNoRecentLog(ctx, today);
  if (staleLogAlert) alerts.push(staleLogAlert);

  const medicationGapAlert = checkMedicationGap(ctx, today);
  if (medicationGapAlert) alerts.push(medicationGapAlert);

  const foalIggAlert = checkFoalNeedsIgg(ctx, foalByFoalingRecordId, today);
  if (foalIggAlert) alerts.push(foalIggAlert);

  return alerts;
}
