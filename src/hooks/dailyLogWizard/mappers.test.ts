import { describe, expect, it } from 'vitest';

import type { DailyLogDetail } from '@/models/types';

import {
  buildDailyLogPayload,
  hydrateDailyLogWizardRecord,
} from './mappers';
import { getOvaryFollicleFinding } from './measurementUtils';

describe('daily log wizard mappers', () => {
  it('hydrates a legacy daily log into wizard state without dropping legacy notes', () => {
    const record: DailyLogDetail = {
      id: 'log-1',
      mareId: 'mare-1',
      date: '2026-04-01',
      time: null,
      teasingScore: 3,
      rightOvary: 'legacy right',
      leftOvary: 'legacy left',
      rightOvaryOvulation: null,
      rightOvaryFollicleState: 'measured',
      rightOvaryFollicleMeasurementsMm: [35.5],
      rightOvaryConsistency: 'soft',
      rightOvaryStructures: ['corpusLuteum'],
      leftOvaryOvulation: null,
      leftOvaryFollicleState: null,
      leftOvaryFollicleMeasurementsMm: [],
      leftOvaryConsistency: null,
      leftOvaryStructures: [],
      ovulationDetected: true,
      edema: 2,
      uterineTone: 'legacy tone',
      uterineToneCategory: 'moderate',
      cervicalFirmness: 'soft',
      dischargeObserved: true,
      dischargeNotes: 'Observed',
      uterineCysts: 'small',
      notes: 'Original note',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
      uterineFluidPockets: [
        {
          id: 'pocket-1',
          dailyLogId: 'log-1',
          depthMm: 5,
          location: 'leftHorn',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
      ],
      uterineFlush: null,
    };

    const hydrated = hydrateDailyLogWizardRecord(record);

    expect(hydrated.ovulationSource).toBe('legacy');
    expect(hydrated.time).toBe('');
    expect(hydrated.legacyNotes).toEqual({
      rightOvary: 'legacy right',
      leftOvary: 'legacy left',
      uterineTone: 'legacy tone',
    });
    expect(hydrated.rightOvary.follicleMeasurements).toHaveLength(1);
    expect(hydrated.rightOvary.follicleMeasurements[0]?.value).toBe('35.5');
    expect(hydrated.uterus.fluidPockets).toEqual([
      {
        clientId: 'pocket-1',
        id: 'pocket-1',
        depthMm: 5,
        location: 'leftHorn',
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      },
    ]);
  });

  it('builds a legacy-preserving edit payload when structured ovulation was not touched', () => {
    const payload = buildDailyLogPayload({
      isEdit: true,
      date: ' 2026-04-02 ',
      time: ' 09:45 ',
      teasingScore: '4',
      rightOvary: {
        ovulation: null,
        follicleState: null,
        follicleMeasurements: [],
        consistency: null,
        structures: [],
      },
      leftOvary: {
        ovulation: null,
        follicleState: null,
        follicleMeasurements: [],
        consistency: null,
        structures: [],
      },
      uterus: {
        edema: '',
        uterineToneCategory: 'tight',
        cervicalFirmness: 'soft',
        dischargeObserved: true,
        dischargeNotes: '  Needs monitoring  ',
        uterineCysts: '  small cyst  ',
        fluidPockets: [
          {
            clientId: 'pocket-1',
            id: 'pocket-1',
            depthMm: 4,
            location: 'uterineBody',
            createdAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-02T00:00:00.000Z',
          },
        ],
      },
      flushDecision: 'no',
      flush: {
        baseSolution: '',
        totalVolumeMl: '',
        notes: '',
        products: [],
      },
      hadPersistedFlush: false,
      notes: '  keep note  ',
      legacyOvulationDetected: true,
      ovulationSource: 'legacy',
    });

    expect(payload).toMatchObject({
      date: '2026-04-02',
      time: '09:45',
      teasingScore: 4,
      ovulationSource: 'legacy',
      ovulationDetected: true,
      dischargeNotes: 'Needs monitoring',
      uterineCysts: 'small cyst',
      notes: 'keep note',
    });
    expect(payload.uterineFluidPockets).toEqual([
      {
        id: 'pocket-1',
        depthMm: 4,
        location: 'uterineBody',
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-02T00:00:00.000Z',
      },
    ]);
  });

  it('builds a structured payload with sorted valid measured follicle sizes', () => {
    const payload = buildDailyLogPayload({
      isEdit: false,
      date: '2026-04-03',
      time: '16:00',
      teasingScore: '',
      rightOvary: {
        ovulation: true,
        follicleState: 'measured',
        follicleMeasurements: [
          { clientId: 'row-1', value: '35' },
          { clientId: 'row-2', value: 'bad' },
          { clientId: 'row-3', value: '35.5' },
          { clientId: 'row-5', value: '35.5' },
        ],
        consistency: 'soft',
        structures: ['multipleSmallFollicles'],
      },
      leftOvary: {
        ovulation: false,
        follicleState: 'large',
        follicleMeasurements: [{ clientId: 'row-4', value: '42' }],
        consistency: null,
        structures: [],
      },
      uterus: {
        edema: '2',
        uterineToneCategory: null,
        cervicalFirmness: null,
        dischargeObserved: false,
        dischargeNotes: 'ignored',
        uterineCysts: '',
        fluidPockets: [],
      },
      flushDecision: null,
      flush: {
        baseSolution: '',
        totalVolumeMl: '',
        notes: '',
        products: [],
      },
      hadPersistedFlush: false,
      notes: '',
      legacyOvulationDetected: null,
      ovulationSource: 'structured',
    });

    expect(payload.ovulationSource).toBe('structured');
    expect(payload.time).toBe('16:00');
    expect(payload.ovulationDetected).toBeUndefined();
    expect(payload.rightOvaryFollicleMeasurementsMm).toEqual([35.5, 35.5, 35]);
    expect(payload.leftOvaryFollicleMeasurementsMm).toEqual([]);
    expect(payload.edema).toBe(2);
    expect(payload.dischargeNotes).toBe('ignored');
  });

  it('preserves stored ovary structures and derives a single primary finding during edit hydration', () => {
    const record: DailyLogDetail = {
      id: 'log-1',
      mareId: 'mare-1',
      date: '2026-04-01',
      time: '08:30',
      teasingScore: null,
      rightOvary: null,
      leftOvary: null,
      rightOvaryOvulation: null,
      rightOvaryFollicleState: null,
      rightOvaryFollicleMeasurementsMm: [],
      rightOvaryConsistency: null,
      rightOvaryStructures: ['multipleSmallFollicles'],
      leftOvaryOvulation: null,
      leftOvaryFollicleState: null,
      leftOvaryFollicleMeasurementsMm: [],
      leftOvaryConsistency: null,
      leftOvaryStructures: ['follicularCyst', 'multipleSmallFollicles'],
      ovulationDetected: null,
      edema: null,
      uterineTone: null,
      uterineToneCategory: null,
      cervicalFirmness: null,
      dischargeObserved: null,
      dischargeNotes: null,
      uterineCysts: null,
      notes: null,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
      uterineFluidPockets: [],
      uterineFlush: null,
    };

    const hydrated = hydrateDailyLogWizardRecord(record);

    expect(hydrated.rightOvary.structures).toEqual(['multipleSmallFollicles']);
    expect(getOvaryFollicleFinding(hydrated.rightOvary)).toBe('msf');
    expect(hydrated.leftOvary.structures).toEqual(['follicularCyst', 'multipleSmallFollicles']);
    expect(getOvaryFollicleFinding(hydrated.leftOvary)).toBe('msf');
  });

  it('preserves legacy multi-primary structures and derives an unset selector', () => {
    const record: DailyLogDetail = {
      id: 'log-1',
      mareId: 'mare-1',
      date: '2026-04-01',
      time: '08:30',
      teasingScore: null,
      rightOvary: null,
      leftOvary: null,
      rightOvaryOvulation: null,
      rightOvaryFollicleState: null,
      rightOvaryFollicleMeasurementsMm: [],
      rightOvaryConsistency: null,
      rightOvaryStructures: ['multipleSmallFollicles', 'corpusLuteum'],
      leftOvaryOvulation: null,
      leftOvaryFollicleState: 'measured',
      leftOvaryFollicleMeasurementsMm: [34],
      leftOvaryConsistency: null,
      leftOvaryStructures: ['corpusLuteum'],
      ovulationDetected: null,
      edema: null,
      uterineTone: null,
      uterineToneCategory: null,
      cervicalFirmness: null,
      dischargeObserved: null,
      dischargeNotes: null,
      uterineCysts: null,
      notes: null,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
      uterineFluidPockets: [],
      uterineFlush: null,
    };

    const hydrated = hydrateDailyLogWizardRecord(record);

    expect(hydrated.rightOvary.structures).toEqual([
      'multipleSmallFollicles',
      'corpusLuteum',
    ]);
    expect(getOvaryFollicleFinding(hydrated.rightOvary)).toBe('');
    expect(hydrated.leftOvary.structures).toEqual(['corpusLuteum']);
    expect(getOvaryFollicleFinding(hydrated.leftOvary)).toBe('measured');
  });
});
