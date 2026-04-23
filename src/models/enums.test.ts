import { describe, expect, it } from 'vitest';

import {
  AI_BREEDING_METHOD_OPTIONS,
  COLLECTION_TARGET_MODE_OPTIONS,
  DOSE_EVENT_TYPE_OPTIONS,
  FOAL_COLOR_OPTIONS,
  FOAL_SEX_VALUES,
  FOAL_MILESTONE_KEYS,
  FOAL_SEX_OPTIONS,
  FOALING_OUTCOME_VALUES,
  FOALING_OUTCOME_OPTIONS,
  FREEZING_EXTENDER_OPTIONS,
  MEDICATION_ROUTE_OPTIONS,
  PREGNANCY_RESULT_OPTIONS,
  STRAW_COLOR_OPTIONS,
} from './enums';

describe('shared enum definitions', () => {
  it('preserves AI breeding method picker labels and order', () => {
    expect(AI_BREEDING_METHOD_OPTIONS).toEqual([
      { label: 'Fresh', value: 'freshAI' },
      { label: 'Shipped Cooled', value: 'shippedCooledAI' },
      { label: 'Frozen', value: 'frozenAI' },
    ]);
  });

  it('keeps foaling and foal picker options aligned with current UI behavior', () => {
    expect(FOALING_OUTCOME_VALUES).toEqual([
      'liveFoal',
      'stillbirth',
      'aborted',
      'unknown',
    ]);

    expect(FOALING_OUTCOME_OPTIONS).toEqual([
      { label: 'Live Foal', value: 'liveFoal' },
      { label: 'Stillbirth', value: 'stillbirth' },
      { label: 'Aborted', value: 'aborted' },
    ]);

    expect(FOAL_SEX_VALUES).toEqual([
      'colt',
      'filly',
      'unknown',
    ]);

    expect(FOAL_SEX_OPTIONS).toEqual([
      { label: 'Colt', value: 'colt' },
      { label: 'Filly', value: 'filly' },
    ]);

    expect(FOAL_COLOR_OPTIONS).toEqual([
      { label: 'Bay', value: 'bay' },
      { label: 'Chestnut', value: 'chestnut' },
      { label: 'Black', value: 'black' },
      { label: 'Gray', value: 'gray' },
      { label: 'Palomino', value: 'palomino' },
      { label: 'Buckskin', value: 'buckskin' },
      { label: 'Roan', value: 'roan' },
      { label: 'Pinto/Paint', value: 'pintoPaint' },
      { label: 'Sorrel', value: 'sorrel' },
      { label: 'Dun', value: 'dun' },
      { label: 'Cremello', value: 'cremello' },
      { label: 'Other', value: 'other' },
    ]);
  });

  it('preserves shared values for validation and form utilities', () => {
    expect(PREGNANCY_RESULT_OPTIONS).toEqual([
      { label: 'Positive', value: 'positive' },
      { label: 'Negative', value: 'negative' },
    ]);

    expect(MEDICATION_ROUTE_OPTIONS).toEqual([
      { label: 'Oral', value: 'oral' },
      { label: 'IM', value: 'IM' },
      { label: 'IV', value: 'IV' },
      { label: 'Intrauterine', value: 'intrauterine' },
      { label: 'SQ', value: 'SQ' },
    ]);

    expect(DOSE_EVENT_TYPE_OPTIONS).toEqual([
      { label: 'Shipped', value: 'shipped' },
      { label: 'On-farm', value: 'usedOnSite' },
    ]);

    expect(FOAL_MILESTONE_KEYS).toEqual([
      'stood',
      'nursed',
      'passedMeconium',
      'iggTested',
      'enemaGiven',
      'umbilicalTreated',
      'firstVetCheck',
    ]);

    expect(FREEZING_EXTENDER_OPTIONS).toEqual([
      { label: 'BotuCrio', value: 'BotuCrio' },
      { label: 'INRA Freeze', value: 'INRA Freeze' },
      { label: 'Gent', value: 'Gent' },
      { label: 'HF-20', value: 'HF-20' },
      { label: 'Equex STM', value: 'Equex STM' },
      { label: 'Lactose-EDTA-egg-yolk', value: 'Lactose-EDTA-egg-yolk' },
      { label: 'Skim milk-glycerol', value: 'Skim milk-glycerol' },
      { label: 'Other', value: 'Other' },
    ]);

    expect(STRAW_COLOR_OPTIONS).toEqual([
      { label: 'Yellow', value: 'Yellow' },
      { label: 'Pink', value: 'Pink' },
      { label: 'Blue', value: 'Blue' },
      { label: 'Green', value: 'Green' },
      { label: 'Red', value: 'Red' },
      { label: 'Orange', value: 'Orange' },
      { label: 'Purple', value: 'Purple' },
      { label: 'White', value: 'White' },
      { label: 'Black', value: 'Black' },
      { label: 'Clear', value: 'Clear' },
      { label: 'Other', value: 'Other' },
    ]);

    expect(COLLECTION_TARGET_MODE_OPTIONS).toEqual([
      { label: 'Progressive', value: 'progressive' },
      { label: 'Total', value: 'total' },
    ]);
  });
});
