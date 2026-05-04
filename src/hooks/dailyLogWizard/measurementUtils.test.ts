import { describe, expect, it } from 'vitest';

import type { DailyLogWizardOvaryDraft } from './types';
import {
  getOvaryFollicleFinding,
  getPrimaryFindingStructure,
  isPrimaryFindingStructure,
  removePrimaryFindingStructures,
} from './measurementUtils';

function createOvaryDraft(
  overrides: Partial<DailyLogWizardOvaryDraft> = {},
): DailyLogWizardOvaryDraft {
  return {
    ovulation: null,
    follicleState: null,
    follicleMeasurements: [],
    consistency: null,
    structures: [],
    ...overrides,
  };
}

describe('daily log wizard follicle finding helpers', () => {
  it('maps UI findings to their backing ovary structures', () => {
    expect(getPrimaryFindingStructure('msf')).toBe('multipleSmallFollicles');
    expect(getPrimaryFindingStructure('ahf')).toBe('hemorrhagicAnovulatoryFollicle');
    expect(getPrimaryFindingStructure('cl')).toBe('corpusLuteum');
    expect(getPrimaryFindingStructure('measured')).toBeNull();
    expect(getPrimaryFindingStructure('')).toBeNull();
  });

  it('filters primary finding structures without mutating the caller array', () => {
    const structures = [
      'follicularCyst',
      'multipleSmallFollicles',
      'adhesion',
      'corpusLuteum',
    ] as const;

    expect(structures.filter(isPrimaryFindingStructure)).toEqual([
      'multipleSmallFollicles',
      'corpusLuteum',
    ]);
    expect(removePrimaryFindingStructures(structures)).toEqual(['follicularCyst', 'adhesion']);
    expect(structures).toEqual([
      'follicularCyst',
      'multipleSmallFollicles',
      'adhesion',
      'corpusLuteum',
    ]);
  });

  it('derives a measured finding before checking stale structures', () => {
    expect(
      getOvaryFollicleFinding(
        createOvaryDraft({
          follicleState: 'measured',
          structures: ['multipleSmallFollicles'],
        }),
      ),
    ).toBe('measured');
  });

  it('derives a single primary structure finding', () => {
    expect(
      getOvaryFollicleFinding(createOvaryDraft({ structures: ['multipleSmallFollicles'] })),
    ).toBe('msf');
    expect(
      getOvaryFollicleFinding(
        createOvaryDraft({ structures: ['hemorrhagicAnovulatoryFollicle'] }),
      ),
    ).toBe('ahf');
    expect(getOvaryFollicleFinding(createOvaryDraft({ structures: ['corpusLuteum'] }))).toBe(
      'cl',
    );
  });

  it('leaves the selector unset when there is no single primary structure', () => {
    expect(getOvaryFollicleFinding(createOvaryDraft())).toBe('');
    expect(
      getOvaryFollicleFinding(
        createOvaryDraft({ structures: ['multipleSmallFollicles', 'corpusLuteum'] }),
      ),
    ).toBe('');
  });
});
