import { describe, expect, it } from 'vitest';

import type { DailyLog } from '@/models/types';
import { buildOvarySummary, buildUterusSummary } from './dailyLogDisplay';

const BASE_LOG: DailyLog = {
  id: 'log-1',
  mareId: 'mare-1',
  date: '2026-04-21',
  teasingScore: 3,
  rightOvary: 'legacy right',
  leftOvary: 'legacy left',
  rightOvaryOvulation: null,
  rightOvaryFollicleState: null,
  rightOvaryFollicleMeasurementsMm: [],
  rightOvaryConsistency: null,
  rightOvaryStructures: [],
  leftOvaryOvulation: null,
  leftOvaryFollicleState: null,
  leftOvaryFollicleMeasurementsMm: [],
  leftOvaryConsistency: null,
  leftOvaryStructures: [],
  ovulationDetected: null,
  edema: 2,
  uterineTone: 'legacy tone',
  uterineToneCategory: null,
  cervicalFirmness: null,
  dischargeObserved: null,
  dischargeNotes: null,
  uterineCysts: null,
  notes: null,
  createdAt: '2026-04-21T00:00:00.000Z',
  updatedAt: '2026-04-21T00:00:00.000Z',
};

describe('dailyLogDisplay', () => {
  it('builds structured ovary summaries when structured data exists', () => {
    const summary = buildOvarySummary(
      {
        ...BASE_LOG,
        rightOvaryOvulation: true,
        rightOvaryFollicleState: 'measured',
        rightOvaryFollicleMeasurementsMm: [34, 36],
        rightOvaryConsistency: 'firm',
        rightOvaryStructures: ['corpusLuteum'],
      },
      'right',
    );

    expect(summary).toContain('Ovulation Yes');
    expect(summary).toContain('Follicle Measured');
    expect(summary).toContain('Measurements 34, 36 mm');
    expect(summary).toContain('Consistency Firm');
    expect(summary).toContain('Structures Corpus Luteum');
  });

  it('falls back to legacy ovary text when no structured data exists', () => {
    expect(buildOvarySummary(BASE_LOG, 'right')).toBe('legacy right');
    expect(buildOvarySummary(BASE_LOG, 'left')).toBe('legacy left');
  });

  it('builds structured uterus summary and appends cysts', () => {
    const summary = buildUterusSummary({
      ...BASE_LOG,
      uterineToneCategory: 'tight',
      cervicalFirmness: 'closed',
      dischargeObserved: true,
      dischargeNotes: 'small stream',
      uterineCysts: '2 cm at left horn base',
    });

    expect(summary).toContain('Tone Tight');
    expect(summary).toContain('Cervix Closed');
    expect(summary).toContain('Discharge Yes');
    expect(summary).toContain('Discharge notes small stream');
    expect(summary).toContain('Cysts: 2 cm at left horn base');
  });

  it('falls back to legacy uterine tone and still surfaces cysts', () => {
    expect(
      buildUterusSummary({
        ...BASE_LOG,
        uterineCysts: 'single cyst',
      }),
    ).toBe('legacy tone • Cysts: single cyst');
  });
});
