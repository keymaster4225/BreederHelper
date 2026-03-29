import type { MedicationRoute } from '@/models/types';

export const PREDEFINED_MEDICATIONS = [
  'Regumate',
  'Deslorelin',
  'Oxytocin',
  'PGF2\u03B1',
  'Progesterone',
  'Excede',
  'Gentamicin',
] as const;

export const MEDICATION_ROUTE_OPTIONS: readonly { readonly label: string; readonly value: MedicationRoute }[] = [
  { label: 'Oral', value: 'oral' },
  { label: 'IM', value: 'IM' },
  { label: 'IV', value: 'IV' },
  { label: 'Intrauterine', value: 'intrauterine' },
  { label: 'SQ', value: 'SQ' },
];

export function formatRoute(route: MedicationRoute): string {
  switch (route) {
    case 'oral': return 'Oral';
    case 'intrauterine': return 'Intrauterine';
    default: return route; // IM, IV, SQ already uppercase
  }
}
