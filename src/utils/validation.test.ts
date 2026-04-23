import { describe, expect, it } from 'vitest';

import {
  validateOptionalDecimalRange,
  validateOtherSelection,
  validateTriStateSelection,
  validateLinkedFrozenRawVolume,
  normalizeLocalDate,
  parseOptionalInteger,
  parseOptionalNumber,
  validateLocalDate,
  validateLocalDateNotInFuture,
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

describe('validateLocalDateNotInFuture', () => {
  it('returns null for empty values', () => {
    expect(validateLocalDateNotInFuture('   ')).toBeNull();
  });

  it('returns null for today and past dates, and error for future dates', () => {
    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const toLocalDate = (value: Date): string => {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    expect(validateLocalDateNotInFuture(toLocalDate(today))).toBeNull();
    expect(validateLocalDateNotInFuture(toLocalDate(yesterday))).toBeNull();
    expect(validateLocalDateNotInFuture(toLocalDate(tomorrow))).toBe('Date cannot be in the future.');
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

describe('validateLinkedFrozenRawVolume', () => {
  it('requires linked batches to provide volume', () => {
    expect(validateLinkedFrozenRawVolume(null, 'collection-1')).toBe(
      'Raw semen volume used is required for linked frozen batches.',
    );
  });

  it('rejects invalid and non-positive linked volume values', () => {
    expect(validateLinkedFrozenRawVolume(Number.NaN, 'collection-1')).toBe(
      'Raw semen volume used must be a valid number.',
    );
    expect(validateLinkedFrozenRawVolume(0, 'collection-1')).toBe(
      'Raw semen volume used must be greater than zero.',
    );
  });

  it('allows standalone batches to omit volume', () => {
    expect(validateLinkedFrozenRawVolume(null, null)).toBeNull();
  });
});

describe('validateOtherSelection', () => {
  it('requires an other value when selection is Other', () => {
    expect(validateOtherSelection('Other', '   ', 'Extender')).toBe(
      'Extender other value is required.',
    );
  });

  it('rejects other text when selection is not Other', () => {
    expect(validateOtherSelection('Gent', 'Custom', 'Extender')).toBe(
      'Extender other value can only be set when extender is Other.',
    );
  });

  it('accepts valid selection/other combinations', () => {
    expect(validateOtherSelection('Other', 'Custom', 'Extender')).toBeNull();
    expect(validateOtherSelection('Gent', '   ', 'Extender')).toBeNull();
  });
});

describe('validateTriStateSelection', () => {
  it('requires a value when required', () => {
    expect(validateTriStateSelection(null, 'Cushion used', true)).toBe(
      'Cushion used selection is required.',
    );
  });

  it('allows null when not required and accepts booleans', () => {
    expect(validateTriStateSelection(null, 'Cushion used', false)).toBeNull();
    expect(validateTriStateSelection(true, 'Cushion used', true)).toBeNull();
    expect(validateTriStateSelection(false, 'Cushion used', true)).toBeNull();
  });
});

describe('validateOptionalDecimalRange', () => {
  it('supports decimal values in range', () => {
    expect(validateOptionalDecimalRange(62.5, 'Post-thaw motility', 0, 100)).toBeNull();
  });

  it('reuses numeric range errors for invalid values', () => {
    expect(validateOptionalDecimalRange(Number.NaN, 'Post-thaw motility', 0, 100)).toBe(
      'Post-thaw motility must be a valid number.',
    );
    expect(validateOptionalDecimalRange(120.1, 'Post-thaw motility', 0, 100)).toBe(
      'Post-thaw motility must be between 0 and 100.',
    );
  });
});
