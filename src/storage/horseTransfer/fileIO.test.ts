import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(),
}));

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///breedwise/',
  getInfoAsync: vi.fn(async () => ({ exists: true })),
  makeDirectoryAsync: vi.fn(),
  readAsStringAsync: vi.fn(),
  writeAsStringAsync: vi.fn(),
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: vi.fn(),
  shareAsync: vi.fn(),
}));

import { createHorseTransferFileName } from './fileIO';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { cloneBackupFixture } from '@/storage/backup/testFixtures';
import {
  BACKUP_SCHEMA_VERSION_CURRENT,
  type BackupTableName,
} from '@/storage/backup/types';
import {
  HORSE_TRANSFER_ARTIFACT_TYPE,
  HORSE_TRANSFER_VERSION,
  type HorseTransferEnvelopeV1,
} from './types';
import { shareHorseTransferFileIfAvailable, writeHorseTransferFile } from './fileIO';

describe('horse transfer file I/O helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates mare and stallion filename stems with normalized slugs', () => {
    expect(
      createHorseTransferFileName(
        { type: 'mare', name: "  Maple's   Ridge!!  " },
        '2026-04-28T14:05:06.000Z',
      ),
    ).toBe('breedwise-mare-maple-s-ridge-v1-20260428-140506.json');
    expect(
      createHorseTransferFileName(
        { type: 'stallion', name: 'Cafe du Monde' },
        '2026-04-28T14:05:06.000Z',
      ),
    ).toBe('breedwise-stallion-cafe-du-monde-v1-20260428-140506.json');
  });

  it('caps slugs at 48 characters and falls back to horse', () => {
    expect(
      createHorseTransferFileName(
        { type: 'mare', name: 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz' },
        '2026-04-28T14:05:06.000Z',
      ),
    ).toBe(
      'breedwise-mare-abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuv-v1-20260428-140506.json',
    );
    expect(
      createHorseTransferFileName(
        { type: 'stallion', name: '!!!' },
        '2026-04-28T14:05:06.000Z',
      ),
    ).toBe('breedwise-stallion-horse-v1-20260428-140506.json');
  });

  it('writes horse package JSON with the horse filename', async () => {
    const envelope = createMareEnvelope();

    const result = await writeHorseTransferFile(envelope, 'file:///exports');

    expect(result.fileName).toBe('breedwise-mare-maple-v1-20260428-140506.json');
    expect(result.fileUri).toBe('file:///exports/breedwise-mare-maple-v1-20260428-140506.json');
    expect(result.jsonText).toBe(JSON.stringify(envelope, null, 2));
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(result.fileUri, result.jsonText);
  });

  it('shares horse packages with horse-package copy', async () => {
    vi.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);

    const shared = await shareHorseTransferFileIfAvailable('file:///exports/package.json');

    expect(shared).toBe(true);
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///exports/package.json', {
      mimeType: 'application/json',
      dialogTitle: 'Share horse package',
    });
  });

  it('does not lazy-load Expo native modules during file operations', () => {
    const source = readFileSync(new URL('./fileIO.ts', import.meta.url), 'utf8');

    expect(source).not.toContain("import('expo-document-picker')");
    expect(source).not.toContain("import('expo-file-system/legacy')");
    expect(source).not.toContain("import('expo-sharing')");
  });
});

function createMareEnvelope(): HorseTransferEnvelopeV1 {
  const backup = cloneBackupFixture();
  const emptyTables = Object.fromEntries(
    Object.keys(backup.tables).map((tableName) => [tableName, []]),
  ) as Record<BackupTableName, []>;

  return {
    artifactType: HORSE_TRANSFER_ARTIFACT_TYPE,
    transferVersion: HORSE_TRANSFER_VERSION,
    dataSchemaVersion: BACKUP_SCHEMA_VERSION_CURRENT,
    createdAt: '2026-04-28T14:05:06.000Z',
    app: {
      name: 'BreedWise',
      version: '1.3.5',
    },
    sourceHorse: {
      type: 'mare',
      id: 'mare-1',
      name: 'Maple',
      registrationNumber: null,
      dateOfBirth: null,
    },
    privacy: {
      redactedContextStallions: true,
      redactedDoseRecipientAndShipping: false,
    },
    tables: {
      ...emptyTables,
      mares: backup.tables.mares,
    },
  };
}
