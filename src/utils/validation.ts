import { LocalDate } from '@/models/types';
import { isLocalDate, toLocalDate } from '@/utils/dates';

export function validateRequired(value: string, label: string): string | null {
  return value.trim().length > 0 ? null : `${label} is required.`;
}

export function validateLocalDate(value: string, label: string, required = false): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return required ? `${label} is required.` : null;
  }

  return isLocalDate(trimmed) ? null : `${label} must be YYYY-MM-DD.`;
}

export function validateLocalDateNotInFuture(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || !isLocalDate(trimmed)) {
    return null;
  }

  return trimmed > toLocalDate(new Date()) ? 'Date cannot be in the future.' : null;
}

export function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function parseOptionalInteger(value: string): number | null {
  const parsed = parseOptionalNumber(value);
  if (parsed === null) {
    return null;
  }

  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

export function validateNumberRange(
  value: number | null,
  label: string,
  min: number,
  max: number
): string | null {
  if (value === null) {
    return null;
  }

  if (Number.isNaN(value)) {
    return `${label} must be a valid number.`;
  }

  if (value < min || value > max) {
    return `${label} must be between ${min} and ${max}.`;
  }

  return null;
}

export function validateIntegerRange(
  value: number | null,
  label: string,
  min: number,
  max: number
): string | null {
  if (value === null) {
    return null;
  }

  if (Number.isNaN(value)) {
    return `${label} must be a whole number.`;
  }

  if (value < min || value > max) {
    return `${label} must be between ${min} and ${max}.`;
  }

  return null;
}

export function validateLinkedFrozenRawVolume(
  value: number | null,
  collectionId: string | null,
): string | null {
  if (!collectionId) {
    return null;
  }

  if (value === null) {
    return 'Raw semen volume used is required for linked frozen batches.';
  }

  if (Number.isNaN(value)) {
    return 'Raw semen volume used must be a valid number.';
  }

  if (value <= 0) {
    return 'Raw semen volume used must be greater than zero.';
  }

  return null;
}

export function validateOtherSelection(
  value: string | null,
  otherValue: string,
  label: string,
): string | null {
  const trimmedOther = otherValue.trim();
  if (value === 'Other' && trimmedOther.length === 0) {
    return `${label} other value is required.`;
  }

  if (value !== 'Other' && trimmedOther.length > 0) {
    return `${label} other value can only be set when ${label.toLowerCase()} is Other.`;
  }

  return null;
}

export function validateTriStateSelection(
  value: boolean | null,
  label: string,
  required: boolean,
): string | null {
  if (!required) {
    return null;
  }

  if (value == null) {
    return `${label} selection is required.`;
  }

  return null;
}

export function validateOptionalDecimalRange(
  value: number | null,
  label: string,
  min: number,
  max: number,
): string | null {
  return validateNumberRange(value, label, min, max);
}

export function normalizeLocalDate(value: string): LocalDate | null {
  const trimmed = value.trim();
  return trimmed ? (trimmed as LocalDate) : null;
}
