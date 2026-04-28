import { describe, expect, it } from 'vitest';

import type { HorseTransferSourceHorse } from './types';
import { matchHorseTransfer, type HorseIdentityMatch } from './matching';

function createSourceHorse(
  overrides: Partial<HorseTransferSourceHorse> = {},
): HorseTransferSourceHorse {
  return {
    type: 'mare',
    id: 'source-horse',
    name: 'Maple',
    registrationNumber: null,
    dateOfBirth: null,
    ...overrides,
  };
}

function createDestinationHorse(
  overrides: Partial<HorseIdentityMatch> = {},
): HorseIdentityMatch {
  return {
    id: 'dest-horse',
    name: 'Maple',
    registrationNumber: null,
    dateOfBirth: null,
    deletedAt: null,
    ...overrides,
  };
}

describe('matchHorseTransfer', () => {
  it('matches by internal ID first', () => {
    const result = matchHorseTransfer({
      sourceHorse: createSourceHorse({
        id: 'mare-1',
        registrationNumber: 'REG-1',
        dateOfBirth: '2018-02-02',
      }),
      destinationHorses: [
        createDestinationHorse({
          id: 'mare-1',
          name: 'Maple',
          registrationNumber: 'reg-1',
          dateOfBirth: '2018-02-02',
        }),
        createDestinationHorse({
          id: 'mare-2',
          name: 'Willow',
          registrationNumber: 'REG-2',
          dateOfBirth: '2019-03-03',
        }),
      ],
    });

    expect(result.state).toBe('matched');
    if (result.state !== 'matched') {
      throw new Error('Expected exact match');
    }
    expect(result.matchedBy).toBe('id');
    expect(result.horse.id).toBe('mare-1');
  });

  it('matches by registration when ID does not match', () => {
    const result = matchHorseTransfer({
      sourceHorse: createSourceHorse({
        id: 'new-id',
        registrationNumber: '  abc-123  ',
        dateOfBirth: null,
      }),
      destinationHorses: [
        createDestinationHorse({
          id: 'mare-10',
          name: 'North Star',
          registrationNumber: 'ABC-123',
        }),
      ],
    });

    expect(result.state).toBe('matched');
    if (result.state !== 'matched') {
      throw new Error('Expected exact match');
    }
    expect(result.matchedBy).toBe('registration');
    expect(result.horse.id).toBe('mare-10');
  });

  it('matches by normalized name plus DOB when ID and registration are unavailable', () => {
    const result = matchHorseTransfer({
      sourceHorse: createSourceHorse({
        id: 'new-id',
        name: '  Maple   Dawn ',
        registrationNumber: null,
        dateOfBirth: '2017-04-04',
      }),
      destinationHorses: [
        createDestinationHorse({
          id: 'mare-20',
          name: 'maple dawn',
          registrationNumber: null,
          dateOfBirth: '2017-04-04',
        }),
      ],
    });

    expect(result.state).toBe('matched');
    if (result.state !== 'matched') {
      throw new Error('Expected exact match');
    }
    expect(result.matchedBy).toBe('nameAndDob');
    expect(result.horse.id).toBe('mare-20');
  });

  it('marks conflicting exact signals as ambiguous', () => {
    const result = matchHorseTransfer({
      sourceHorse: createSourceHorse({
        id: 'mare-1',
        registrationNumber: 'REG-2',
        name: 'Maple',
        dateOfBirth: '2018-02-02',
      }),
      destinationHorses: [
        createDestinationHorse({
          id: 'mare-1',
          name: 'Maple',
          registrationNumber: 'REG-1',
          dateOfBirth: '2018-02-02',
        }),
        createDestinationHorse({
          id: 'mare-2',
          name: 'Willow',
          registrationNumber: 'REG-2',
          dateOfBirth: '2019-01-01',
        }),
      ],
    });

    expect(result.state).toBe('ambiguous');
    if (result.state !== 'ambiguous') {
      throw new Error('Expected ambiguous match state');
    }
    expect(result.reasons).toContain('conflicting_exact_matches');
    expect(result.candidates.map((horse) => horse.id)).toEqual(['mare-1', 'mare-2']);
  });

  it('marks a soft-deleted ID match as ambiguous', () => {
    const result = matchHorseTransfer({
      sourceHorse: createSourceHorse({
        id: 'mare-1',
      }),
      destinationHorses: [
        createDestinationHorse({
          id: 'mare-1',
          deletedAt: '2026-04-28T12:00:00.000Z',
        }),
      ],
    });

    expect(result.state).toBe('ambiguous');
    if (result.state !== 'ambiguous') {
      throw new Error('Expected ambiguous match state');
    }
    expect(result.reasons).toContain('soft_deleted_id_match');
  });

  it('requires confirmation when ID matches but lower-precedence identity fields contradict', () => {
    const result = matchHorseTransfer({
      sourceHorse: createSourceHorse({
        id: 'mare-1',
        name: 'Maple',
        registrationNumber: 'REG-1',
        dateOfBirth: '2018-02-02',
      }),
      destinationHorses: [
        createDestinationHorse({
          id: 'mare-1',
          name: 'Willow',
          registrationNumber: 'REG-9',
          dateOfBirth: '2017-01-01',
        }),
      ],
    });

    expect(result.state).toBe('ambiguous');
    if (result.state !== 'ambiguous') {
      throw new Error('Expected ambiguous match state');
    }
    expect(result.reasons).toContain('id_identity_conflict');
  });

  it('keeps fuzzy candidates as suggestions only when score is above threshold', () => {
    const result = matchHorseTransfer({
      sourceHorse: createSourceHorse({
        id: 'new-id',
        name: 'Maple Farms',
      }),
      destinationHorses: [
        createDestinationHorse({
          id: 'mare-maple',
          name: 'Maple Ranch',
        }),
        createDestinationHorse({
          id: 'mare-other',
          name: 'Riverstone',
        }),
      ],
    });

    expect(result.state).toBe('create_new');
    expect(result.fuzzySuggestions.map((entry) => entry.horse.id)).toEqual(['mare-maple']);
    expect(result.fuzzySuggestions[0].score).toBeGreaterThanOrEqual(0.6);
  });

  it('disqualifies fuzzy candidates when registration numbers or DOBs conflict', () => {
    const registrationConflictResult = matchHorseTransfer({
      sourceHorse: createSourceHorse({
        id: 'new-id',
        name: 'Maple Farms',
        registrationNumber: 'REG-100',
        dateOfBirth: null,
      }),
      destinationHorses: [
        createDestinationHorse({
          id: 'mare-reg-conflict',
          name: 'Maple Ranch',
          registrationNumber: 'REG-999',
          dateOfBirth: null,
        }),
      ],
    });

    expect(registrationConflictResult.state).toBe('create_new');
    expect(registrationConflictResult.fuzzySuggestions).toEqual([]);

    const dobConflictResult = matchHorseTransfer({
      sourceHorse: createSourceHorse({
        id: 'new-id',
        name: 'Maple Farms',
        registrationNumber: null,
        dateOfBirth: '2018-02-02',
      }),
      destinationHorses: [
        createDestinationHorse({
          id: 'mare-dob-conflict',
          name: 'Maple Ranch',
          registrationNumber: null,
          dateOfBirth: '2017-01-01',
        }),
      ],
    });

    expect(dobConflictResult.state).toBe('create_new');
    expect(dobConflictResult.fuzzySuggestions).toEqual([]);
  });

  it('does not exact-match a soft-deleted registration candidate', () => {
    const result = matchHorseTransfer({
      sourceHorse: createSourceHorse({
        id: 'new-id',
        name: 'Maple',
        registrationNumber: 'REG-100',
        dateOfBirth: null,
      }),
      destinationHorses: [
        createDestinationHorse({
          id: 'mare-soft-deleted',
          name: 'Maple',
          registrationNumber: 'REG-100',
          dateOfBirth: null,
          deletedAt: '2026-04-28T12:00:00.000Z',
        }),
      ],
    });

    expect(result.state).toBe('create_new');
    expect(result.fuzzySuggestions).toEqual([]);
  });

  it('does not exact-match a soft-deleted name and DOB candidate', () => {
    const result = matchHorseTransfer({
      sourceHorse: createSourceHorse({
        id: 'new-id',
        name: 'Maple Dawn',
        registrationNumber: null,
        dateOfBirth: '2018-02-02',
      }),
      destinationHorses: [
        createDestinationHorse({
          id: 'mare-soft-deleted',
          name: 'Maple Dawn',
          registrationNumber: null,
          dateOfBirth: '2018-02-02',
          deletedAt: '2026-04-28T12:00:00.000Z',
        }),
      ],
    });

    expect(result.state).toBe('create_new');
    expect(result.fuzzySuggestions).toEqual([]);
  });
});
