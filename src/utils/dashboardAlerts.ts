import { buildDashboardAlertContext } from '@/utils/dashboardAlertContext';
import { generateAlertsForMare } from '@/utils/dashboardAlertRules';
import { DashboardAlert, DashboardInput, PRIORITY_ORDER } from '@/utils/dashboardAlertTypes';

export {
  DUE_DATE_ALERT_WINDOW_DAYS,
  FOAL_IGG_ALERT_WINDOW_DAYS,
  HEAT_ACTIVITY_WINDOW_DAYS,
  MEDICATION_GAP_ACTIVE_WINDOW_DAYS,
  MEDICATION_GAP_MIN_STREAK_DAYS,
  PREG_CHECK_WINDOW_MAX_DAYS,
  PREG_CHECK_WINDOW_MIN_DAYS,
  PREGNANT_MAINTENANCE_DPO,
  RECENT_OVULATION_WINDOW_DAYS,
  STALE_LOG_THRESHOLD_DAYS,
} from '@/utils/dashboardAlertTypes';

export type {
  AlertKind,
  AlertPriority,
  DashboardAlert,
  DashboardInput,
} from '@/utils/dashboardAlertTypes';

export function generateDashboardAlerts(input: DashboardInput): readonly DashboardAlert[] {
  if (input.mares.length === 0) return [];

  const context = buildDashboardAlertContext(input);
  const alerts: DashboardAlert[] = [];

  for (const mareContext of context.mareContexts) {
    alerts.push(...generateAlertsForMare(mareContext, context.foalByFoalingRecordId, input.today));
  }

  return [...alerts].sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.sortKey - b.sortKey;
  });
}
