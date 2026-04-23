import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./serialize', () => ({
  serializeBackup: vi.fn(),
}));

vi.mock('./fileIO', () => ({
  createSafetySnapshotFileName: vi.fn(),
  deleteFile: vi.fn(),
  ensureDirectoryExists: vi.fn(),
  getSafetySnapshotDirectoryUri: vi.fn(),
  joinFileUri: vi.fn(),
  listDirectoryFiles: vi.fn(),
  readTextFile: vi.fn(),
  writeJsonFile: vi.fn(),
}));

import { serializeBackup } from './serialize';
import {
  createSafetySnapshotFileName,
  deleteFile,
  ensureDirectoryExists,
  getSafetySnapshotDirectoryUri,
  joinFileUri,
  listDirectoryFiles,
  readTextFile,
  writeJsonFile,
} from './fileIO';
import { cloneBackupFixture } from './testFixtures';
import { createSafetySnapshot, listSafetySnapshots } from './safetyBackups';

describe('safetyBackups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSafetySnapshotDirectoryUri).mockReturnValue('file:///mock-documents/safety-snapshots/');
    vi.mocked(createSafetySnapshotFileName).mockImplementation((createdAt) => `snapshot-${createdAt}.json`);
    vi.mocked(joinFileUri).mockImplementation((dir, file) => `${dir}${file}`);
  });

  it('creates a safety snapshot and prunes older entries beyond the latest three', async () => {
    const backup = cloneBackupFixture();
    vi.mocked(serializeBackup).mockResolvedValue(backup);
    vi.mocked(listDirectoryFiles).mockResolvedValue([
      'file:///mock-documents/safety-snapshots/snapshot-a.json',
      'file:///mock-documents/safety-snapshots/snapshot-b.json',
      'file:///mock-documents/safety-snapshots/snapshot-c.json',
      'file:///mock-documents/safety-snapshots/snapshot-d.json',
    ]);
    vi.mocked(readTextFile)
      .mockResolvedValueOnce(JSON.stringify({ ...backup, createdAt: '2026-04-20T00:00:00.000Z' }))
      .mockResolvedValueOnce(JSON.stringify({ ...backup, createdAt: '2026-04-19T00:00:00.000Z' }))
      .mockResolvedValueOnce(JSON.stringify({ ...backup, createdAt: '2026-04-18T00:00:00.000Z' }))
      .mockResolvedValueOnce(JSON.stringify({ ...backup, createdAt: '2026-04-17T00:00:00.000Z' }));

    const summary = await createSafetySnapshot();

    expect(summary.fileName).toBe(`snapshot-${backup.createdAt}.json`);
    expect(ensureDirectoryExists).toHaveBeenCalledWith('file:///mock-documents/safety-snapshots/');
    expect(writeJsonFile).toHaveBeenCalledWith(
      `file:///mock-documents/safety-snapshots/snapshot-${backup.createdAt}.json`,
      expect.stringContaining('"schemaVersion": 4'),
    );
    expect(deleteFile).toHaveBeenCalledWith('file:///mock-documents/safety-snapshots/snapshot-d.json');
  });

  it('lists valid snapshots in newest-first order and ignores unreadable files', async () => {
    const backup = cloneBackupFixture();
    vi.mocked(listDirectoryFiles).mockResolvedValue([
      'file:///mock-documents/safety-snapshots/newer.json',
      'file:///mock-documents/safety-snapshots/older.json',
      'file:///mock-documents/safety-snapshots/bad.txt',
    ]);
    vi.mocked(readTextFile)
      .mockResolvedValueOnce(JSON.stringify({ ...backup, createdAt: '2026-04-20T00:00:00.000Z' }))
      .mockResolvedValueOnce(JSON.stringify({ ...backup, createdAt: '2026-04-18T00:00:00.000Z' }));

    const snapshots = await listSafetySnapshots();

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]?.createdAt).toBe('2026-04-20T00:00:00.000Z');
    expect(snapshots[1]?.createdAt).toBe('2026-04-18T00:00:00.000Z');
    expect(snapshots[0]?.fileName).toBe('newer.json');
  });

  it('does not fail snapshot creation when retention cleanup throws', async () => {
    const backup = cloneBackupFixture();
    vi.mocked(serializeBackup).mockResolvedValue(backup);
    vi.mocked(listDirectoryFiles).mockRejectedValue(new Error('directory unavailable'));

    await expect(createSafetySnapshot()).resolves.toMatchObject({
      schemaVersion: 4,
      mareCount: 1,
    });
  });
});
