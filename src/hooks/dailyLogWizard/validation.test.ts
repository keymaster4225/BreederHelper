import { describe, expect, it } from 'vitest';

import { validateBasics, validateOvary, validateUterus } from './validation';

describe('daily log wizard validation helpers', () => {
  it('requires a valid non-future basics date', () => {
    expect(validateBasics('').date).toBe('Date is required.');
    expect(validateBasics('2026/13/40').date).toBe('Date must be YYYY-MM-DD.');
    expect(validateBasics('9999-12-31').date).toBe('Date cannot be in the future.');
  });

  it('validates measured follicle size entries', () => {
    expect(
      validateOvary({
        ovulation: null,
        follicleState: 'measured',
        follicleMeasurements: [{ clientId: 'row-1', value: '' }],
        consistency: null,
        structures: [],
      }).measurements,
    ).toBe('Enter a valid follicle size (0-100 mm, up to 1 decimal place).');

    expect(
      validateOvary({
        ovulation: null,
        follicleState: 'measured',
        follicleMeasurements: [
          { clientId: 'row-1', value: '35.5' },
          { clientId: 'row-2', value: '101' },
        ],
        consistency: null,
        structures: [],
      }).measurements,
    ).toBe('Follicle size must be between 0 and 100 mm with at most 1 decimal place.');
  });

  it('requires discharge notes and valid uterine fluid pockets when applicable', () => {
    const result = validateUterus({
      edema: '',
      uterineToneCategory: null,
      cervicalFirmness: null,
      dischargeObserved: true,
      dischargeNotes: '   ',
      uterineCysts: '',
      fluidPockets: [
        {
          clientId: 'pocket-1',
          depthMm: 0,
          location: 'body' as never,
        },
      ],
    });

    expect(result.dischargeNotes).toBe(
      'Discharge notes are required when discharge is observed.',
    );
    expect(result.fluidPockets).toBe(
      'Each fluid pocket needs a valid depth and location.',
    );
  });
});
