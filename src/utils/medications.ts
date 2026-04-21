import {
  MEDICATION_ROUTE_LABELS,
  MEDICATION_ROUTE_OPTIONS,
} from '@/models/enums';
import type { MedicationRoute } from '@/models/types';

export { MEDICATION_ROUTE_OPTIONS };

export const PREDEFINED_MEDICATIONS = [
  'Regumate',
  'Deslorelin',
  'Oxytocin',
  'PGF2\u03B1',
  'Progesterone',
  'Excede',
  'Gentamicin',
] as const;

export function formatRoute(route: MedicationRoute | string): string {
  return MEDICATION_ROUTE_LABELS[route as MedicationRoute] ?? route;
}
