import { describe, expect, it } from 'vitest';
import { interpretIgg, formatIggInterpretation, IGG_THRESHOLDS } from '@/utils/igg';

describe('interpretIgg', () => {
  it('returns completeFailure below 400', () => {
    expect(interpretIgg(0)).toBe('completeFailure');
    expect(interpretIgg(200)).toBe('completeFailure');
    expect(interpretIgg(399)).toBe('completeFailure');
  });

  it('returns partialFailure for 400-799', () => {
    expect(interpretIgg(400)).toBe('partialFailure');
    expect(interpretIgg(600)).toBe('partialFailure');
    expect(interpretIgg(799)).toBe('partialFailure');
  });

  it('returns adequate for 800+', () => {
    expect(interpretIgg(800)).toBe('adequate');
    expect(interpretIgg(1000)).toBe('adequate');
    expect(interpretIgg(2000)).toBe('adequate');
  });
});

describe('formatIggInterpretation', () => {
  it('formats adequate', () => {
    expect(formatIggInterpretation('adequate')).toBe('Adequate');
  });

  it('formats partialFailure', () => {
    expect(formatIggInterpretation('partialFailure')).toBe('Partial Failure');
  });

  it('formats completeFailure', () => {
    expect(formatIggInterpretation('completeFailure')).toBe('Complete Failure');
  });
});

describe('IGG_THRESHOLDS', () => {
  it('has adequate at 800', () => {
    expect(IGG_THRESHOLDS.ADEQUATE).toBe(800);
  });

  it('has partial failure at 400', () => {
    expect(IGG_THRESHOLDS.PARTIAL_FAILURE).toBe(400);
  });
});
