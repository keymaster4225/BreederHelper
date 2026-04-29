import { act, renderHook } from '@testing-library/react-native';

jest.mock('@/storage/horseTransfer', () => ({
  importHorseTransfer: jest.fn(),
  pickHorseTransferFile: jest.fn(),
  previewHorseImport: jest.fn(),
  readHorseTransferTextFile: jest.fn(),
  validateHorseTransferJson: jest.fn(),
}));

const horseTransfer = jest.requireMock('@/storage/horseTransfer') as {
  importHorseTransfer: jest.Mock;
  pickHorseTransferFile: jest.Mock;
  previewHorseImport: jest.Mock;
  readHorseTransferTextFile: jest.Mock;
  validateHorseTransferJson: jest.Mock;
};

import { useHorseImport } from './useHorseImport';

describe('useHorseImport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    horseTransfer.pickHorseTransferFile.mockResolvedValue({
      canceled: false,
      name: 'nova-horse-package.json',
      uri: 'file:///nova-horse-package.json',
      mimeType: 'application/json',
    });
    horseTransfer.readHorseTransferTextFile.mockResolvedValue('{"artifactType":"breedwise.horseTransfer"}');
    horseTransfer.validateHorseTransferJson.mockReturnValue({
      ok: true,
      envelope: createEnvelope(),
      preview: {},
    });
    horseTransfer.previewHorseImport.mockResolvedValue({
      preview: createPreview(),
      match: {
        state: 'create_new',
        fuzzySuggestions: [],
      },
    });
    horseTransfer.importHorseTransfer.mockResolvedValue({
      ok: true,
      safetySnapshotCreated: true,
      summary: createSummary(),
    });
  });

  it('does not read or validate when file picking is canceled', async () => {
    horseTransfer.pickHorseTransferFile.mockResolvedValue({ canceled: true });

    const { result } = renderHook(() => useHorseImport());

    let prepareResult: Awaited<ReturnType<typeof result.current.prepareImportFromPickedFile>> | null = null;
    await act(async () => {
      prepareResult = await result.current.prepareImportFromPickedFile();
    });

    expect(prepareResult).toEqual({ ok: false, canceled: true });
    expect(result.current.pendingImport).toBeNull();
    expect(horseTransfer.readHorseTransferTextFile).not.toHaveBeenCalled();
    expect(horseTransfer.validateHorseTransferJson).not.toHaveBeenCalled();
  });

  it('surfaces validation failures without building a preview', async () => {
    horseTransfer.validateHorseTransferJson.mockReturnValue({
      ok: false,
      error: {
        message: 'Horse package artifactType is invalid.',
      },
    });

    const { result } = renderHook(() => useHorseImport());

    let prepareResult: Awaited<ReturnType<typeof result.current.prepareImportFromPickedFile>> | null = null;
    await act(async () => {
      prepareResult = await result.current.prepareImportFromPickedFile();
    });

    expect(prepareResult).toEqual({
      ok: false,
      errorMessage: 'Horse package artifactType is invalid.',
    });
    expect(result.current.errorMessage).toBe('Horse package artifactType is invalid.');
    expect(result.current.pendingImport).toBeNull();
    expect(horseTransfer.previewHorseImport).not.toHaveBeenCalled();
  });

  it('defaults matched previews to a confirmed existing target', async () => {
    horseTransfer.previewHorseImport.mockResolvedValue({
      preview: createPreview(),
      match: {
        state: 'matched',
        matchedBy: 'id',
        horse: {
          id: 'mare-local',
          name: 'Local Nova',
          registrationNumber: null,
          dateOfBirth: null,
          deletedAt: null,
        },
        fuzzySuggestions: [],
      },
    });

    const { result } = renderHook(() => useHorseImport());

    await act(async () => {
      await result.current.prepareImportFromPickedFile();
    });

    expect(result.current.pendingImport?.selectedTarget).toEqual({
      kind: 'confirmed_match',
      destinationHorseId: 'mare-local',
    });
  });

  it('defaults create-new previews to a create-new target', async () => {
    const { result } = renderHook(() => useHorseImport());

    await act(async () => {
      await result.current.prepareImportFromPickedFile();
    });

    expect(result.current.pendingImport?.selectedTarget).toEqual({ kind: 'create_new' });
  });

  it('imports with the selected target and refreshes safety snapshots after success', async () => {
    const onImportCompleted = jest.fn().mockResolvedValue(undefined);
    const envelope = createEnvelope();
    horseTransfer.validateHorseTransferJson.mockReturnValue({
      ok: true,
      envelope,
      preview: {},
    });
    const { result } = renderHook(() => useHorseImport({ onImportCompleted }));

    await act(async () => {
      await result.current.prepareImportFromPickedFile();
    });
    act(() => {
      result.current.selectExistingTarget('mare-local');
    });

    let importResult: Awaited<ReturnType<typeof result.current.confirmPreparedImport>> | null = null;
    await act(async () => {
      importResult = await result.current.confirmPreparedImport();
    });

    expect(horseTransfer.importHorseTransfer).toHaveBeenCalledWith(envelope, {
      target: {
        kind: 'confirmed_match',
        destinationHorseId: 'mare-local',
      },
    });
    expect(onImportCompleted).toHaveBeenCalled();
    expect(importResult).toEqual({
      ok: true,
      safetySnapshotCreated: true,
      summary: createSummary(),
    });
    expect(result.current.pendingImport).toBeNull();
    expect(result.current.finalSummary).toEqual(createSummary());
  });

  it('requires target selection for ambiguous previews', async () => {
    horseTransfer.previewHorseImport.mockResolvedValue({
      preview: createPreview(),
      match: {
        state: 'ambiguous',
        reasons: ['conflicting_exact_matches'],
        candidates: [],
        fuzzySuggestions: [],
      },
    });
    const { result } = renderHook(() => useHorseImport());

    await act(async () => {
      await result.current.prepareImportFromPickedFile();
    });

    let importResult: Awaited<ReturnType<typeof result.current.confirmPreparedImport>> | null = null;
    await act(async () => {
      importResult = await result.current.confirmPreparedImport();
    });

    expect(importResult).toEqual({
      ok: false,
      errorMessage: 'Choose a destination horse or create a new record before importing.',
    });
    expect(horseTransfer.importHorseTransfer).not.toHaveBeenCalled();
  });

  it('preserves import failure state and does not refresh snapshots', async () => {
    const onImportCompleted = jest.fn().mockResolvedValue(undefined);
    horseTransfer.importHorseTransfer.mockResolvedValue({
      ok: false,
      safetySnapshotCreated: true,
      errorMessage: 'Horse import failed unexpectedly.',
    });
    const { result } = renderHook(() => useHorseImport({ onImportCompleted }));

    await act(async () => {
      await result.current.prepareImportFromPickedFile();
    });

    let importResult: Awaited<ReturnType<typeof result.current.confirmPreparedImport>> | null = null;
    await act(async () => {
      importResult = await result.current.confirmPreparedImport();
    });

    expect(importResult).toEqual({
      ok: false,
      safetySnapshotCreated: true,
      errorMessage: 'Horse import failed unexpectedly.',
    });
    expect(result.current.errorMessage).toBe('Horse import failed unexpectedly.');
    expect(result.current.pendingImport).not.toBeNull();
    expect(onImportCompleted).not.toHaveBeenCalled();
  });
});

function createEnvelope() {
  return {
    artifactType: 'breedwise.horseTransfer',
    transferVersion: 1,
    sourceHorse: {
      type: 'mare',
      id: 'mare-import',
      name: 'Nova',
      registrationNumber: null,
      dateOfBirth: null,
    },
  };
}

function createPreview() {
  return {
    sourceHorse: {
      type: 'mare',
      id: 'mare-import',
      name: 'Nova',
      registrationNumber: null,
      dateOfBirth: null,
    },
    totalRowCount: 1,
    estimatedConflictTotal: 0,
    redactionNotices: [],
    tableCounts: {},
    estimatedConflictCounts: {},
    targetState: 'create_new',
    nonOverwritePolicy: true,
    safetySnapshotPolicy: 'before_import',
    createdAt: '2026-04-28T12:00:00.000Z',
    appVersion: '1.3.5',
    dataSchemaVersion: 11,
    privacy: {
      redactedContextStallions: false,
      redactedDoseRecipientAndShipping: false,
    },
  };
}

function createSummary() {
  return {
    tableCounts: {},
    totalCounts: {
      inserted: 1,
      already_present: 0,
      skipped: 0,
      conflict: 0,
    },
    rowResults: [],
  };
}
