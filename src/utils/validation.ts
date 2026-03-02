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

export function normalizeLocalDate(value: string): LocalDate | null {
  const trimmed = value.trim();
  return trimmed ? (trimmed as LocalDate) : null;
}
