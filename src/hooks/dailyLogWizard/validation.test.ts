import { describe, expect, it } from 'vitest';

import { validateBasics, validateFlush, validateOvary, validateUterus } from './validation';

describe('daily log wizard validation helpers', () => {
  it('requires a valid non-future basics date', () => {
    expect(validateBasics('', '08:30').date).toBe('Date is required.');
    expect(validateBasics('2026/13/40', '08:30').date).toBe('Date must be YYYY-MM-DD.');
    expect(validateBasics('9999-12-31', '08:30').date).toBe('Date cannot be in the future.');
  });

  it('requires a valid basics time unless the edit flow is preserving an untimed legacy row', () => {
    expect(validateBasics('2026-04-01', '').time).toBe('Time is required.');
    expect(validateBasics('2026-04-01', '29:10').time).toBe(
      'Time must be a valid HH:MM value.',
    );
    expect(validateBasics('2026-04-01', '', true).time).toBeUndefined();
    expect(validateBasics('2026-04-01', ' 08:30 ', true).time).toBeUndefined();
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

  it('requires a flush decision when uterine fluid is recorded', () => {
    const result = validateUterus(
      {
        edema: '',
        uterineToneCategory: null,
        cervicalFirmness: null,
        dischargeObserved: null,
        dischargeNotes: '',
        uterineCysts: '',
        fluidPockets: [
          {
            clientId: 'pocket-1',
            depthMm: 6,
            location: 'uterineBody',
          },
        ],
      },
      null,
    );

    expect(result.flushDecision).toBe('Choose Yes or No for same-visit flush.');
  });

  it('validates required flush fields and product rows', () => {
    expect(
      validateFlush({
        baseSolution: '',
        totalVolumeMl: '0',
        notes: '',
        products: [{ clientId: 'product-1', productName: 'Saline', dose: '', notes: '' }],
      }),
    ).toEqual({
      baseSolution: 'Base solution is required.',
      totalVolumeMl: 'Total volume must be greater than 0 with at most 1 decimal place.',
      products: 'Each flush product needs a name and dose.',
    });

    expect(
      validateFlush({
        baseSolution: 'LRS',
        totalVolumeMl: '500.5',
        notes: '',
        products: [{ clientId: 'product-1', productName: 'Saline', dose: '500 mL', notes: '' }],
      }),
    ).toEqual({});
  });
});
