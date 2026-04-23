import { describe, expect, it } from 'vitest';

import {
  formatFreezingExtender,
  formatFrozenBatchDoseSummary,
  formatFrozenBatchSource,
  formatStrawColor,
} from './frozenSemenDisplay';

describe('formatFreezingExtender', () => {
  it('formats Gent with the display-only alias', () => {
    expect(formatFreezingExtender('Gent', null)).toBe('Gent (Cryo-Gent)');
  });

  it('returns custom Other values when provided', () => {
    expect(formatFreezingExtender('Other', 'Custom Blend')).toBe('Custom Blend');
  });

  it('falls back safely for null and blank Other values', () => {
    expect(formatFreezingExtender(null, null)).toBe('Unknown');
    expect(formatFreezingExtender('Other', '   ')).toBe('Other');
  });
});

describe('formatStrawColor', () => {
  it('formats named colors directly', () => {
    expect(formatStrawColor('Blue', null)).toBe('Blue');
  });

  it('returns custom Other values when present', () => {
    expect(formatStrawColor('Other', 'Striped')).toBe('Striped');
  });

  it('falls back for null and blank Other values', () => {
    expect(formatStrawColor(null, null)).toBe('Unknown');
    expect(formatStrawColor('Other', '  ')).toBe('Other');
  });
});

describe('formatFrozenBatchSource', () => {
  it('formats linked source dates using MM-DD-YYYY', () => {
    expect(formatFrozenBatchSource('2026-04-22')).toBe('From collection 04-22-2026');
  });

  it('shows standalone source label when no collection date is available', () => {
    expect(formatFrozenBatchSource(null)).toBe('Standalone');
  });
});

describe('formatFrozenBatchDoseSummary', () => {
  it('returns null when strawsPerDose is not set', () => {
    expect(formatFrozenBatchDoseSummary(24, null)).toBeNull();
  });

  it('formats full-dose values without leftover straws', () => {
    expect(formatFrozenBatchDoseSummary(24, 2)).toBe('12 doses');
  });

  it('formats leftover straws when present', () => {
    expect(formatFrozenBatchDoseSummary(25, 2)).toBe('12 doses + 1 leftover straw');
  });
});
