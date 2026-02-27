import { describe, expect, it } from 'vitest';

import {
  normalizeLocalDate,
  parseOptionalInteger,
  parseOptionalNumber,
  validateLocalDate,
  validateNumberRange,
  validateRequired,
} from '@/utils/validation';

describe('validateRequired', () => {
  it('returns null for non-empty trimmed values', () => {
    expect(validateRequired(' mare ', 'Name')).toBeNull();
  });

  it('returns an error message for empty values', () => {
    expect(validateRequired('   ', 'Name')).toBe('Name is required.');
  });
});

describe('validateLocalDate', () => {
  it('returns required message when empty and required', () => {
    expect(validateLocalDate('', 'Date', true)).toBe('Date is required.');
  });

  it('returns null when empty and optional', () => {
    expect(validateLocalDate('   ', 'Date', false)).toBeNull();
  });

  it('returns null for valid local date format', () => {
    expect(validateLocalDate('2026-02-27', 'Date', true)).toBeNull();
  });

  it('returns format error for invalid date string', () => {
    expect(validateLocalDate('02/27/2026', 'Date', true)).toBe('Date must be YYYY-MM-DD.');
  });
});

describe('parseOptionalNumber', () => {
  it('returns null for empty input', () => {
    expect(parseOptionalNumber('  ')).toBeNull();
  });

  it('parses valid number strings', () => {
    expect(parseOptionalNumber('12.5')).toBe(12.5);
  });

  it('returns NaN for invalid numeric input', () => {
    expect(Number.isNaN(parseOptionalNumber('abc') as number)).toBe(true);
  });
});

describe('parseOptionalInteger', () => {
  it('returns null for empty input', () => {
    expect(parseOptionalInteger('  ')).toBeNull();
  });

  it('parses valid integer strings', () => {
    expect(parseOptionalInteger('42')).toBe(42);
  });

  it('returns NaN for decimal inputs', () => {
    expect(Number.isNaN(parseOptionalInteger('4.2') as number)).toBe(true);
  });
});

describe('validateNumberRange', () => {
  it('returns null for null values', () => {
    expect(validateNumberRange(null, 'Score', 0, 5)).toBeNull();
  });

  it('returns invalid-number message for NaN', () => {
    expect(validateNumberRange(Number.NaN, 'Score', 0, 5)).toBe('Score must be a valid number.');
  });

  it('returns range error when value is out of range', () => {
    expect(validateNumberRange(6, 'Score', 0, 5)).toBe('Score must be between 0 and 5.');
  });

  it('returns null when value is in range', () => {
    expect(validateNumberRange(4, 'Score', 0, 5)).toBeNull();
  });
});

describe('normalizeLocalDate', () => {
  it('returns null for empty values', () => {
    expect(normalizeLocalDate('   ')).toBeNull();
  });

  it('returns trimmed local date string for non-empty values', () => {
    expect(normalizeLocalDate('2026-02-27')).toBe('2026-02-27');
  });
});
