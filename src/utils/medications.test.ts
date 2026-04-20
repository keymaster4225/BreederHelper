import { describe, expect, it } from 'vitest';

import { formatRoute } from './medications';

describe('medications', () => {
  it('formats medication routes with the existing labels', () => {
    expect(formatRoute('oral')).toBe('Oral');
    expect(formatRoute('intrauterine')).toBe('Intrauterine');
    expect(formatRoute('IM')).toBe('IM');
    expect(formatRoute('IV')).toBe('IV');
    expect(formatRoute('SQ')).toBe('SQ');
    expect(formatRoute('topical')).toBe('topical');
  });
});
