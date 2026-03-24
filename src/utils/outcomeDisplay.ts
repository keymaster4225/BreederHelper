import { colors } from '@/theme';

export function getOutcomeColor(outcome: string): string {
  if (outcome === 'liveFoal') return colors.pregnant;
  if (outcome === 'stillbirth' || outcome === 'aborted') return colors.loss;
  return colors.onSurface;
}

export function formatBreedingMethod(method: string): string {
  if (method === 'liveCover') return 'Live Cover';
  if (method === 'freshAI') return 'Fresh AI';
  if (method === 'shippedCooledAI') return 'Shipped/Cooled AI';
  if (method === 'frozenAI') return 'Frozen AI';
  return method;
}

export function formatOutcome(outcome: string): string {
  if (outcome === 'liveFoal') return 'Live Foal';
  if (outcome === 'stillbirth') return 'Stillbirth';
  if (outcome === 'aborted') return 'Aborted';
  return 'Unknown';
}

export function formatFoalColor(color: string): string {
  const map: Record<string, string> = {
    bay: 'Bay',
    chestnut: 'Chestnut',
    black: 'Black',
    gray: 'Gray',
    palomino: 'Palomino',
    buckskin: 'Buckskin',
    roan: 'Roan',
    pintoPaint: 'Pinto/Paint',
    sorrel: 'Sorrel',
    dun: 'Dun',
    cremello: 'Cremello',
    other: 'Other',
  };
  return map[color] ?? color;
}

export function formatFoalSex(sex: string): string {
  if (sex === 'colt') return 'Colt';
  if (sex === 'filly') return 'Filly';
  if (sex === 'unknown') return 'Unknown';
  return sex;
}

export function getFoalSexColor(sex: string): string | null {
  if (sex === 'colt') return colors.colt;
  if (sex === 'filly') return colors.filly;
  return null;
}
