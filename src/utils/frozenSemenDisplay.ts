import { FREEZING_EXTENDER_LABELS, STRAW_COLOR_LABELS } from '@/models/enums';
import type { FreezingExtender, StrawColor } from '@/models/types';
import { formatLocalDate } from './dates';
import { computeDosesAvailable } from './frozenSemen';

export function formatFreezingExtender(
  extender: FreezingExtender | null,
  extenderOther: string | null,
): string {
  if (extender == null) {
    return 'Unknown';
  }

  if (extender === 'Other') {
    const trimmedOther = extenderOther?.trim() ?? '';
    return trimmedOther.length > 0 ? trimmedOther : 'Other';
  }

  if (extender === 'Gent') {
    return 'Gent (Cryo-Gent)';
  }

  return FREEZING_EXTENDER_LABELS[extender] ?? extender;
}

export function formatStrawColor(
  strawColor: StrawColor | null,
  strawColorOther: string | null,
): string {
  if (strawColor == null) {
    return 'Unknown';
  }

  if (strawColor === 'Other') {
    const trimmedOther = strawColorOther?.trim() ?? '';
    return trimmedOther.length > 0 ? trimmedOther : 'Other';
  }

  return STRAW_COLOR_LABELS[strawColor] ?? strawColor;
}

export function formatFrozenBatchSource(collectionDate: string | null): string {
  if (!collectionDate) {
    return 'Standalone';
  }

  return `From collection ${formatLocalDate(collectionDate, 'MM-DD-YYYY')}`;
}

export function formatFrozenBatchDoseSummary(
  strawsRemaining: number,
  strawsPerDose: number | null,
): string | null {
  const availability = computeDosesAvailable(strawsRemaining, strawsPerDose);
  if (!availability) {
    return null;
  }

  const doseLabel = availability.fullDoses === 1 ? 'dose' : 'doses';
  if (availability.leftoverStraws <= 0) {
    return `${availability.fullDoses} ${doseLabel}`;
  }

  const leftoverLabel = availability.leftoverStraws === 1 ? 'leftover straw' : 'leftover straws';
  return `${availability.fullDoses} ${doseLabel} + ${availability.leftoverStraws} ${leftoverLabel}`;
}
