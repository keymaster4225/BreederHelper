import { LocalDate } from '@/models/types';

export function isLocalDate(value: string): value is LocalDate {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function toLocalDate(value: Date): LocalDate {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromLocalDate(value?: string | null): Date | null {
  if (!value || !isLocalDate(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function deriveAgeYears(dateOfBirth?: LocalDate | null): number | null {
  if (!dateOfBirth || !isLocalDate(dateOfBirth)) {
    return null;
  }

  const dob = new Date(`${dateOfBirth}T00:00:00`);
  const now = new Date();

  let years = now.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());

  if (!hasHadBirthdayThisYear) {
    years -= 1;
  }

  return years >= 0 ? years : null;
}
