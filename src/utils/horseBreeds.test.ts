import { describe, expect, it } from 'vitest';

import { getBreedSuggestions, HORSE_BREEDS } from './horseBreeds';

describe('getBreedSuggestions', () => {
  it('ranks exact matches ahead of prefix and token matches', () => {
    const options = ['Warmblood', 'Warmblood Sport Horse', 'American Warmblood'];

    expect(getBreedSuggestions('warmblood', options, 3)).toEqual([
      'Warmblood',
      'Warmblood Sport Horse',
      'American Warmblood',
    ]);
  });

  it('matches case-insensitively and ignores surrounding whitespace', () => {
    expect(getBreedSuggestions('  kwpn ', ['KWPN', 'Hanoverian'], 2)).toEqual(['KWPN']);
  });

  it('deduplicates repeated breeds before returning suggestions', () => {
    expect(getBreedSuggestions('arab', ['Arabian', 'Arabian', 'Arabian'], 5)).toEqual(['Arabian']);
  });

  it('returns the initial alphabetized browse list when the query is empty', () => {
    expect(getBreedSuggestions('', ['Quarter Horse', 'Arabian', 'Belgian'], 2)).toEqual([
      'Arabian',
      'Belgian',
    ]);
  });

  it('returns all sorted breeds when no suggestion limit is provided', () => {
    expect(getBreedSuggestions('', ['Quarter Horse', 'Arabian', 'Belgian'])).toEqual([
      'Arabian',
      'Belgian',
      'Quarter Horse',
    ]);
  });

  it('includes requested iberian-related and crossbreed entries in the bundled list', () => {
    expect(HORSE_BREEDS).toContain('Iberian');
    expect(HORSE_BREEDS).toContain('Pura Raza Española (PRE)');
    expect(HORSE_BREEDS).toContain('Warlander');
  });
});
